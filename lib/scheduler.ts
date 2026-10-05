/**
 * Slot picking (§5.11). Pure and deterministic: the same input always gives the same output.
 * `pickSlot` places one chunk of one action without breaking any rule in §5.8 (only the owner can
 * do that, manually), except that it may land after the due date when nothing fits before it.
 */
import type { Action, DateString, Instant, TimeString, Weekday } from "@/types";
import {
  freeIntervals,
  occupies,
  POMODORO_MINUTES,
  windowSpan,
  type BusyEvent,
  type DayWindow,
  type FreeInput,
  type ScheduleBlock,
} from "./availability";
import { MINUTE, normalize, subtract, within, type Interval } from "./intervals";
import { addDays, endOfWeek, toLocalDate, weekdayOf, zonedToInstant } from "./time";

export interface PickInput {
  action: Pick<Action, "id" | "goal_id" | "due_on">;
  pomodoros: number;
  bufferMinutes: number;
  timeZone: string;
  now: Instant;
  today: DateString;
  windows: (weekday: Weekday) => { availability: DayWindow | undefined; peak: DayWindow | undefined };
  personal: FreeInput["personal"];
  /** Blocking external events (empty until Stage 4). */
  events: readonly BusyEvent[];
  /** Blocks from today to the end of the week. */
  blocks: readonly ScheduleBlock[];
  dailyCap: number;
  /** A block to ignore everywhere (the missed one being rescheduled). */
  excludeBlockId?: string;
  /** Candidate days, in order; defaults to today … Sunday. Days before today are ignored. */
  days?: readonly DateString[];
  /** A recurring occurrence (§5.11): its own day only, at its preferred time when that is free. */
  ownDay?: { date: DateString; preferredStart: TimeString | null };
}

export interface PickedSlot {
  start: number;
  end: number;
  date: DateString;
  offPeak: boolean;
  afterDue: boolean;
}

function intersect(a: readonly Interval[], b: Interval | null): Interval[] {
  if (!b) return [];
  return normalize(a)
    .map((i) => ({ start: Math.max(i.start, b.start), end: Math.min(i.end, b.end) }))
    .filter((i) => i.end > i.start);
}

/**
 * The earliest start inside one of `zone` where the chunk fits inside the zone and the chunk plus
 * its buffer fits inside the surrounding free interval.
 */
function earliestIn(zone: readonly Interval[], free: readonly Interval[], len: number, buffer: number): number | null {
  for (const z of normalize(zone)) {
    const f = free.find((x) => z.start >= x.start && z.start < x.end);
    if (f && z.start + len <= z.end && z.start + len + buffer <= f.end) return z.start;
  }
  return null;
}

export function pickSlot(input: PickInput): PickedSlot | null {
  const { action, timeZone: tz } = input;
  const len = input.pomodoros * POMODORO_MINUTES * MINUTE;
  const buffer = input.bufferMinutes * MINUTE;
  const blocks = input.blocks.filter((b) => b.id !== input.excludeBlockId && occupies(b));
  const dateOf = (b: ScheduleBlock) => toLocalDate(b.starts_at, tz);

  let week: DateString[] = [];
  if (input.days) week = input.days.filter((d) => d >= input.today);
  else for (let d = input.today; d <= endOfWeek(input.today); d = addDays(d, 1)) week.push(d);
  if (input.ownDay) week = week.includes(input.ownDay.date) ? [input.ownDay.date] : [];
  const due = input.ownDay ? null : action.due_on;
  const beforeDue = due ? week.filter((d) => d <= due) : week;
  const afterDue = due ? week.filter((d) => d > due) : [];

  const load = (d: DateString) => blocks.filter((b) => dateOf(b) === d).reduce((n, b) => n + b.planned_pomodoros, 0);
  const hasBlock = (d: DateString) => blocks.some((b) => b.action_id === action.id && dateOf(b) === d);

  const dayZones = (d: DateString) => {
    const { availability, peak } = input.windows(weekdayOf(d));
    const free = freeIntervals({ date: d, timeZone: tz, availability, personal: input.personal, events: input.events, blocks, now: input.now });
    const peakSpan = windowSpan(d, peak, tz);
    const inPeak = intersect(free, peakSpan);
    return { free, peakSpan, inPeak, outPeak: peakSpan ? subtract(free, [peakSpan]) : free };
  };

  // Goal work: peak first, then outside the peak (off-peak), then straddling it.
  // Area tasks: outside the peak first, then leftover peak time, then straddling.
  const order: ("inPeak" | "outPeak" | "free")[] = action.goal_id ? ["inPeak", "outPeak", "free"] : ["outPeak", "inPeak", "free"];

  const search = (days: DateString[]): PickedSlot | null => {
    const zones = days.map((d) => ({ d, ...dayZones(d) }));
    for (const kind of order) {
      for (const z of zones) {
        const start = earliestIn(z[kind], z.free, len, buffer);
        if (start === null) continue;
        const span = { start, end: start + len };
        return {
          ...span,
          date: z.d,
          offPeak: action.goal_id !== null && !(z.peakSpan && within(span, [z.peakSpan])),
          afterDue: due !== null && z.d > due,
        };
      }
    }
    return null;
  };

  // A recurring occurrence at its preferred time, when that time is free and under the cap.
  const preferred = input.ownDay?.preferredStart;
  if (preferred && week.length === 1 && load(week[0]) + input.pomodoros <= input.dailyCap) {
    const d = week[0];
    const z = dayZones(d);
    const start = Date.parse(zonedToInstant(d, preferred, tz));
    const f = z.free.find((x) => start >= x.start && start + len + buffer <= x.end);
    if (f) {
      const span = { start, end: start + len };
      return { ...span, date: d, offPeak: action.goal_id !== null && !(z.peakSpan && within(span, [z.peakSpan])), afterDue: false };
    }
  }

  const tryDays = (days: DateString[]) => {
    const underCap = days.filter((d) => load(d) + input.pomodoros <= input.dailyCap);
    const spread = underCap.filter((d) => !hasBlock(d));
    // Prefer a day without another block for this action, unless no such day works.
    return search(spread) ?? (spread.length < underCap.length ? search(underCap) : null);
  };

  return tryDays(beforeDue) ?? tryDays(afterDue);
}
