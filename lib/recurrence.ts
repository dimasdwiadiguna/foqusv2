/**
 * Recurring actions (§5.5). A rule generates one action per matching weekday of a week. Pure: the
 * caller passes the week and "today".
 */
import type { DateString, RecurrenceRule, TimeString, Weekday } from "@/types";
import { MAX_ESTIMATE } from "./actions";
import { weekDates, weekdayOf } from "./time";

export type RuleLike = Pick<RecurrenceRule, "weekdays" | "starts_on" | "ends_on" | "active" | "deleted_at">;

/**
 * The dates in `weekStart`'s week this rule generates an occurrence for: matching weekdays inside
 * the rule's dates, from `today` on (days already past are never generated).
 */
export function occurrenceDates(rule: RuleLike, weekStart: DateString, today: DateString): DateString[] {
  if (!rule.active || rule.deleted_at) return [];
  return weekDates(weekStart).filter(
    (d) => d >= today && d >= rule.starts_on && (rule.ends_on === null || d <= rule.ends_on) && rule.weekdays.includes(weekdayOf(d)),
  );
}

export interface RuleInput {
  title: string;
  weekdays: Weekday[];
  pomodoros: number;
  preferred_start: TimeString | null;
  starts_on: DateString;
  ends_on: DateString | null;
}

/** Validate a rule; throws a plain sentence. Returns the cleaned rule. */
export function checkRule(input: RuleInput, maxPerBlock: number): RuleInput {
  const title = input.title.trim();
  if (!title) throw new Error("Give the recurring action a title.");
  const weekdays = [...new Set(input.weekdays)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b) as Weekday[];
  if (weekdays.length === 0) throw new Error("Pick at least one day.");
  if (!Number.isInteger(input.pomodoros) || input.pomodoros < 1 || input.pomodoros > Math.min(maxPerBlock, MAX_ESTIMATE)) {
    throw new Error(`Each occurrence is 1 to ${maxPerBlock} pomodoros.`);
  }
  if (input.preferred_start !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.preferred_start)) throw new Error("The preferred time is not a valid time.");
  if (input.ends_on !== null && input.ends_on < input.starts_on) throw new Error("The end date is before the start date.");
  return { ...input, title, weekdays };
}

/** "Mon, Wed, Fri", "Weekdays", "Every day". */
export function formatWeekdays(days: readonly Weekday[]): string {
  const key = [...days].sort().join("");
  if (key === "1234567") return "Every day";
  if (key === "12345") return "Weekdays";
  if (key === "67") return "Weekends";
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return [...days].sort().map((d) => names[d - 1]).join(", ");
}
