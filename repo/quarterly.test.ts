import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAllRows, getRow } from "@/data/queries";
import {
  addAction,
  addMajorMove,
  carryOverGoal,
  createGoal,
  createRule,
  dropGoal,
  achieveGoal,
  finishQuarterlyReview,
  saveMajorMoves,
  saveSeasonNote,
  setMajorMoveDone,
} from "@/repo";
import { freshDb } from "@/test/db";

// Thursday 24 December 2026, 10:00 in Jakarta.
beforeEach(() => freshDb("2026-12-24T03:00:00.000Z"));
afterEach(() => vi.useRealTimers());

const goal = (title: string) =>
  createGoal("2026-Q4", { title, area_id: null, outcome: `${title} done`, metric_label: "pages", metric_target: 40, metric_current: 12, starts_on: "2026-10-01", ends_on: "2026-12-31" });

describe("quarterly review (§5.16)", () => {
  it("cannot finish until every active goal is carried over, closed, or dropped", async () => {
    const a = await goal("Thesis");
    const b = await goal("Run 10 km");
    const c = await goal("Course");
    await expect(finishQuarterlyReview("2026-Q4")).rejects.toThrow(/Resolve every goal first: Thesis, Run 10 km, Course/);
    await carryOverGoal(a.goal.id, "2026-Q4");
    await achieveGoal(b.goal.id);
    await expect(finishQuarterlyReview("2026-Q4")).rejects.toThrow(/Course\.$/);
    await dropGoal(c.goal.id, "Not this year");
    await saveSeasonNote("2026-Q4", "Morning blocks", "Fewer goals");
    await finishQuarterlyReview("2026-Q4");
    expect(await getRow("seasons", "2026-Q4")).toMatchObject({ review_note: "What worked:\nMorning blocks\n\nWhat to change:\nFewer goals" });
    expect((await getRow("seasons", "2026-Q4"))?.reviewed_at).toBeTruthy();
  });

  it("carrying over creates the next season's plan and moves unfinished moves and open actions", async () => {
    const { goal: g, plan } = await goal("Thesis");
    await saveMajorMoves(plan.id, [{ title: "Outline" }, { title: "Draft" }]);
    const moves = (await getAllRows("major_moves")).sort((x, y) => x.sort_order - y.sort_order);
    await setMajorMoveDone(moves[0].id, true);
    await addMajorMove(plan.id, "Edit");
    const open = await addAction({ title: "Write chapter 2", goal_id: g.id, major_move_id: moves[1].id, estimate_pomodoros: 6 });
    const rule = await createRule({ title: "Write", goal_id: g.id, weekdays: [1], pomodoros: 1, preferred_start: null });
    expect(rule.ends_on).toBe("2026-12-31");

    const next = await carryOverGoal(g.id, "2026-Q4");
    expect(next).toMatchObject({ id: `${g.id}:2027-Q1`, season_id: "2027-Q1", starts_on: "2027-01-01", ends_on: "2027-03-31", outcome: "Thesis done", metric_target: 40, metric_current: 12, resolution: null });
    expect(await getRow("seasons", "2027-Q1")).toBeTruthy();
    expect((await getRow("season_plans", plan.id))?.resolution).toBe("carried");
    const after = await getAllRows("major_moves");
    expect(after.filter((m) => m.season_plan_id === next.id).map((m) => m.title).sort()).toEqual(["Draft", "Edit"]);
    expect(after.filter((m) => m.season_plan_id === plan.id).map((m) => m.title)).toEqual(["Outline"]);
    // The open action belongs to the goal and keeps its move, now on the new plan.
    expect(await getRow("actions", open.id)).toMatchObject({ goal_id: g.id, status: "todo", major_move_id: moves[1].id });
    expect((await getRow("recurrence_rules", rule.id))?.ends_on).toBe("2027-03-31");
    // Carrying twice is harmless.
    await expect(carryOverGoal(g.id, "2026-Q4")).resolves.toMatchObject({ id: next.id });
  });
});
