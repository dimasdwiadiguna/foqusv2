/**
 * The quarterly review (§5.16). Each active goal is carried over, closed, or dropped; the review
 * cannot finish until all of them are.
 */
import { getDb } from "@/db";
import { goalsToResolve, joinSeasonNote } from "@/lib/quarterly";
import { parseSeasonId, quarterBounds, shiftSeason } from "@/lib/time";
import type { SeasonPlan } from "@/types";
import { nowInstant } from "./clock";
import { planId } from "./goals";
import { createRow, updateRow } from "./rows";
import { ensureSeason } from "./seasons";
import { ALL_TABLES, liveWhere, writeTx } from "./tx";

/**
 * Carry a goal over into the next season: a new season plan pre-filled from this one (outcome,
 * metric, confidence, obstacles) spanning the next quarter, with every unfinished major move moved
 * to it. Open actions belong to the goal, so they come along. This season's plan is closed as
 * `carried`. Recurring rules that ended with the old plan now end with the new one.
 */
export async function carryOverGoal(goalId: string, season: string): Promise<SeasonPlan> {
  const next = shiftSeason(season, 1);
  await ensureSeason(next);
  return writeTx(ALL_TABLES, async () => {
    const goal = await getDb().t("goals").get(goalId);
    if (!goal || goal.deleted_at || goal.status !== "active") throw new Error("That goal is no longer active.");
    const old = await getDb().t("season_plans").get(planId(goalId, season));
    if (!old || old.deleted_at) throw new Error("This goal has no plan in that season.");
    const { year, quarter } = parseSeasonId(next);
    const { startsOn, endsOn } = quarterBounds(year, quarter);
    const newId = planId(goalId, next);
    let plan = await getDb().t("season_plans").get(newId);
    if (!plan || plan.deleted_at) {
      plan = await createRow("season_plans", {
        id: newId,
        goal_id: goalId,
        season_id: next,
        outcome: old.outcome,
        metric_label: old.metric_label,
        metric_target: old.metric_target,
        metric_current: old.metric_current,
        starts_on: startsOn,
        ends_on: endsOn,
        confidence_pct: old.confidence_pct,
        obstacles: old.obstacles,
        resolution: null,
        resolved_at: null,
      });
    }
    for (const m of await liveWhere("major_moves", "season_plan_id", old.id)) {
      if (m.status === "open") await updateRow("major_moves", m.id, { season_plan_id: newId });
    }
    if (old.resolution === null) await updateRow("season_plans", old.id, { resolution: "carried", resolved_at: nowInstant() });
    for (const r of await liveWhere("recurrence_rules", "goal_id", goalId)) {
      if (r.ends_on === old.ends_on) await updateRow("recurrence_rules", r.id, { ends_on: endsOn });
    }
    return plan;
  });
}

/** Step 4: the season note (what worked, what to change). */
export async function saveSeasonNote(season: string, worked: string, change: string): Promise<void> {
  const w = worked.trim();
  const c = change.trim();
  if (w.length + c.length > 4000) throw new Error("Keep the season note under 4000 characters.");
  await ensureSeason(season);
  const note = joinSeasonNote(w, c);
  await updateRow("seasons", season, { review_note: note || null });
}

/** Finish the review. Refused while any active goal of the season is unresolved. */
export async function finishQuarterlyReview(season: string): Promise<void> {
  const goals = await getDb().t("goals").toArray();
  const plans = await getDb().t("season_plans").toArray();
  const open = goalsToResolve(season, goals, plans).sort((a, b) => a.rank - b.rank);
  if (open.length) throw new Error(`Resolve every goal first: ${open.map((g) => g.title).join(", ")}.`);
  await ensureSeason(season);
  await updateRow("seasons", season, { reviewed_at: nowInstant() });
}
