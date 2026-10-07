import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAllRows, getRow } from "@/data/queries";
import { archiveHabit, createGoal, createHabit, logHabit, updateHabit } from "@/repo";
import { freshDb, setNow } from "@/test/db";

// Wednesday 7 Oct 2026, 10:00 in Jakarta.
beforeEach(() => freshDb("2026-10-07T03:00:00.000Z"));
afterEach(() => vi.useRealTimers());

const water = { title: "Water", kind: "count" as const, unit: "glasses", levels: { min: 4, std: 6, elite: 8 }, weekdays: [1, 2, 3, 4, 5, 6, 7] as (1 | 2 | 3 | 4 | 5 | 6 | 7)[] };

describe("elastic habits", () => {
  it("creates a habit linked to a goal, and logs once per day by count or level", async () => {
    const { goal } = await createGoal("2026-Q4", { title: "Health", area_id: null, outcome: "Fit", metric_label: null, metric_target: null, metric_current: null, starts_on: "2026-10-01", ends_on: "2026-12-31" });
    const h = await createHabit({ ...water, goal_id: goal.id });
    expect(h).toMatchObject({ goal_id: goal.id, area_id: null, active: true, archived_at: null, _dirty: 1 });

    await logHabit(h.id, "2026-10-07", { count: 5 });
    await logHabit(h.id, "2026-10-07", { count: 8 });
    const logs = await getAllRows("habit_logs");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ id: `${h.id}:2026-10-07`, count: 8, level: 3 });

    const stretch = await createHabit({ title: "Stretch", kind: "level", unit: null, levels: { min: "1 stretch", std: "10 minutes", elite: "30 minutes" }, weekdays: [1, 3, 5] });
    await logHabit(stretch.id, "2026-10-07", { level: 1 });
    expect(await getRow("habit_logs", `${stretch.id}:2026-10-07`)).toMatchObject({ level: 1, count: null });
    await expect(logHabit(stretch.id, "2026-10-07", { count: 3 })).rejects.toThrow(/by level/);
  });

  it("is editable for today and yesterday only", async () => {
    const h = await createHabit(water);
    await expect(logHabit(h.id, "2026-10-06", { count: 4 })).resolves.toMatchObject({ level: 1 });
    await expect(logHabit(h.id, "2026-10-05", { count: 4 })).rejects.toThrow(/today or yesterday/);
    setNow("2026-10-07T17:00:00.000Z"); // 00:00 on 8 Oct in Jakarta
    await expect(logHabit(h.id, "2026-10-06", { count: 4 })).rejects.toThrow(/today or yesterday/);
  });

  it("edits and archives", async () => {
    const h = await createHabit(water);
    await expect(updateHabit(h.id, { levels: { min: 9, std: 6, elite: 8 } })).rejects.toThrow(/go up/);
    expect(await updateHabit(h.id, { title: "Drink water", weekdays: [1, 2, 3, 4, 5] })).toMatchObject({ title: "Drink water", weekdays: [1, 2, 3, 4, 5] });
    await archiveHabit(h.id);
    expect((await getRow("habits", h.id))?.archived_at).toBeTruthy();
  });
});
