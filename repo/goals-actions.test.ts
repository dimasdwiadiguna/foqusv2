import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { OTHER_AREA_ID } from "@/db/seed";
import {
  getActionsForArea,
  getActionsForGoal,
  getActivePlanSpans,
  getAreas,
  getGoalsInSeason,
  getMajorMoves,
  getOpenCountsByArea,
} from "@/data/queries";
import { wouldExceedConcurrentGoals } from "@/lib/goals";
import {
  achieveGoal,
  addAction,
  archiveArea,
  completeAction,
  createArea,
  createGoal,
  createRow,
  deleteAction,
  deleteGoal,
  deleteMajorMove,
  dropAction,
  dropGoal,
  reorderActions,
  reorderAreas,
  reorderGoals,
  restoreArea,
  saveMajorMoves,
  updateAction,
  updateGoalBasics,
  updateGoalWhy,
  updateRealityCheck,
  type GoalBasics,
} from "@/repo";
import { freshDb, setNow } from "@/test/db";

const Q4 = "2026-Q4";
const basics = (title: string, over: Partial<GoalBasics> = {}): GoalBasics => ({
  title,
  area_id: null,
  outcome: `${title} done`,
  metric_label: null,
  metric_target: null,
  metric_current: null,
  starts_on: "2026-10-05",
  ends_on: "2026-12-31",
  ...over,
});

const block = (action_id: string, starts_at: string, status: "scheduled" | "done" | "draft" = "scheduled") =>
  createRow("blocks", {
    action_id,
    starts_at,
    planned_pomodoros: 2,
    ends_at: new Date(Date.parse(starts_at) + 3_600_000).toISOString(),
    buffer_minutes: 10,
    status,
    completed_pomodoros: status === "done" ? 2 : 0,
    resolution: null,
    resolved_at: null,
    origin: "manual",
    off_peak: false,
    after_due: false,
    replaced_by_block_id: null,
  });

beforeEach(() => freshDb());
afterEach(() => vi.useRealTimers());

describe("quick add (§6.7)", () => {
  it("with only a title lands in Other with an estimate of 1", async () => {
    const a = await addAction({ title: "Buy stamps" });
    expect(a).toMatchObject({
      title: "Buy stamps",
      area_id: OTHER_AREA_ID,
      goal_id: null,
      major_move_id: null,
      estimate_pomodoros: 1,
      status: "todo",
      planned_week: null,
      _dirty: 1,
    });
    expect((await getActionsForArea(OTHER_AREA_ID)).map((x) => x.id)).toEqual([a.id]);
  });

  it("appends to the end of its list and honours the chips", async () => {
    const one = await addAction({ title: "One" });
    const two = await addAction({ title: "Two", estimate_pomodoros: 3, due_on: "2026-10-09", planned_week: "2026-10-05" });
    expect(two.sort_order).toBe(one.sort_order + 1);
    expect(two).toMatchObject({ estimate_pomodoros: 3, due_on: "2026-10-09", planned_week: "2026-10-05" });
  });

  it("rejects an empty title", async () => {
    await expect(addAction({ title: "  " })).rejects.toThrow(/title/);
  });
});

describe("goals", () => {
  it("creates a goal with its season plan and the season on demand", async () => {
    const { goal, plan } = await createGoal(Q4, basics("Research proposal"));
    expect(goal).toMatchObject({ rank: 1, status: "active", anti_goals: [] });
    expect(plan.id).toBe(`${goal.id}:${Q4}`);
    expect(await getDb().t("seasons").get(Q4)).toMatchObject({ starts_on: "2026-10-01", ends_on: "2026-12-31" });
    const second = await createGoal(Q4, basics("Run 10 km"));
    expect(second.goal.rank).toBe(2);
  });

  it("validates step 1", async () => {
    await expect(createGoal(Q4, basics("X", { outcome: " " }))).rejects.toThrow(/outcome/);
    await expect(createGoal(Q4, basics("X", { ends_on: "2027-01-05" }))).rejects.toThrow(/inside/);
    await expect(createGoal(Q4, basics("X", { metric_target: 0 }))).rejects.toThrow(/above zero/);
    expect(await getGoalsInSeason(Q4)).toEqual([]);
  });

  it("can be created, left after step 3, and continued", async () => {
    const { goal, plan } = await createGoal(Q4, basics("Launch module"));
    await updateGoalWhy(goal.id, "Students need it", ["Overtime", " "]);
    await saveMajorMoves(plan.id, [{ title: "Outline" }, { title: "Record" }, { title: "Publish" }]);
    // Resume later: edit the moves, then finish steps 4 and 5.
    const moves = await getMajorMoves(plan.id);
    await saveMajorMoves(plan.id, [{ id: moves[2].id, title: "Publish" }, { id: moves[0].id, title: "Outline v2" }]);
    await updateRealityCheck(plan.id, 70, [{ obstacle: "Busy weeks", mitigation: "Block mornings" }, { obstacle: "", mitigation: "" }]);
    await addAction({ title: "Draft outline", goal_id: goal.id, major_move_id: moves[0].id, estimate_pomodoros: 2 });

    const after = await getMajorMoves(plan.id);
    expect(after.map((m) => [m.title, m.sort_order])).toEqual([["Publish", 0], ["Outline v2", 1]]);
    expect((await getDb().t("major_moves").get(moves[1].id))?.deleted_at).not.toBeNull();
    expect(await getDb().t("goals").get(goal.id)).toMatchObject({ why: "Students need it", anti_goals: ["Overtime"] });
    expect(await getDb().t("season_plans").get(plan.id)).toMatchObject({ confidence_pct: 70, obstacles: [{ obstacle: "Busy weeks", mitigation: "Block mornings" }] });
  });

  it("caps major moves at five", async () => {
    const { plan } = await createGoal(Q4, basics("G"));
    await expect(saveMajorMoves(plan.id, ["a", "b", "c", "d", "e", "f"].map((title) => ({ title })))).rejects.toThrow(/5/);
  });

  it("detects a fifth overlapping active goal (soft: saving still works)", async () => {
    for (const t of ["A", "B", "C", "D"]) await createGoal(Q4, basics(t));
    const spans = await getActivePlanSpans();
    expect(wouldExceedConcurrentGoals(spans, { goal_id: "new", starts_on: "2026-11-01", ends_on: "2026-11-30" })).toBe(true);
    await createGoal(Q4, basics("E", { starts_on: "2026-11-01", ends_on: "2026-11-30" }));
    expect(await getGoalsInSeason(Q4)).toHaveLength(5);
    // Once one is achieved it no longer counts.
    const [first] = await getGoalsInSeason(Q4);
    await achieveGoal(first.goal.id);
    expect(wouldExceedConcurrentGoals(await getActivePlanSpans(), { goal_id: "new", starts_on: "2026-11-01", ends_on: "2026-11-30" })).toBe(true);
  });

  it("edits step 1 of an existing goal", async () => {
    const { goal } = await createGoal(Q4, basics("G"));
    await updateGoalBasics(goal.id, Q4, basics("G2", { metric_label: "Pages", metric_target: 40, metric_current: 5 }));
    const [row] = await getGoalsInSeason(Q4);
    expect(row.goal.title).toBe("G2");
    expect(row.plan).toMatchObject({ metric_label: "Pages", metric_target: 40, metric_current: 5 });
  });

  it("achieves a goal and closes its plan", async () => {
    const { goal, plan } = await createGoal(Q4, basics("G"));
    setNow("2026-11-01T00:00:00.000Z");
    await achieveGoal(goal.id);
    expect(await getDb().t("goals").get(goal.id)).toMatchObject({ status: "achieved", closed_at: "2026-11-01T00:00:00.000Z" });
    expect(await getDb().t("season_plans").get(plan.id)).toMatchObject({ resolution: "achieved", resolved_at: "2026-11-01T00:00:00.000Z" });
  });

  it("dropping a goal drops its open actions and deletes their future blocks", async () => {
    const { goal } = await createGoal(Q4, basics("G"));
    const open = await addAction({ title: "Open", goal_id: goal.id });
    const done = await addAction({ title: "Done", goal_id: goal.id });
    await completeAction(done.id);
    const past = await block(open.id, "2026-10-04T01:00:00.000Z", "done");
    const future = await block(open.id, "2026-10-06T01:00:00.000Z");

    await dropGoal(goal.id, "  Priorities changed ");

    expect(await getDb().t("goals").get(goal.id)).toMatchObject({ status: "dropped", drop_reason: "Priorities changed" });
    expect((await getDb().t("actions").get(open.id))?.status).toBe("dropped");
    expect((await getDb().t("actions").get(done.id))?.status).toBe("done");
    expect((await getDb().t("blocks").get(future.id))?.deleted_at).not.toBeNull();
    expect((await getDb().t("blocks").get(past.id))?.deleted_at).toBeNull();
    expect((await getGoalsInSeason(Q4))[0].plan.resolution).toBe("dropped");
  });

  it("reorders the visible goals and renumbers ranks", async () => {
    const ids = [];
    for (const t of ["A", "B", "C"]) ids.push((await createGoal(Q4, basics(t))).goal.id);
    await reorderGoals([ids[2], ids[0], ids[1]]);
    expect((await getGoalsInSeason(Q4)).map((g) => [g.goal.title, g.goal.rank])).toEqual([["C", 1], ["A", 2], ["B", 3]]);
  });

  it("deleting a goal soft-deletes it and everything under it", async () => {
    const { goal, plan } = await createGoal(Q4, basics("G"));
    await saveMajorMoves(plan.id, [{ title: "M" }]);
    const a = await addAction({ title: "A", goal_id: goal.id });
    await deleteGoal(goal.id);
    expect(await getGoalsInSeason(Q4)).toEqual([]);
    expect(await getActionsForGoal(goal.id)).toEqual([]);
    expect(await getMajorMoves(plan.id)).toEqual([]);
    expect((await getDb().t("actions").get(a.id))?.deleted_at).not.toBeNull();
    expect((await getDb().t("goals").get(goal.id))?.deleted_at).not.toBeNull();
  });
});

describe("actions", () => {
  it("marking done sets completed_at and deletes future blocks only", async () => {
    const a = await addAction({ title: "A" });
    const past = await block(a.id, "2026-10-04T00:00:00.000Z", "done");
    const future = await block(a.id, "2026-10-05T05:00:00.000Z");
    setNow("2026-10-05T01:00:00.000Z");
    await completeAction(a.id);
    expect(await getDb().t("actions").get(a.id)).toMatchObject({ status: "done", completed_at: "2026-10-05T01:00:00.000Z" });
    expect((await getDb().t("blocks").get(future.id))?.deleted_at).not.toBeNull();
    expect((await getDb().t("blocks").get(past.id))?.deleted_at).toBeNull();
  });

  it("moves between goals, areas, and moves", async () => {
    const { goal, plan } = await createGoal(Q4, basics("G"));
    await saveMajorMoves(plan.id, [{ title: "M" }]);
    const [move] = await getMajorMoves(plan.id);
    const work = await createArea("Work", "#5B8DEF");
    const a = await addAction({ title: "A" });

    const toGoal = await updateAction(a.id, { goal_id: goal.id, major_move_id: move.id });
    expect(toGoal).toMatchObject({ goal_id: goal.id, area_id: null, major_move_id: move.id });

    const toArea = await updateAction(a.id, { goal_id: null, area_id: work.id });
    expect(toArea).toMatchObject({ goal_id: null, area_id: work.id, major_move_id: null });

    const other = await createGoal(Q4, basics("H"));
    await expect(updateAction(a.id, { goal_id: other.goal.id, major_move_id: move.id })).rejects.toThrow(/not part/);
  });

  it("deleting a move keeps its actions on the goal", async () => {
    const { goal, plan } = await createGoal(Q4, basics("G"));
    await saveMajorMoves(plan.id, [{ title: "M" }]);
    const [move] = await getMajorMoves(plan.id);
    const a = await addAction({ title: "A", goal_id: goal.id, major_move_id: move.id });
    await deleteMajorMove(move.id);
    expect((await getDb().t("actions").get(a.id))?.major_move_id).toBeNull();
  });

  it("reorders, drops, and soft-deletes", async () => {
    const a = await addAction({ title: "A" });
    const b = await addAction({ title: "B" });
    const c = await addAction({ title: "C" });
    await reorderActions([c.id, a.id, b.id]);
    expect((await getActionsForArea(OTHER_AREA_ID)).map((x) => x.title)).toEqual(["C", "A", "B"]);

    await dropAction(a.id);
    expect((await getDb().t("actions").get(a.id))?.status).toBe("dropped");

    await deleteAction(b.id);
    expect((await getActionsForArea(OTHER_AREA_ID)).map((x) => x.title)).toEqual(["C", "A"]);
    expect((await getDb().t("actions").get(b.id))?.deleted_at).not.toBeNull();
  });
});

describe("areas (§5.2)", () => {
  it("creates, reorders, and lists areas", async () => {
    const work = await createArea("  Work ", "#5B8DEF");
    const teach = await createArea("Teaching", "#3DDC97");
    expect(work.name).toBe("Work");
    await expect(createArea("Bad", "#123456")).rejects.toThrow(/colors/);
    await reorderAreas([teach.id, OTHER_AREA_ID, work.id]);
    expect((await getAreas()).map((a) => a.name)).toEqual(["Teaching", "Other", "Work"]);
  });

  it("cannot archive Other", async () => {
    await expect(archiveArea(OTHER_AREA_ID)).rejects.toThrow(/Other/);
  });

  it("asks to move open actions before archiving", async () => {
    const work = await createArea("Work", "#5B8DEF");
    const a = await addAction({ title: "A", area_id: work.id });
    await expect(archiveArea(work.id)).rejects.toThrow(/Move/);
    expect((await getAreas()).some((x) => x.id === work.id)).toBe(true);

    await archiveArea(work.id, OTHER_AREA_ID);
    expect((await getDb().t("actions").get(a.id))?.area_id).toBe(OTHER_AREA_ID);
    expect((await getAreas()).some((x) => x.id === work.id)).toBe(false);
    expect((await getAreas(true)).some((x) => x.id === work.id)).toBe(true);
    expect((await getOpenCountsByArea()).get(OTHER_AREA_ID)).toBe(1);

    await restoreArea(work.id);
    expect((await getAreas()).some((x) => x.id === work.id)).toBe(true);
  });
});
