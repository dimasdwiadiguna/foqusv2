/**
 * Elastic habits (Stage 2 exit, after Stephen Guise): tracked, not scheduled. Three levels, Min,
 * Std, and Elite; any level wins the day. Pure.
 */
import type { DateString, Habit, HabitKind, HabitLog, Weekday } from "@/types";
import { addDays, weekdayOf } from "./time";

export type Level = 0 | 1 | 2 | 3;
export const LEVEL_LABEL: Record<Level, string> = { 0: "Not yet", 1: "Min", 2: "Std", 3: "Elite" };

type Levels = Habit["levels"];

/** A count habit's level: Elite at or above its elite count, then Std, then Min. */
export function countLevel(count: number, levels: Levels): Level {
  const n = (v: number | string) => Number(v);
  if (count >= n(levels.elite)) return 3;
  if (count >= n(levels.std)) return 2;
  if (count >= n(levels.min)) return 1;
  return 0;
}

/** What a level means for this habit: "6 glasses", or the level habit's own label. */
export function levelText(habit: Pick<Habit, "kind" | "levels" | "unit">, level: Exclude<Level, 0>): string {
  const v = level === 1 ? habit.levels.min : level === 2 ? habit.levels.std : habit.levels.elite;
  return habit.kind === "count" ? `${v}${habit.unit ? ` ${habit.unit}` : ""}` : String(v);
}

export interface HabitInput {
  title: string;
  kind: HabitKind;
  unit: string | null;
  levels: Levels;
  weekdays: Weekday[];
}

/** Validate a habit; throws a plain sentence. Returns the cleaned input. */
export function checkHabit(input: HabitInput): HabitInput {
  const title = input.title.trim();
  if (!title) throw new Error("Give the habit a name.");
  if (title.length > 100) throw new Error("Keep the name under 100 characters.");
  const weekdays = [...new Set(input.weekdays)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b) as Weekday[];
  if (weekdays.length === 0) throw new Error("Pick at least one day.");
  if (input.kind === "count") {
    const [min, std, elite] = [input.levels.min, input.levels.std, input.levels.elite].map(Number);
    if (![min, std, elite].every((n) => Number.isInteger(n) && n >= 1 && n <= 1000)) throw new Error("Each level is a whole number from 1 to 1000.");
    if (!(min <= std && std <= elite)) throw new Error("Levels go up: Min, then Std, then Elite.");
    return { title, kind: "count", unit: input.unit?.trim() || null, levels: { min, std, elite }, weekdays };
  }
  const labels = [input.levels.min, input.levels.std, input.levels.elite].map((v) => String(v).trim());
  if (labels.some((l) => !l)) throw new Error("Describe each level, for example “1 stretch”, “10 minutes”, “30 minutes”.");
  if (labels.some((l) => l.length > 40)) throw new Error("Keep each level under 40 characters.");
  return { title, kind: "level", unit: null, levels: { min: labels[0], std: labels[1], elite: labels[2] }, weekdays };
}

type LogLike = Pick<HabitLog, "date" | "level" | "deleted_at">;

/** Day → level, ignoring deleted logs. */
export function levelsByDate(logs: readonly LogLike[]): Map<DateString, Level> {
  const m = new Map<DateString, Level>();
  for (const l of logs) if (!l.deleted_at) m.set(l.date, l.level);
  return m;
}

/**
 * The elastic streak: consecutive expected days with any level, ending today (or yesterday while
 * today is still open). Days the habit is not expected neither count nor break it.
 */
export function habitStreak(weekdays: readonly Weekday[], logs: readonly LogLike[], today: DateString, maxDays = 400): { current: number; today: Level } {
  const by = levelsByDate(logs);
  const todayLevel = by.get(today) ?? 0;
  let current = 0;
  let day = todayLevel > 0 ? today : addDays(today, -1);
  for (let i = 0; i < maxDays; i++, day = addDays(day, -1)) {
    if (!weekdays.includes(weekdayOf(day))) continue;
    if ((by.get(day) ?? 0) === 0) break;
    current++;
  }
  return { current, today: todayLevel };
}

export interface HabitWeek {
  /** Expected days so far (up to and including `until`). */
  expected: number;
  hit: number;
  min: number;
  std: number;
  elite: number;
}

/** One habit over some days (a week, up to today): how often each level was reached. */
export function habitWeek(weekdays: readonly Weekday[], logs: readonly LogLike[], days: readonly DateString[], until: DateString): HabitWeek {
  const by = levelsByDate(logs);
  const out: HabitWeek = { expected: 0, hit: 0, min: 0, std: 0, elite: 0 };
  for (const d of days) {
    if (d > until || !weekdays.includes(weekdayOf(d))) continue;
    out.expected++;
    const l = by.get(d) ?? 0;
    if (l > 0) out.hit++;
    if (l === 1) out.min++;
    if (l === 2) out.std++;
    if (l === 3) out.elite++;
  }
  return out;
}

/** Whether a habit is due on a date. */
export const habitDue = (h: Pick<Habit, "weekdays" | "active" | "archived_at" | "deleted_at">, date: DateString) =>
  h.active && !h.archived_at && !h.deleted_at && h.weekdays.includes(weekdayOf(date));
