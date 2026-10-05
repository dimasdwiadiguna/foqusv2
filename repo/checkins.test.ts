import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { getRow } from "@/data/queries";
import { completeCheckin, saveCheckin } from "@/repo";
import { freshDb, setNow } from "@/test/db";

beforeEach(() => freshDb("2026-10-05T12:00:00.000Z")); // Mon 5 Oct, 19:00 in Jakarta
afterEach(() => vi.useRealTimers());

describe("daily check-in", () => {
  it("saves as it goes and completes once", async () => {
    await saveCheckin("2026-10-05", { energy: 4 });
    await saveCheckin("2026-10-05", { focus: 3, note: "  Good morning block.  " });
    expect(await getRow("daily_checkins", "2026-10-05")).toMatchObject({ date: "2026-10-05", energy: 4, focus: 3, note: "Good morning block.", completed_at: null, _dirty: 1 });
    expect(await completeCheckin("2026-10-05")).toBe(true);
    const done = await getRow("daily_checkins", "2026-10-05");
    expect(done?.completed_at).toBe("2026-10-05T12:00:00.000Z");
    // Editing later keeps the first completion time.
    setNow("2026-10-05T13:00:00.000Z");
    expect(await completeCheckin("2026-10-05", { energy: 2 })).toBe(false);
    expect(await getRow("daily_checkins", "2026-10-05")).toMatchObject({ energy: 2, completed_at: "2026-10-05T12:00:00.000Z" });
  });

  it("is editable until the end of the next day, in the settings time zone", async () => {
    await completeCheckin("2026-10-05", { energy: 3, focus: 3 });
    // Tue 6 Oct 23:59 in Jakarta: still editable.
    setNow("2026-10-06T16:59:00.000Z");
    await expect(saveCheckin("2026-10-05", { energy: 5 })).resolves.toMatchObject({ energy: 5 });
    // Wed 7 Oct 00:00 in Jakarta (still the 6th in UTC): closed.
    setNow("2026-10-06T17:00:00.000Z");
    await expect(saveCheckin("2026-10-05", { energy: 1 })).rejects.toThrow(/end of the next day/);
    // Future days cannot be checked in yet.
    await expect(saveCheckin("2026-10-08", { energy: 1 })).rejects.toThrow(/end of the next day/);
  });

  it("validates ratings and the note", async () => {
    await expect(saveCheckin("2026-10-05", { energy: 6 })).rejects.toThrow(/1 to 5/);
    await expect(saveCheckin("2026-10-05", { note: "x".repeat(501) })).rejects.toThrow(/500/);
    expect((await saveCheckin("2026-10-05", { note: "   " })).note).toBeNull();
  });

  it("revives a soft-deleted row", async () => {
    await completeCheckin("2026-10-05", { energy: 3 });
    const row = (await getDb().t("daily_checkins").get("2026-10-05"))!;
    await getDb().t("daily_checkins").put({ ...row, deleted_at: "2026-10-05T12:30:00.000Z" });
    expect(await completeCheckin("2026-10-05", { focus: 4 })).toBe(true);
    expect(await getRow("daily_checkins", "2026-10-05")).toMatchObject({ energy: null, focus: 4, deleted_at: null });
  });
});
