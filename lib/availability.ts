/**
 * Free time per day (§5.6). Pure: takes the schedule, blocks, external events, and "now".
 *
 *   free(day) = availability window − personal blocks − blocking external events
 *             − committed FOQUS blocks and their buffers − (for today) anything before now,
 *               rounded up to the next 5 minutes
 */
import type { Block, DateString, Instant, PersonalBlock, TimeString } from "@/types";
import { ceilTo, MINUTE, normalize, subtract, type Interval } from "./intervals";
import { addDays, weekdayOf, zonedToInstant } from "./time";

export const SNAP_MINUTES = 5;
export const POMODORO_MINUTES = 30;

export interface DayWindow {
  start_time: TimeString;
  end_time: TimeString;
}

/** An external event as the scheduling logic sees it. Only blocking events are passed in. */
export interface BusyEvent {
  title: string;
  calendar?: string;
  starts_at: Instant;
  ends_at: Instant;
  all_day: boolean;
}

export type ScheduleBlock = Pick<
  Block,
  "id" | "action_id" | "starts_at" | "ends_at" | "buffer_minutes" | "status" | "planned_pomodoros" | "deleted_at"
>;

const ms = (instant: Instant) => Date.parse(instant);

/** The instants a day starts and ends in the zone. */
export function daySpan(date: DateString, timeZone: string): Interval {
  return { start: ms(zonedToInstant(date, "00:00", timeZone)), end: ms(zonedToInstant(addDays(date, 1), "00:00", timeZone)) };
}

/** A daily window (`HH:MM`–`HH:MM`) on a date. Empty when start is not before end. */
export function windowSpan(date: DateString, window: DayWindow | undefined, timeZone: string): Interval | null {
  if (!window || window.start_time >= window.end_time) return null;
  return { start: ms(zonedToInstant(date, window.start_time, timeZone)), end: ms(zonedToInstant(date, window.end_time, timeZone)) };
}

type PersonalLike = Pick<PersonalBlock, "label" | "weekdays" | "start_time" | "end_time" | "active" | "deleted_at">;

/** Active personal blocks that fall on this date, as intervals with their labels. */
export function personalSpans(date: DateString, personal: readonly PersonalLike[], timeZone: string): (Interval & { label: string })[] {
  const weekday = weekdayOf(date);
  const out: (Interval & { label: string })[] = [];
  for (const p of personal) {
    if (!p.active || p.deleted_at || !p.weekdays.includes(weekday)) continue;
    const span = windowSpan(date, p, timeZone);
    if (span) out.push({ ...span, label: p.label });
  }
  return out;
}

/** Statuses whose time is taken on the timeline. Missed blocks were resolved and free their time. */
export function occupies(b: Pick<Block, "status" | "deleted_at">): boolean {
  return !b.deleted_at && b.status !== "missed";
}

/** Committed statuses (§5.6 uses committed blocks; drafts are reserved by the draft itself). */
export function isCommitted(b: Pick<Block, "status" | "deleted_at">): boolean {
  return !b.deleted_at && (b.status === "scheduled" || b.status === "active" || b.status === "done");
}

export function blockSpan(b: Pick<Block, "starts_at" | "ends_at">): Interval {
  return { start: ms(b.starts_at), end: ms(b.ends_at) };
}

export function bufferSpan(b: Pick<Block, "ends_at" | "buffer_minutes">): Interval {
  const end = ms(b.ends_at);
  return { start: end, end: end + b.buffer_minutes * MINUTE };
}

/** Timed (not all-day) events as intervals. All-day events block nothing. */
export function eventSpans(events: readonly BusyEvent[]): Interval[] {
  return events.filter((e) => !e.all_day).map((e) => ({ start: ms(e.starts_at), end: ms(e.ends_at) }));
}

export interface FreeInput {
  date: DateString;
  timeZone: string;
  availability: DayWindow | undefined;
  personal: readonly PersonalLike[];
  /** Blocking external events; an empty list until Stage 4. */
  events: readonly BusyEvent[];
  blocks: readonly ScheduleBlock[];
  now: Instant;
  /** Ignore this block (the one being moved). */
  excludeBlockId?: string;
}

/** Free intervals on a day (§5.6). */
export function freeIntervals(input: FreeInput): Interval[] {
  const window = windowSpan(input.date, input.availability, input.timeZone);
  if (!window) return [];
  const busy: Interval[] = [
    ...personalSpans(input.date, input.personal, input.timeZone),
    ...eventSpans(input.events),
    ...input.blocks
      .filter((b) => isCommitted(b) && b.id !== input.excludeBlockId)
      .map((b) => ({ start: ms(b.starts_at), end: ms(b.ends_at) + b.buffer_minutes * MINUTE })),
    // Anything before now, rounded up to the next 5 minutes.
    { start: Number.MIN_SAFE_INTEGER, end: ceilTo(ms(input.now), SNAP_MINUTES) },
  ];
  return subtract([window], busy);
}

/** Free minutes on a day. */
export function freeMinutes(input: FreeInput): number {
  return normalize(freeIntervals(input)).reduce((n, i) => n + (i.end - i.start) / MINUTE, 0);
}

/** The earliest start in `free` with room for `minutes` (plus an optional buffer), or null. */
export function firstFreeStart(free: readonly Interval[], minutes: number, bufferMinutes = 0): number | null {
  const need = (minutes + bufferMinutes) * MINUTE;
  for (const f of normalize(free)) if (f.end - f.start >= need) return f.start;
  return null;
}

/** `00:00`, `00:05`, … `23:55`: the 5-minute grid for time pickers. */
export const TIME_OPTIONS: string[] = Array.from({ length: (24 * 60) / SNAP_MINUTES }, (_, i) => {
  const m = i * SNAP_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
