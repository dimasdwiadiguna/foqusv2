import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FoqusDb, getDb } from "@/db";
import { DEFAULT_SETTINGS, ensureSeed, OTHER_AREA_ID } from "@/db/seed";
import { getAllRows, getRow, getSettings } from "@/data/queries";
import { createRow, NotFoundError, softDelete, updateRow, updateSettings } from "@/repo";

const T0 = "2026-10-05T00:00:00.000Z";

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(T0));
  await getDb().delete();
  await getDb().open();
  await ensureSeed(getDb(), T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("first-run seeding", () => {
  it("creates settings, 7 + 7 windows, and the Other area with deterministic ids", async () => {
    const db = getDb();
    expect(await db.t("settings").toCollection().primaryKeys()).toEqual(["settings"]);
    expect((await db.t("availability_windows").toCollection().primaryKeys()).sort()).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((d) => `avail-${d}`),
    );
    expect((await db.t("peak_windows").toCollection().primaryKeys()).sort()).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((d) => `peak-${d}`),
    );
    expect(await db.t("areas").toCollection().primaryKeys()).toEqual([OTHER_AREA_ID]);

    const settings = await getSettings();
    expect(settings).toMatchObject({ ...DEFAULT_SETTINGS, created_at: T0, updated_at: T0, deleted_at: null, _dirty: 1 });
    expect(await getRow("availability_windows", "avail-3")).toMatchObject({ weekday: 3, start_time: "05:00", end_time: "21:00" });
    expect(await getRow("peak_windows", "peak-7")).toMatchObject({ weekday: 7, start_time: "05:00", end_time: "09:00" });
    expect(await getRow("areas", OTHER_AREA_ID)).toMatchObject({ name: "Other", color: "#9AA3B2", is_default: true });
  });

  it("is idempotent and never overwrites existing rows", async () => {
    await updateSettings({ daily_pomodoro_cap: 6 });
    expect(await ensureSeed(getDb(), "2026-10-06T00:00:00.000Z")).toBe(0);
    expect((await getSettings())?.daily_pomodoro_cap).toBe(6);
    expect(await getDb().t("availability_windows").count()).toBe(7);
  });

  it("refills a missing row only", async () => {
    await getDb().t("peak_windows").delete("peak-2");
    expect(await ensureSeed(getDb(), T0)).toBe(1);
  });
});

describe("repo writes", () => {
  it("updating a setting refreshes updated_at and sets _dirty to 1", async () => {
    await getDb().t("settings").update("settings", { _dirty: 0 });
    vi.setSystemTime(new Date("2026-10-05T01:02:03.000Z"));
    await updateSettings({ max_pomodoros_per_block: 3 });

    // Read from a second connection, as a reload would.
    const fresh = new FoqusDb();
    const row = await fresh.t("settings").get("settings");
    fresh.close();
    expect(row).toMatchObject({
      max_pomodoros_per_block: 3,
      created_at: T0,
      updated_at: "2026-10-05T01:02:03.000Z",
      _dirty: 1,
    });
  });

  it("rejects an invalid setting and leaves the row unchanged", async () => {
    await expect(updateSettings({ timezone: "Nowhere/Land" })).rejects.toThrow();
    expect((await getSettings())?.timezone).toBe("Asia/Jakarta");
  });

  it("creates rows with a random UUID or the given id, with fresh metadata", async () => {
    const a = await createRow("personal_blocks", {
      label: "Lunch",
      weekdays: [1, 2, 3, 4, 5],
      start_time: "12:00",
      end_time: "13:00",
      active: true,
    });
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).toMatchObject({ created_at: T0, updated_at: T0, deleted_at: null, _dirty: 1 });

    const s = await createRow("seasons", {
      id: "2026-Q4",
      year: 2026,
      quarter: 4,
      starts_on: "2026-10-01",
      ends_on: "2026-12-31",
      theme: null,
      review_note: null,
      reviewed_at: null,
    });
    expect(s.id).toBe("2026-Q4");
    await expect(
      createRow("seasons", { ...s, id: "2026-Q4" } as Parameters<typeof createRow<"seasons">>[1]),
    ).rejects.toThrow();
  });

  it("ignores metadata smuggled into a patch", async () => {
    const before = await getSettings();
    await updateRow("settings", "settings", { created_at: "1999-01-01T00:00:00.000Z" } as never);
    expect((await getSettings())?.created_at).toBe(before?.created_at);
  });

  it("soft-deletes: the row stays, reads skip it, and it cannot be updated", async () => {
    const pb = await createRow("personal_blocks", {
      label: "Gym",
      weekdays: [2],
      start_time: "17:00",
      end_time: "18:00",
      active: true,
    });
    vi.setSystemTime(new Date("2026-10-05T02:00:00.000Z"));
    await softDelete("personal_blocks", pb.id);

    const raw = await getDb().t("personal_blocks").get(pb.id);
    expect(raw).toMatchObject({ deleted_at: "2026-10-05T02:00:00.000Z", updated_at: "2026-10-05T02:00:00.000Z", _dirty: 1 });
    expect(await getRow("personal_blocks", pb.id)).toBeUndefined();
    expect(await getAllRows("personal_blocks")).toEqual([]);
    await expect(updateRow("personal_blocks", pb.id, { label: "x" })).rejects.toBeInstanceOf(NotFoundError);

    // Deleting again keeps the original deletion time.
    vi.setSystemTime(new Date("2026-10-05T03:00:00.000Z"));
    await softDelete("personal_blocks", pb.id);
    expect((await getDb().t("personal_blocks").get(pb.id))?.deleted_at).toBe("2026-10-05T02:00:00.000Z");
  });
});
