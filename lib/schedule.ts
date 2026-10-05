/** Validation for availability, peak windows, and personal blocks (§4.2, §5.6). Pure. */
import type { Weekday } from "@/types";

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;

/** Throws a plain sentence unless `start`–`end` is a valid same-day span on the 5-minute grid. */
export function checkWindow(start: string, end: string, what = "The window"): void {
  if (!TIME.test(start) || !TIME.test(end)) throw new Error("Use times like 05:00.");
  if (Number(start.slice(3)) % 5 || Number(end.slice(3)) % 5) throw new Error("Use times on 5-minute steps.");
  if (start >= end) throw new Error(`${what} has to end after it starts.`);
}

export function checkWeekdays(days: readonly number[]): Weekday[] {
  const unique = [...new Set(days)].filter((d): d is Weekday => Number.isInteger(d) && d >= 1 && d <= 7).sort();
  if (unique.length === 0) throw new Error("Pick at least one day.");
  return unique;
}

export const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
