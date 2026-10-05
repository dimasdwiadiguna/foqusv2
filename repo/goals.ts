/**
 * Goals, season plans, and major moves (§5.3). Every multi-row change runs in one transaction.
 */
import { getDb } from "@/db";
import { cleanTitle } from "@/lib/actions";
import { MAX_MAJOR_MOVES, MAX_OBSTACLES, nextRank, planDatesError } from "@/lib/goals";
import { seasonPlanId } from "@/lib/ids";
import { nextOrder, reorderSubset } from "@/lib/order";
import type { Goal, MajorMove, Obstacle, SeasonPlan, TableName } from "@/types";
import { deleteAllBlocks, deleteFutureBlocks } from "./blocks";
import { nowInstant } from "./clock";
import { createRow, softDelete, updateRow } from "./rows";
import { ensureSeason } from "./seasons";
import { liveWhere, writeTx } from "./tx";

const GOAL_TABLES: TableName[] = ["goals", "season_plans", "major_moves", "actions", "blocks", "seasons", "areas"];

/** Step 1 of the wizard: what is needed to create or edit a goal and its season plan. */
export interface GoalBasics {
  title: string;
  area_id: string | null;
  outcome: string;
  metric_label: string | null;
  metric_target: number | null;
  metric_current: number | null;
  starts_on: string;
  ends_on: string;
}

export const planId = seasonPlanId;

function cleanText(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t ? t : null;
}

function cleanNumber(n: number | null | undefined): number | null {
  return n === null || n === undefined || !Number.isFinite(n) ? null : n;
}

async function checkBasics(basics: GoalBasics, seasonId: string) {
  const season = await ensureSeason(seasonId);
  const title = cleanTitle(basics.title);
  const outcome = cleanText(basics.outcome);
  if (!outcome) throw new Error("Describe the outcome you want this season.");
  const datesError = planDatesError(basics.starts_on, basics.ends_on, season);
  if (datesError) throw new Error(datesError);
  if (basics.area_id) {
    const area = await getDb().t("areas").get(basics.area_id);
    if (!area || area.deleted_at) throw new Error("That area no longer exists.");
  }
  const metric_target = cleanNumber(basics.metric_target);
  if (metric_target !== null && metric_target <= 0) throw new Error("A metric target must be above zero.");
  return {
    goal: { title, area_id: basics.area_id },
    plan: {
      outcome,
      metric_label: cleanText(basics.metric_label),
      metric_target,
      metric_current: cleanNumber(basics.metric_current),
      starts_on: basics.starts_on,
      ends_on: basics.ends_on,
    },
  };
}

async function activeGoals(): Promise<Goal[]> {
  return (await getDb().t("goals").where("status").equals("active").toArray()).filter((g) => !g.deleted_at);
}

/** Create a goal with its season plan (wizard step 1). The goal goes last in rank. */
export async function createGoal(seasonId: string, basics: GoalBasics): Promise<{ goal: Goal; plan: SeasonPlan }> {
  const clean = await checkBasics(basics, seasonId);
  return writeTx(GOAL_TABLES, async () => {
    const goal = await createRow("goals", {
      ...clean.goal,
      why: null,
      anti_goals: [],
      rank: nextRank((await activeGoals()).map((g) => g.rank)),
      status: "active",
      closed_at: null,
      drop_reason: null,
    });
    const plan = await createRow("season_plans", {
      id: planId(goal.id, seasonId),
      goal_id: goal.id,
      season_id: seasonId,
      ...clean.plan,
      confidence_pct: null,
      obstacles: [],
      resolution: null,
      resolved_at: null,
    });
    return { goal, plan };
  });
}

/** Edit what step 1 covers for an existing goal and its plan in `seasonId`. */
export async function updateGoalBasics(goalId: string, seasonId: string, basics: GoalBasics): Promise<void> {
  const clean = await checkBasics(basics, seasonId);
  await writeTx(GOAL_TABLES, async () => {
    await updateRow("goals", goalId, clean.goal);
    await updateRow("season_plans", planId(goalId, seasonId), clean.plan);
  });
}

/** Wizard step 2: why and anti-goals. Empty anti-goals are dropped. */
export async function updateGoalWhy(goalId: string, why: string | null, antiGoals: readonly string[]): Promise<Goal> {
  return updateRow("goals", goalId, {
    why: cleanText(why),
    anti_goals: antiGoals.map((a) => a.trim()).filter(Boolean),
  });
}

/** Wizard step 4: confidence and up to three obstacles with mitigations. */
export async function updateRealityCheck(
  planIdValue: string,
  confidencePct: number | null,
  obstacles: readonly Obstacle[],
): Promise<SeasonPlan> {
  const cleaned = obstacles
    .map((o) => ({ obstacle: o.obstacle.trim(), mitigation: o.mitigation.trim() }))
    .filter((o) => o.obstacle || o.mitigation);
  if (cleaned.length > MAX_OBSTACLES) throw new Error(`List at most ${MAX_OBSTACLES} obstacles.`);
  const confidence = confidencePct === null ? null : Math.min(100, Math.max(0, Math.round(confidencePct)));
  return updateRow("season_plans", planIdValue, { confidence_pct: confidence, obstacles: cleaned });
}

/** Update the metric's current value from goal detail. */
export async function updateMetricCurrent(planIdValue: string, current: number | null): Promise<SeasonPlan> {
  return updateRow("season_plans", planIdValue, { metric_current: cleanNumber(current) });
}

// ---------------------------------------------------------------------------
// Major moves

async function liveMoves(planIdValue: string): Promise<MajorMove[]> {
  return liveWhere("major_moves", "season_plan_id", planIdValue);
}

/**
 * Wizard step 3: make the plan's major moves match `items` in order. Items with an id are renamed,
 * items without are created, and live moves not listed are deleted (their actions stay on the goal,
 * without a move).
 */
export async function saveMajorMoves(planIdValue: string, items: readonly { id?: string; title: string }[]): Promise<void> {
  const wanted = items.map((i) => ({ ...i, title: i.title.trim() })).filter((i) => i.title);
  if (wanted.length > MAX_MAJOR_MOVES) throw new Error(`Keep it to ${MAX_MAJOR_MOVES} major moves or fewer.`);
  await writeTx(GOAL_TABLES, async () => {
    const existing = await liveMoves(planIdValue);
    const keep = new Set(wanted.map((w) => w.id).filter(Boolean));
    for (const m of existing) if (!keep.has(m.id)) await deleteMajorMove(m.id);
    for (const [i, w] of wanted.entries()) {
      const current = w.id ? existing.find((m) => m.id === w.id) : undefined;
      if (current) {
        if (current.title !== w.title || current.sort_order !== i) {
          await updateRow("major_moves", current.id, { title: cleanTitle(w.title), sort_order: i });
        }
      } else {
        await createRow("major_moves", { season_plan_id: planIdValue, title: cleanTitle(w.title), sort_order: i, status: "open" });
      }
    }
  });
}

export async function addMajorMove(planIdValue: string, title: string): Promise<MajorMove> {
  return writeTx(GOAL_TABLES, async () => {
    const moves = await liveMoves(planIdValue);
    if (moves.length >= MAX_MAJOR_MOVES) throw new Error(`Keep it to ${MAX_MAJOR_MOVES} major moves or fewer.`);
    return createRow("major_moves", {
      season_plan_id: planIdValue,
      title: cleanTitle(title),
      sort_order: nextOrder(moves.map((m) => m.sort_order)),
      status: "open",
    });
  });
}

export async function setMajorMoveDone(id: string, done: boolean): Promise<MajorMove> {
  return updateRow("major_moves", id, { status: done ? "done" : "open" });
}

/** Soft-delete a move. Its actions stay on the goal, without a move. */
export async function deleteMajorMove(id: string): Promise<void> {
  await writeTx(GOAL_TABLES, async () => {
    const move = await getDb().t("major_moves").get(id);
    const plan = move ? await getDb().t("season_plans").get(move.season_plan_id) : undefined;
    if (plan) {
      for (const a of await liveWhere("actions", "goal_id", plan.goal_id)) {
        if (a.major_move_id === id) await updateRow("actions", a.id, { major_move_id: null });
      }
    }
    await softDelete("major_moves", id);
  });
}

// ---------------------------------------------------------------------------
// Closing goals

async function unresolvedPlans(goalId: string): Promise<SeasonPlan[]> {
  return (await liveWhere("season_plans", "goal_id", goalId)).filter((p) => p.resolution === null);
}

/** Mark a goal achieved (§5.3). Closes its open season plans. */
export async function achieveGoal(goalId: string): Promise<void> {
  await writeTx(GOAL_TABLES, async () => {
    const now = nowInstant();
    await updateRow("goals", goalId, { status: "achieved", closed_at: now });
    for (const p of await unresolvedPlans(goalId)) {
      await updateRow("season_plans", p.id, { resolution: "achieved", resolved_at: now });
    }
  });
}

/**
 * Drop a goal (§5.3): optional reason, open actions marked dropped, their future blocks deleted,
 * open season plans closed as dropped.
 */
export async function dropGoal(goalId: string, reason: string | null): Promise<void> {
  await writeTx(GOAL_TABLES, async () => {
    const now = nowInstant();
    await updateRow("goals", goalId, { status: "dropped", closed_at: now, drop_reason: cleanText(reason) });
    for (const p of await unresolvedPlans(goalId)) {
      await updateRow("season_plans", p.id, { resolution: "dropped", resolved_at: now });
    }
    const open = (await liveWhere("actions", "goal_id", goalId)).filter((a) => a.status === "todo");
    for (const a of open) await updateRow("actions", a.id, { status: "dropped" });
    await deleteFutureBlocks((await liveWhere("actions", "goal_id", goalId)).map((a) => a.id), now);
  });
}

/** Delete a goal and everything under it (soft). For goals created by mistake. */
export async function deleteGoal(goalId: string): Promise<void> {
  await writeTx(GOAL_TABLES, async () => {
    const actions = await liveWhere("actions", "goal_id", goalId);
    await deleteAllBlocks(actions.map((a) => a.id));
    for (const a of actions) await softDelete("actions", a.id);
    for (const p of await liveWhere("season_plans", "goal_id", goalId)) {
      for (const m of await liveMoves(p.id)) await softDelete("major_moves", m.id);
      await softDelete("season_plans", p.id);
    }
    await softDelete("goals", goalId);
  });
}

/**
 * Rank by drag (§5.3): `visibleOrder` is the new order of the goals shown (one season's active
 * goals). Ranks of all active goals are renumbered 1…n, keeping goals not shown in their places.
 */
export async function reorderGoals(visibleOrder: readonly string[]): Promise<void> {
  await writeTx(["goals"], async () => {
    const active = (await activeGoals()).sort((a, b) => a.rank - b.rank || a.created_at.localeCompare(b.created_at));
    const order = reorderSubset(
      active.map((g) => g.id),
      visibleOrder,
    );
    for (const [i, id] of order.entries()) {
      const g = active.find((x) => x.id === id);
      if (g && g.rank !== i + 1) await updateRow("goals", id, { rank: i + 1 });
    }
  });
}
