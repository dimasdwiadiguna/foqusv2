import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { ensureSeed } from "@/db/seed";
import { getActionsForArea, getBackup, getRowCounts } from "@/data/queries";
import { parseBackup } from "@/lib/backup";
import { OTHER_AREA_ID } from "@/lib/ids";
import { addAction, createArea, createGoal, deleteAction, importBackup, placeBlock, updateSettings } from "@/repo";
import { freshDb } from "@/test/db";

const at = (time: string) => Date.parse(`2026-10-06T${time}:00+07:00`);

beforeEach(() => freshDb("2026-10-05T23:00:00.000Z"));
afterEach(() => vi.useRealTimers());

async function someData() {
  await updateSettings({ daily_pomodoro_cap: 7 });
  const work = await createArea("Work", "#5B8DEF");
  const { goal } = await createGoal("2026-Q4", {
    title: "G",
    area_id: work.id,
    outcome: "O",
    metric_label: null,
    metric_target: null,
    metric_current: null,
    starts_on: "2026-10-06",
    ends_on: "2026-12-31",
  });
  const a = await addAction({ title: "A", goal_id: goal.id });
  await placeBlock(a.id, { start: at("10:00"), pomodoros: 2, bufferMinutes: 10 });
  const gone = await addAction({ title: "Gone" });
  await deleteAction(gone.id);
}

describe("backup round trip (Step 1.5)", () => {
  it("export then import into a fresh database reproduces the data with matching row counts", async () => {
    await someData();
    const file = JSON.stringify(await getBackup("2026-10-06T00:00:00.000Z"));
    const before = await getRowCounts();

    // A fresh profile: an empty database that has only been seeded.
    await getDb().delete();
    await getDb().open();
    await ensureSeed(getDb(), "2026-10-07T00:00:00.000Z");

    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);
    await importBackup(parsed.backup);

    expect(await getRowCounts()).toEqual(before);
    expect((await getDb().t("settings").get("settings"))?.daily_pomodoro_cap).toBe(7);
    expect((await getDb().t("actions").toArray()).find((a) => a.title === "Gone")?.deleted_at).not.toBeNull();
    // Imported rows are fresh local changes, so a later sync carries them.
    expect((await getDb().t("blocks").toArray()).every((b) => b._dirty === 1)).toBe(true);
  });

  it("soft-deletes rows that are not in the file", async () => {
    const file = JSON.stringify(await getBackup("2026-10-06T00:00:00.000Z"));
    const extra = await addAction({ title: "Made after the backup" });
    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);
    await importBackup(parsed.backup);
    const row = await getDb().t("actions").get(extra.id);
    expect(row?.deleted_at).not.toBeNull();
    expect(row?._dirty).toBe(1);
    expect(await getActionsForArea(OTHER_AREA_ID)).toEqual([]);
  });

  it("an invalid file is rejected before anything is written", async () => {
    await someData();
    const before = JSON.stringify(await getBackup("x"));
    const bad = parseBackup(JSON.stringify({ format: "foqus-backup", version: 1, exported_at: "2026-10-06T00:00:00Z", tables: { actions: [{ title: "x" }] } }));
    expect(bad.ok).toBe(false);
    expect(JSON.stringify(await getBackup("x"))).toBe(before);
  });
});
