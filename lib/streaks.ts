import { addDays, toLocalDate } from "./time";
import type { Block, DailyCheckin, DateString } from "@/types";

/**
 * Streaks (§5.19). Computed from check-ins and blocks; no table. A streak is the run of
 * consecutive counted days ending today, or ending yesterday while today is still open (it only
 * breaks once a whole day passes without counting).
 */
export interface Streak {
  /** Days in the current run. */
  current: number;
  /** Whether today already counts. */
  today: boolean;
}

export const STREAK_MILESTONES = [7, 30, 100] as const;

export function streakFrom(days: Iterable<DateString>, today: DateString): Streak {
  const set = new Set(days);
  const counted = set.has(today);
  let day = counted ? today : addDays(today, -1);
  let current = 0;
  while (set.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  return { current, today: counted };
}

/** Days with a completed check-in. */
export function checkinDays(checkins: readonly Pick<DailyCheckin, "date" | "completed_at" | "deleted_at">[]): DateString[] {
  return checkins.filter((c) => !c.deleted_at && c.completed_at).map((c) => c.date);
}

/**
 * Days with at least one completed pomodoro on a goal action, in the settings time zone. A block
 * counts on the local day it started.
 */
export function focusDays(
  blocks: readonly Pick<Block, "action_id" | "starts_at" | "status" | "completed_pomodoros" | "deleted_at">[],
  goalActionIds: ReadonlySet<string>,
  timeZone: string,
): DateString[] {
  const days = new Set<DateString>();
  for (const b of blocks) {
    if (b.deleted_at || b.status === "draft" || b.completed_pomodoros < 1 || !goalActionIds.has(b.action_id)) continue;
    days.add(toLocalDate(b.starts_at, timeZone));
  }
  return [...days];
}

/** The milestone reached by going from `before` to `after` days, if any. */
export function milestoneReached(before: number, after: number): number | null {
  for (const m of [...STREAK_MILESTONES].reverse()) if (before < m && after >= m) return m;
  return null;
}
