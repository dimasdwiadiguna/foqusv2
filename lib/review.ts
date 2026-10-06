/** When the weekly review (§5.15) is available, and which week it plans. Pure. */
import type { DateString } from "@/types";
import { addDays, startOfWeek, weekdayOf } from "./time";

/**
 * The week a review made today looks back on: this week from Sunday, otherwise last week. It stays
 * available until it is done; the next Sunday the following week's review takes its place.
 */
export function reviewWeekFor(today: DateString): DateString {
  return weekdayOf(today) === 7 ? startOfWeek(today) : addDays(startOfWeek(today), -7);
}

/** The week a review of `weekStart` plans: the one after it. */
export const planWeekFor = (weekStart: DateString) => addDays(weekStart, 7);

/**
 * The review that is due today, or null: available, not completed, and the week had something in
 * it (blocks or check-ins), so a brand-new install is not asked to review an empty week.
 */
export function dueReview(today: DateString, completed: ReadonlySet<DateString>, hadActivity: (week: DateString) => boolean): DateString | null {
  const week = reviewWeekFor(today);
  return !completed.has(week) && hadActivity(week) ? week : null;
}
