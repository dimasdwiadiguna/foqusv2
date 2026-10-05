/**
 * Day, week, quarter, and week-number math (§3.2.8, §5.1).
 *
 * Pure: every function takes the time zone (from settings) and, where needed, "now" as arguments.
 * Calendar dates are `YYYY-MM-DD` strings and are handled as civil dates with no time zone.
 * Instants are UTC ISO strings. The device's own time zone is never consulted.
 */
import type { DateString, Instant, TimeString, Weekday } from "@/types";
import type { Quarter } from "@/types";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Civil dates (no time zone)

/** Parse `YYYY-MM-DD` into its parts. Throws on a malformed or impossible date. */
export function parseDate(date: DateString): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Invalid date: ${date}`);
  }
  return { year, month, day };
}

export function formatDate(year: number, month: number, day: number): DateString {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

/** Days since 1970-01-01 for a civil date. */
function toDayNumber(date: DateString): number {
  const { year, month, day } = parseDate(date);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function fromDayNumber(n: number): DateString {
  const d = new Date(n * MS_PER_DAY);
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: DateString, days: number): DateString {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: DateString, b: DateString): number {
  return toDayNumber(b) - toDayNumber(a);
}

/** 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: DateString): Weekday {
  // 1970-01-01 was a Thursday (4).
  const n = toDayNumber(date);
  return ((((n + 3) % 7) + 7) % 7) + 1 as Weekday;
}

/** The Monday of the week containing `date`. Weeks run Monday to Sunday. */
export function startOfWeek(date: DateString): DateString {
  return addDays(date, 1 - weekdayOf(date));
}

/** The Sunday of the week containing `date`. */
export function endOfWeek(date: DateString): DateString {
  return addDays(startOfWeek(date), 6);
}

/** The seven dates, Monday first, of the week containing `date`. */
export function weekDates(date: DateString): DateString[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// ---------------------------------------------------------------------------
// Seasons (calendar quarters)

export function quarterOf(date: DateString): { year: number; quarter: Quarter } {
  const { year, month } = parseDate(date);
  return { year, quarter: (Math.floor((month - 1) / 3) + 1) as Quarter };
}

/** Deterministic season id, e.g. `2026-Q4` (§4.1). */
export function seasonId(year: number, quarter: Quarter): string {
  return `${year}-Q${quarter}`;
}

/** Inverse of `seasonId`. Throws on a malformed id. */
export function parseSeasonId(id: string): { year: number; quarter: Quarter } {
  const m = /^(\d{4})-Q([1-4])$/.exec(id);
  if (!m) throw new Error(`Invalid season id: ${id}`);
  return { year: Number(m[1]), quarter: Number(m[2]) as Quarter };
}

/** The season `delta` quarters after (or before, if negative) the given one. */
export function shiftSeason(id: string, delta: number): string {
  const { year, quarter } = parseSeasonId(id);
  const index = year * 4 + (quarter - 1) + delta;
  return seasonId(Math.floor(index / 4), ((index % 4) + 1) as Quarter);
}

/** The season containing a date. */
export function seasonOfDate(date: DateString): string {
  const { year, quarter } = quarterOf(date);
  return seasonId(year, quarter);
}

export function quarterBounds(year: number, quarter: Quarter): { startsOn: DateString; endsOn: DateString } {
  const firstMonth = (quarter - 1) * 3 + 1;
  const startsOn = formatDate(year, firstMonth, 1);
  // Day 0 of the month after the quarter is the quarter's last day.
  const end = new Date(Date.UTC(year, firstMonth + 2, 0));
  return { startsOn, endsOn: formatDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()) };
}

/**
 * Number of Monday-based weeks containing at least one day of the season (§5.1).
 * Q4 2026 has 14.
 */
export function seasonWeekCount(year: number, quarter: Quarter): number {
  const { startsOn, endsOn } = quarterBounds(year, quarter);
  return diffDays(startOfWeek(startsOn), startOfWeek(endsOn)) / 7 + 1;
}

/**
 * The week number of `date` within its season, counting from the week that holds the season's
 * first day (§5.1). 5–11 Oct 2026 is week 2 of Q4 2026.
 */
export function seasonWeekNumber(date: DateString): { year: number; quarter: Quarter; week: number; weeks: number } {
  const { year, quarter } = quarterOf(date);
  const { startsOn } = quarterBounds(year, quarter);
  const week = diffDays(startOfWeek(startsOn), startOfWeek(date)) / 7 + 1;
  return { year, quarter, week, weeks: seasonWeekCount(year, quarter) };
}

// ---------------------------------------------------------------------------
// Instants and time zones

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(ms: number, timeZone: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** The zone's offset from UTC at instant `ms`, in milliseconds (Asia/Jakarta: +7 h). */
function offsetMs(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

function toMs(instant: Instant | Date | number): number {
  if (typeof instant === "number") return instant;
  if (instant instanceof Date) return instant.getTime();
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) throw new Error(`Invalid instant: ${instant}`);
  return ms;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date of an instant in the given zone. */
export function toLocalDate(instant: Instant | Date | number, timeZone: string): DateString {
  const p = zonedParts(toMs(instant), timeZone);
  return formatDate(p.year, p.month, p.day);
}

/** The `HH:MM` clock time of an instant in the given zone. */
export function toLocalTime(instant: Instant | Date | number, timeZone: string): TimeString {
  const p = zonedParts(toMs(instant), timeZone);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Today's date in the given zone. */
export function todayIn(now: Instant | Date | number, timeZone: string): DateString {
  return toLocalDate(now, timeZone);
}

/** Minutes since midnight for `HH:MM`. */
export function parseTime(time: TimeString): number {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || Number(m[1]) > 24 || Number(m[2]) > 59 || (Number(m[1]) === 24 && Number(m[2]) !== 0)) {
    throw new Error(`Invalid time: ${time}`);
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatTime(minutes: number): TimeString {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

/**
 * The instant at which the wall clock in `timeZone` reads `date time`.
 * In a gap (spring-forward) the result is shifted forward by the gap; in an overlap the earlier
 * instant is chosen. `24:00` means the start of the next day.
 */
export function zonedToInstant(date: DateString, time: TimeString, timeZone: string): Instant {
  const { year, month, day } = parseDate(date);
  const wall = Date.UTC(year, month - 1, day) + parseTime(time) * MS_PER_MINUTE;
  // Two passes cover a transition between the guess and the answer.
  const first = wall - offsetMs(wall, timeZone);
  const second = wall - offsetMs(first, timeZone);
  const readsBack = (ms: number) => ms + offsetMs(ms, timeZone) === wall;
  const matches = [first, second].filter(readsBack);
  // Overlap: take the earlier instant. Gap: no candidate matches; take the later one (after the jump).
  const ms = matches.length > 0 ? Math.min(...matches) : Math.max(first, second);
  return new Date(ms).toISOString();
}

/** The instants at which `date` starts and ends (exclusive) in the given zone. */
export function dayBounds(date: DateString, timeZone: string): { start: Instant; end: Instant } {
  return { start: zonedToInstant(date, "00:00", timeZone), end: zonedToInstant(addDays(date, 1), "00:00", timeZone) };
}

export function addMinutes(instant: Instant, minutes: number): Instant {
  return new Date(toMs(instant) + minutes * MS_PER_MINUTE).toISOString();
}

// ---------------------------------------------------------------------------
// Display

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function weekdayShort(weekday: Weekday): string {
  return WEEKDAY_SHORT[weekday - 1];
}

/** "Mon 5 Oct" */
export function formatDayHeader(date: DateString): string {
  const { month, day } = parseDate(date);
  return `${weekdayShort(weekdayOf(date))} ${day} ${MONTH_SHORT[month - 1]}`;
}

/** "5 – 11 Oct", or "28 Sep – 4 Oct" across a month boundary. */
export function formatWeekRange(date: DateString): string {
  const start = parseDate(startOfWeek(date));
  const end = parseDate(endOfWeek(date));
  return start.month === end.month
    ? `${start.day} – ${end.day} ${MONTH_SHORT[end.month - 1]}`
    : `${start.day} ${MONTH_SHORT[start.month - 1]} – ${end.day} ${MONTH_SHORT[end.month - 1]}`;
}

/** "30 Nov" */
export function formatShortDate(date: DateString): string {
  const { month, day } = parseDate(date);
  return `${day} ${MONTH_SHORT[month - 1]}`;
}

/** "1 Oct – 31 Dec" */
export function formatDateRange(start: DateString, end: DateString): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** "Q4 2026" */
export function formatSeason(id: string): string {
  const { year, quarter } = parseSeasonId(id);
  return `Q${quarter} ${year}`;
}

/** "Q4 2026 · Week 2 of 14" */
export function formatSeasonWeek(date: DateString): string {
  const { year, quarter, week, weeks } = seasonWeekNumber(date);
  return `Q${quarter} ${year} · Week ${week} of ${weeks}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
