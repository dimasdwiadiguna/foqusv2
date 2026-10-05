/** Goal rules (§5.3), progress (§6.7 Goals), and stats (§6.7 goal detail section 8). Pure. */
import type { Action, Block, DateString, Instant, SeasonPlan } from "@/types";
import { addDays } from "./time";

export const MAX_CONCURRENT_GOALS = 4;
export const MAX_MAJOR_MOVES = 5;
export const MAX_OBSTACLES = 3;
export const CONFIDENCE_HINT_BELOW = 80;

export const CONCURRENT_WARNING = "You'll have 5 goals running at once. Focus works better with 4 or fewer.";

type PlanSpan = Pick<SeasonPlan, "goal_id" | "starts_on" | "ends_on">;

/** The largest number of distinct goals whose plans cover the same date. */
export function maxConcurrentGoals(plans: readonly PlanSpan[]): number {
  // Sweep over start (+1) and day-after-end (−1) events; ends are inclusive. One span per goal per
  // date: a goal with two overlapping plans counts once at the dates they share.
  const byGoal = new Map<string, PlanSpan[]>();
  for (const p of plans) byGoal.set(p.goal_id, [...(byGoal.get(p.goal_id) ?? []), p]);
  const events: [DateString, number][] = [];
  for (const spans of byGoal.values()) {
    for (const [start, end] of mergeSpans(spans)) {
      events.push([start, 1], [dayAfter(end), -1]);
    }
  }
  events.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  let open = 0;
  let max = 0;
  for (const [, delta] of events) {
    open += delta;
    max = Math.max(max, open);
  }
  return max;
}

/**
 * §5.3: whether saving `candidate` would leave more than 4 active goals overlapping on some date.
 * `activePlans` are the unresolved plans of active goals; any plan of the candidate's goal is
 * replaced by the candidate.
 */
export function wouldExceedConcurrentGoals(activePlans: readonly PlanSpan[], candidate: PlanSpan): boolean {
  const others = activePlans.filter((p) => p.goal_id !== candidate.goal_id);
  return maxConcurrentGoals([...others, candidate]) > MAX_CONCURRENT_GOALS;
}

/** Plan dates must sit inside the season, start on or before end. Returns a plain sentence or null. */
export function planDatesError(
  startsOn: DateString,
  endsOn: DateString,
  season: { starts_on: DateString; ends_on: DateString },
): string | null {
  if (!startsOn || !endsOn) return "Pick a start and an end date.";
  if (startsOn > endsOn) return "The end date is before the start date.";
  if (startsOn < season.starts_on || endsOn > season.ends_on) return "Keep both dates inside the season.";
  return null;
}

/** Default dates for a new plan: today (or the season's first day if today is outside it) to the season's last day. */
export function defaultPlanDates(today: DateString, season: { starts_on: DateString; ends_on: DateString }) {
  const startsOn = today >= season.starts_on && today <= season.ends_on ? today : season.starts_on;
  return { startsOn, endsOn: season.ends_on };
}

/**
 * Progress for a goal card's ring, 0–1. Metric progress when the plan has a metric target;
 * otherwise completed ÷ estimated pomodoros over the goal's actions that are not dropped.
 */
export function goalProgress(
  plan: Pick<SeasonPlan, "metric_target" | "metric_current">,
  actions: readonly Pick<Action, "id" | "status" | "estimate_pomodoros">[],
  completed: ReadonlyMap<string, number>,
): number {
  if (plan.metric_target !== null && plan.metric_target > 0) {
    return clamp01((plan.metric_current ?? 0) / plan.metric_target);
  }
  let est = 0;
  let done = 0;
  for (const a of actions) {
    if (a.status === "dropped") continue;
    // A done action counts as fully complete even if fewer pomodoros were logged.
    const c = completed.get(a.id) ?? 0;
    est += Math.max(a.estimate_pomodoros, c);
    done += a.status === "done" ? Math.max(a.estimate_pomodoros, c) : Math.min(c, a.estimate_pomodoros);
  }
  return est === 0 ? 0 : clamp01(done / est);
}

export interface GoalStats {
  pomodoros: number;
  /** Focus hours: pomodoros × 25 minutes. */
  hours: number;
  /** Completed ÷ planned pomodoros on ended blocks, 0–1; null when no block has ended yet. */
  followThrough: number | null;
}

type StatBlock = Pick<Block, "status" | "ends_at" | "planned_pomodoros" | "completed_pomodoros" | "deleted_at">;

/** Section 8 of goal detail, over the blocks of the goal's actions. */
export function goalStats(blocks: readonly StatBlock[], now: Instant, focusMinutes = 25): GoalStats {
  const nowMs = Date.parse(now);
  let pomodoros = 0;
  let planned = 0;
  let kept = 0;
  for (const b of blocks) {
    if (b.deleted_at || b.status === "draft") continue;
    pomodoros += b.completed_pomodoros;
    if (Date.parse(b.ends_at) <= nowMs) {
      planned += b.planned_pomodoros;
      kept += Math.min(b.completed_pomodoros, b.planned_pomodoros);
    }
  }
  return {
    pomodoros,
    hours: Math.round(((pomodoros * focusMinutes) / 60) * 10) / 10,
    followThrough: planned === 0 ? null : kept / planned,
  };
}

/** The rank for a newly created goal: after every active goal. */
export function nextRank(activeRanks: readonly number[]): number {
  return activeRanks.length === 0 ? 1 : Math.max(...activeRanks) + 1;
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

function dayAfter(date: DateString): DateString {
  return addDays(date, 1);
}

function mergeSpans(spans: PlanSpan[]): [DateString, DateString][] {
  const sorted = [...spans].sort((a, b) => (a.starts_on < b.starts_on ? -1 : 1));
  const out: [DateString, DateString][] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.starts_on <= dayAfter(last[1])) {
      if (s.ends_on > last[1]) last[1] = s.ends_on;
    } else {
      out.push([s.starts_on, s.ends_on]);
    }
  }
  return out;
}
