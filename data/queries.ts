/**
 * Read queries. Every read filters out soft-deleted rows (§3.2.3). Hooks in this folder wrap these
 * in live queries so screens update when the data changes.
 */
import { getDb } from "@/db";
import { SETTINGS_ID } from "@/db/seed";
import type { Action, Area, Block, Goal, MajorMove, Season, SeasonPlan, Settings, TableName, Tables } from "@/types";
import { completedByAction } from "@/lib/actions";

export async function getRow<N extends TableName>(table: N, id: string): Promise<Tables[N] | undefined> {
  const row = await getDb().t(table).get(id);
  return row && !row.deleted_at ? row : undefined;
}

export async function getAllRows<N extends TableName>(table: N): Promise<Tables[N][]> {
  return getDb()
    .t(table)
    .filter((row) => !row.deleted_at)
    .toArray();
}

export function getSettings(): Promise<Settings | undefined> {
  return getRow("settings", SETTINGS_ID);
}

// ---------------------------------------------------------------------------
// Step 1.2: areas, seasons, goals, actions


async function liveWhere<N extends TableName>(table: N, index: string, value: string): Promise<Tables[N][]> {
  return (await getDb().t(table).where(index).equals(value).toArray()).filter((r) => !r.deleted_at);
}

const bySortOrder = <T extends { sort_order: number; created_at: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

/** Areas in their sort order. Archived areas only when asked. */
export async function getAreas(includeArchived = false): Promise<Area[]> {
  const all = await getAllRows("areas");
  return all.filter((a) => includeArchived || !a.archived_at).sort(bySortOrder);
}

export async function getSeasons(): Promise<Season[]> {
  return (await getAllRows("seasons")).sort((a, b) => a.id.localeCompare(b.id));
}

export interface GoalWithPlan {
  goal: Goal;
  plan: SeasonPlan;
}

/** Goals that have a plan in this season: active by rank, then closed goals by when they closed. */
export async function getGoalsInSeason(seasonId: string): Promise<GoalWithPlan[]> {
  const plans = await liveWhere("season_plans", "season_id", seasonId);
  const out: GoalWithPlan[] = [];
  for (const plan of plans) {
    const goal = await getRow("goals", plan.goal_id);
    if (goal) out.push({ goal, plan });
  }
  return out.sort((a, b) => {
    const aActive = a.goal.status === "active" ? 0 : 1;
    const bActive = b.goal.status === "active" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    if (aActive === 0) return a.goal.rank - b.goal.rank || a.goal.created_at.localeCompare(b.goal.created_at);
    return (b.goal.closed_at ?? "").localeCompare(a.goal.closed_at ?? "");
  });
}

export function getPlansForGoal(goalId: string): Promise<SeasonPlan[]> {
  return liveWhere("season_plans", "goal_id", goalId).then((p) => p.sort((a, b) => a.season_id.localeCompare(b.season_id)));
}

export async function getMajorMoves(planId: string): Promise<MajorMove[]> {
  return (await liveWhere("major_moves", "season_plan_id", planId)).sort(bySortOrder);
}

export async function getActionsForGoal(goalId: string): Promise<Action[]> {
  return (await liveWhere("actions", "goal_id", goalId)).sort(bySortOrder);
}

export async function getActionsForArea(areaId: string): Promise<Action[]> {
  return (await liveWhere("actions", "area_id", areaId)).sort(bySortOrder);
}

export async function getBlocksForActions(actionIds: readonly string[]): Promise<Block[]> {
  if (actionIds.length === 0) return [];
  return (await getDb().t("blocks").where("action_id").anyOf([...actionIds]).toArray()).filter((b) => !b.deleted_at);
}

/** Completed pomodoros per action, across all blocks. */
export async function getCompletedByAction(): Promise<Map<string, number>> {
  return completedByAction(await getAllRows("blocks"));
}

/** Unresolved season plans of active goals: the input to the concurrent-goal warning (§5.3). */
export async function getActivePlanSpans(): Promise<SeasonPlan[]> {
  const active = new Set(
    (await getDb().t("goals").where("status").equals("active").toArray()).filter((g) => !g.deleted_at).map((g) => g.id),
  );
  return (await getAllRows("season_plans")).filter((p) => p.resolution === null && active.has(p.goal_id));
}

/** Count of open (todo) area tasks per area. */
export async function getOpenCountsByArea(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const a of await getDb().t("actions").where("status").equals("todo").toArray()) {
    if (a.deleted_at || !a.area_id) continue;
    out.set(a.area_id, (out.get(a.area_id) ?? 0) + 1);
  }
  return out;
}

/** Active goals in rank order (for pickers). */
export async function getActiveGoals(): Promise<Goal[]> {
  return (await getDb().t("goals").where("status").equals("active").toArray())
    .filter((g) => !g.deleted_at)
    .sort((a, b) => a.rank - b.rank);
}

/** Open major moves of a goal's unresolved plans (for pickers). */
export async function getMovesForGoal(goalId: string): Promise<MajorMove[]> {
  const plans = (await getPlansForGoal(goalId)).filter((p) => p.resolution === null);
  const moves: MajorMove[] = [];
  for (const p of plans) moves.push(...(await getMajorMoves(p.id)));
  return moves;
}
