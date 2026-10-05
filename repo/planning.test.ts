import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { getAllRows } from "@/data/queries";
import { OTHER_AREA_ID } from "@/lib/ids";
import {
  addAction,
  commitDraft,
  createGoal,
  createRule,
  deleteRule,
  discardDraft,
  draftMyWeek,
  generateOccurrences,
  placeBlock,
  rolloverWeek,
  setPlannedWeek,
  updateRule,
} from "@/repo";
import { freshDb, setNow } from "@/test/db";

const Q4 = "2026-Q4";
const WEEK = "2026-10-05";
const at = (date: string, time: string) => Date.parse(`${date}T${time}:00+07:00`);
const occurrences = async () =>
  (await getAllRows("actions")).filter((a) => a.recurrence_rule_id).map((a) => `${a.occurrence_date} ${a.title} ${a.status}`).sort();

// Monday 5 Oct 2026, 05:00 in Jakarta.
beforeEach(() => freshDb("2026-10-04T22:00:00.000Z"));
afterEach(() => vi.useRealTimers());

describe("recurring actions (§5.5)", () => {
  it("generates each occurrence once, however often the app opens", async () => {
    const rule = await createRule({ title: "Run", area_id: OTHER_AREA_ID, weekdays: [1, 3, 5], pomodoros: 1, preferred_start: "06:00" });
    expect(rule).toMatchObject({ ends_on: null, active: true });
    // Two opens on the same Monday.
    await generateOccurrences(WEEK, "2026-10-05");
    await generateOccurrences(WEEK, "2026-10-05");
    const rows = (await getDb().t("actions").toArray()).filter((a) => a.recurrence_rule_id === rule.id);
    expect(rows.map((a) => a.id).sort()).toEqual([`${rule.id}:2026-10-05`, `${rule.id}:2026-10-07`, `${rule.id}:2026-10-09`]);
    expect(rows[0]).toMatchObject({ planned_week: WEEK, estimate_pomodoros: 1, area_id: OTHER_AREA_ID, due_on: null });
  });

  it("goal rules end with the season plan by default", async () => {
    const { goal } = await createGoal(Q4, { title: "Thesis", area_id: null, outcome: "Draft", metric_label: null, metric_target: null, metric_current: null, starts_on: "2026-10-05", ends_on: "2026-11-30" });
    const rule = await createRule({ title: "Write", goal_id: goal.id, weekdays: [2], pomodoros: 2, preferred_start: null });
    expect(rule).toMatchObject({ goal_id: goal.id, area_id: null, ends_on: "2026-11-30" });
  });

  it("editing and pausing change only untouched occurrences from today on", async () => {
    const rule = await createRule({ title: "Run", area_id: OTHER_AREA_ID, weekdays: [1, 3, 5], pomodoros: 1, preferred_start: null });
    // Wednesday's occurrence gets a block; then it is Wednesday 10:00.
    await placeBlock(`${rule.id}:2026-10-07`, { start: at("2026-10-07", "06:00"), pomodoros: 1, bufferMinutes: 0 });
    setNow("2026-10-07T03:00:00.000Z");
    await updateRule(rule.id, { title: "Long run", pomodoros: 2, weekdays: [1, 3, 4] });
    expect(await occurrences()).toEqual([
      "2026-10-05 Run todo", // past: unchanged
      "2026-10-07 Run todo", // has a block: unchanged
      "2026-10-08 Long run todo", // new day
    ]);
    await updateRule(rule.id, { active: false });
    expect(await occurrences()).toEqual(["2026-10-05 Run todo", "2026-10-07 Run todo"]);
    await deleteRule(rule.id);
    expect((await getAllRows("recurrence_rules")).length).toBe(0);
  });

  it("never carries over: last week's open occurrences are dropped at rollover", async () => {
    await createRule({ title: "Run", area_id: OTHER_AREA_ID, weekdays: [5], pomodoros: 1, preferred_start: null });
    const task = await addAction({ title: "Normal task", planned_week: WEEK });
    expect(await rolloverWeek("2026-10-12")).toBe(1);
    expect(await occurrences()).toEqual(["2026-10-09 Run dropped"]);
    expect((await getAllRows("actions")).find((a) => a.id === task.id)?.planned_week).toBe("2026-10-12");
  });

  it("reschedules only within its own week", async () => {
    const rule = await createRule({ title: "Run", area_id: OTHER_AREA_ID, weekdays: [5], pomodoros: 1, preferred_start: null });
    const id = `${rule.id}:2026-10-09`;
    await expect(placeBlock(id, { start: at("2026-10-12", "06:00"), pomodoros: 1, bufferMinutes: 0 })).rejects.toThrow(/own week/);
    await expect(placeBlock(id, { start: at("2026-10-10", "06:00"), pomodoros: 1, bufferMinutes: 0 })).resolves.toBeTruthy();
    await expect(setPlannedWeek(id, "2026-10-12")).rejects.toThrow(/own week/);
  });
});

describe("weekly draft (§5.11)", () => {
  it("drafts, re-drafts without touching committed blocks, commits, and discards", async () => {
    const a = await addAction({ title: "Grade", planned_week: WEEK, estimate_pomodoros: 6 });
    const b = await addAction({ title: "Email", planned_week: WEEK, estimate_pomodoros: 1 });
    const committed = await placeBlock(b.id, { start: at("2026-10-05", "10:00"), pomodoros: 1, bufferMinutes: 0 });

    const first = await draftMyWeek(WEEK);
    expect(first).toEqual({ placed: 2, didntFit: [] });
    const drafts = async () => (await getAllRows("blocks")).filter((x) => x.status === "draft").sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    expect((await drafts()).map((x) => [x.action_id, x.planned_pomodoros, x.origin])).toEqual([
      [a.id, 4, "draft"],
      [a.id, 2, "draft"],
    ]);

    // Running again replaces the draft; the committed block stays.
    await draftMyWeek(WEEK);
    expect((await drafts()).length).toBe(2);
    expect((await getAllRows("blocks")).filter((x) => x.status === "draft" || x.id === committed.id).length).toBe(3);
    expect((await getDb().t("blocks").toArray()).filter((x) => x.deleted_at).length).toBe(2);

    await discardDraft(WEEK);
    expect(await drafts()).toEqual([]);
    expect((await getAllRows("blocks")).map((x) => x.id)).toEqual([committed.id]);

    await draftMyWeek(WEEK);
    expect(await commitDraft(WEEK)).toBe(2);
    expect((await getAllRows("blocks")).map((x) => x.status).sort()).toEqual(["scheduled", "scheduled", "scheduled"]);
    // Committed work is no longer unscheduled, so a new draft has nothing to place.
    expect(await draftMyWeek(WEEK)).toEqual({ placed: 0, didntFit: [] });
  });

  it("drafts a recurring occurrence on its day at its preferred time", async () => {
    const rule = await createRule({ title: "Run", area_id: OTHER_AREA_ID, weekdays: [3], pomodoros: 1, preferred_start: "17:00" });
    await draftMyWeek(WEEK);
    const [blk] = await getAllRows("blocks");
    expect(blk).toMatchObject({ action_id: `${rule.id}:2026-10-07`, starts_at: new Date(at("2026-10-07", "17:00")).toISOString(), status: "draft" });
  });
});
