import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { getAllRows, getRow } from "@/data/queries";
import { getReviewDue, getWeekStats } from "@/data/coach";
import { OTHER_AREA_ID } from "@/lib/ids";
import {
  addAction,
  applyWeekPicks,
  completeCheckin,
  completeReview,
  createGoal,
  createRule,
  dismissInsight,
  placeBlock,
  prepareNextWeek,
  refreshCoach,
  resolveDone,
  saveCompass,
  saveReviewNotes,
  setReviewStep,
  startReview,
} from "@/repo";
import { freshDb, setNow } from "@/test/db";

const at = (date: string, time: string) => Date.parse(`${date}T${time}:00+07:00`);
const WEEK = "2026-10-05";
const NEXT = "2026-10-12";

// Monday 5 Oct 2026, 05:00 in Jakarta.
beforeEach(() => freshDb("2026-10-04T22:00:00.000Z"));
afterEach(() => vi.useRealTimers());

async function goal(title = "Thesis") {
  return createGoal("2026-Q4", { title, area_id: null, outcome: "Draft done", metric_label: null, metric_target: null, metric_current: null, starts_on: "2026-10-05", ends_on: "2026-12-31" });
}

describe("compass", () => {
  it("saves the vision and values", async () => {
    await saveCompass({ vision: " A calm, deep career ", values: ["Craft", " ", "Craft", "Family"] });
    expect(await getRow("compass", "compass")).toMatchObject({ vision: "A calm, deep career", values: ["Craft", "Family"], _dirty: 1 });
    await saveCompass({ vision: "", values: [] });
    expect(await getRow("compass", "compass")).toMatchObject({ vision: null, values: [] });
  });
});

describe("weekly review (§5.15)", () => {
  it("is due from Sunday for a week with activity, can be left and resumed, and completes once", async () => {
    const a = await addAction({ title: "Grade", planned_week: WEEK, estimate_pomodoros: 2 });
    const b = await placeBlock(a.id, { start: at("2026-10-05", "09:00"), pomodoros: 2, bufferMinutes: 0 });
    setNow("2026-10-05T10:00:00.000Z");
    await resolveDone(b.id, 2, false);
    expect(await getReviewDue(Date.parse("2026-10-10T05:00:00.000Z"))).toBeNull(); // Saturday: last week had nothing
    setNow("2026-10-11T05:00:00.000Z"); // Sunday 12:00
    expect(await getReviewDue(Date.now())).toBe(WEEK);

    await startReview(WEEK);
    await setReviewStep(WEEK, 2);
    await saveReviewNotes(WEEK, { wins: "Graded everything", lessons: " " });
    // Leave and come back: the step and notes are there.
    expect(await getRow("weekly_reviews", WEEK)).toMatchObject({ step: 2, wins: "Graded everything", lessons: null, completed_at: null });

    await completeReview(WEEK);
    const done = await getRow("weekly_reviews", WEEK);
    expect(done?.completed_at).toBeTruthy();
    expect(done?.stats).toMatchObject({ completed: 2, planned: 2, follow_through: 1, goal_share: 0 });
    expect(await getReviewDue(Date.now())).toBeNull();
  });

  it("keeps a completed review's numbers when later data changes", async () => {
    const a = await addAction({ title: "Grade", planned_week: WEEK, estimate_pomodoros: 4 });
    const b = await placeBlock(a.id, { start: at("2026-10-07", "09:00"), pomodoros: 2, bufferMinutes: 0 });
    setNow("2026-10-11T05:00:00.000Z");
    await resolveDone(b.id, 1, false);
    await completeReview(WEEK);
    const before = (await getRow("weekly_reviews", WEEK))?.stats;
    // Later: the block is edited to 2 completed and another block appears in that week.
    await getDb().t("blocks").update(b.id, { completed_pomodoros: 2 });
    await placeBlock(a.id, { start: at("2026-10-11", "14:00"), pomodoros: 1, bufferMinutes: 0 });
    await completeReview(WEEK);
    expect((await getRow("weekly_reviews", WEEK))?.stats).toEqual(before);
    // The live numbers did change; the stored snapshot is what stays.
    const live = await getWeekStats(WEEK, Date.now());
    expect(live?.completed).toBe(2);
    expect(before).toMatchObject({ completed: 1 });
  });

  it("picks next week's list: ticked actions move, unticked go to the backlog, unticked occurrences are dropped", async () => {
    setNow("2026-10-11T05:00:00.000Z");
    const carried = await addAction({ title: "Carried", planned_week: WEEK });
    const backlog = await addAction({ title: "Backlog item" });
    const left = await addAction({ title: "Left behind", planned_week: WEEK });
    const rule = await createRule({ title: "Run", area_id: OTHER_AREA_ID, weekdays: [1, 3], pomodoros: 1, preferred_start: null });
    await prepareNextWeek(WEEK);
    await prepareNextWeek(WEEK);
    const occ = (await getAllRows("actions")).filter((x) => x.recurrence_rule_id === rule.id && x.planned_week === NEXT).map((x) => x.id).sort();
    expect(occ).toEqual([`${rule.id}:2026-10-12`, `${rule.id}:2026-10-14`]);
    await applyWeekPicks(WEEK, [carried.id, backlog.id, occ[0]], [carried.id, backlog.id, left.id, ...occ]);
    const rows = new Map((await getAllRows("actions")).map((x) => [x.id, x]));
    expect(rows.get(carried.id)?.planned_week).toBe(NEXT);
    expect(rows.get(backlog.id)?.planned_week).toBe(NEXT);
    expect(rows.get(left.id)?.planned_week).toBeNull();
    expect(rows.get(occ[0])?.status).toBe("todo");
    expect(rows.get(occ[1])?.status).toBe("dropped");
  });
});

describe("coach messages and snapshots", () => {
  it("stores insights, keeps a dismissed one away for 7 days, and snapshots strength once per week", async () => {
    const { goal: g } = await goal();
    await refreshCoach();
    const starved = `GOAL_STARVED:${g.id}`;
    expect(await getRow("coach_messages", starved)).toMatchObject({ status: "new", source: "rule", goal_id: g.id });
    await dismissInsight(starved);
    setNow("2026-10-08T22:00:00.000Z");
    await refreshCoach();
    expect((await getRow("coach_messages", starved))?.status).toBe("dismissed");
    setNow("2026-10-11T23:00:00.000Z"); // Monday 12 Oct 06:00, 7 days + 1 h later
    await refreshCoach();
    expect((await getRow("coach_messages", starved))?.status).toBe("new");
    // One snapshot per plan per week.
    const snaps = (await getAllRows("plan_strength_snapshots")).map((s) => s.week_start).sort();
    expect(snaps).toEqual(["2026-10-05", "2026-10-12"]);
  });

  it("re-evaluates after a check-in: the missed check-in insight goes away", async () => {
    const a = await addAction({ title: "Grade", planned_week: WEEK });
    await placeBlock(a.id, { start: at("2026-10-05", "09:00"), pomodoros: 1, bufferMinutes: 0 });
    setNow("2026-10-06T03:00:00.000Z"); // Tuesday 10:00
    await refreshCoach();
    expect((await getRow("coach_messages", "MISSED_CHECKIN:2026-10-05"))?.status).toBe("new");
    await completeCheckin("2026-10-05", { energy: 3, focus: 3 });
    expect((await getRow("coach_messages", "MISSED_CHECKIN:2026-10-05"))?.status).toBe("done");
  });
});
