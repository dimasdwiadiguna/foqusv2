/** The quarterly review (§5.16): when it is due, and what must be resolved before it can finish. Pure. */
import type { DateString, Goal, SeasonPlan } from "@/types";
import { diffDays, parseSeasonId, quarterBounds, seasonOfDate, shiftSeason } from "./time";

/** The prompt starts this many days before the quarter's last day. */
export const QUARTERLY_LEAD_DAYS = 7;

/** The first day the review of `season` is prompted (24 December for Q4 2026). */
export function quarterlyOpensOn(season: string): DateString {
  const { year, quarter } = parseSeasonId(season);
  const { endsOn } = quarterBounds(year, quarter);
  const d = new Date(`${endsOn}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - QUARTERLY_LEAD_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * The season whose review is due today, or null: this season from 7 days before its end, or the
 * previous one while it is still not done. Only seasons that had goals are reviewed.
 */
export function quarterlyDue(today: DateString, reviewed: ReadonlySet<string>, hadGoals: (season: string) => boolean): string | null {
  const current = seasonOfDate(today);
  const { year, quarter } = parseSeasonId(current);
  if (diffDays(today, quarterBounds(year, quarter).endsOn) <= QUARTERLY_LEAD_DAYS && !reviewed.has(current) && hadGoals(current)) return current;
  const previous = shiftSeason(current, -1);
  return !reviewed.has(previous) && hadGoals(previous) ? previous : null;
}

/** Active goals with an unresolved plan in `season`: each must be carried over, closed, or dropped. */
export function goalsToResolve<G extends Pick<Goal, "id" | "status" | "deleted_at">>(
  season: string,
  goals: readonly G[],
  plans: readonly Pick<SeasonPlan, "goal_id" | "season_id" | "resolution" | "deleted_at">[],
): G[] {
  return goals.filter(
    (g) => !g.deleted_at && g.status === "active" && plans.some((p) => !p.deleted_at && p.goal_id === g.id && p.season_id === season && p.resolution === null),
  );
}

/** The season note (§5.16 step 4) is stored as one text with two headed parts. */
export function joinSeasonNote(worked: string, change: string): string | null {
  const parts = [worked.trim() ? `What worked:\n${worked.trim()}` : "", change.trim() ? `What to change:\n${change.trim()}` : ""].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}

export function splitSeasonNote(note: string | null): { worked: string; change: string } {
  const worked = /What worked:\n([\s\S]*?)(?:\n\nWhat to change:|$)/.exec(note ?? "")?.[1] ?? "";
  const change = /What to change:\n([\s\S]*)$/.exec(note ?? "")?.[1] ?? "";
  return { worked, change };
}
