/**
 * Manual scheduling rules (§5.8). Pure. `checkPlacement` takes a proposed block and returns either
 * the hard-rule rejection (it overlaps another FOQUS block) or the list of soft warnings, plus the
 * flags the block is stored with (off-peak, after-due).
 */
import type { Action, DateString } from "@/types";
import {
  blockSpan,
  bufferSpan,
  daySpan,
  eventSpans,
  occupies,
  personalSpans,
  POMODORO_MINUTES,
  SNAP_MINUTES,
  windowSpan,
  type BusyEvent,
  type DayWindow,
  type ScheduleBlock,
} from "./availability";
import { MINUTE, overlaps, within, type Interval } from "./intervals";
import { formatDayHeader, toLocalDate } from "./time";

export type WarningKind = "buffer" | "event" | "personal" | "availability" | "cap" | "due";

export interface PlacementWarning {
  kind: WarningKind;
  message: string;
}

export type PlacementResult =
  | { ok: false; reason: "overlap"; blockId: string; message: string }
  | { ok: false; reason: "midnight"; message: string }
  | { ok: true; warnings: PlacementWarning[]; offPeak: boolean; afterDue: boolean; start: number; end: number };

export interface PlacementInput {
  /** Proposed start, epoch ms. */
  start: number;
  pomodoros: number;
  bufferMinutes: number;
  /** The block being moved or resized, if it already exists. */
  blockId?: string;
  action: Pick<Action, "goal_id" | "due_on">;
  timeZone: string;
  /** Today's date in the zone, for wording ("today" vs a day name). */
  today: DateString;
  availability: DayWindow | undefined;
  peak: DayWindow | undefined;
  personal: Parameters<typeof personalSpans>[1];
  /** Blocking external events (empty until Stage 4). */
  events: readonly BusyEvent[];
  /** FOQUS blocks near the proposal (at least the same day and the day before). */
  blocks: readonly (ScheduleBlock & { title?: string })[];
  dailyCap: number;
}

export const blockEnd = (start: number, pomodoros: number) => start + pomodoros * POMODORO_MINUTES * MINUTE;

/** The local date a proposal falls on. */
export const proposalDate = (start: number, timeZone: string) => toLocalDate(start, timeZone);

/** The FOQUS block a span would overlap, ignoring `excludeId`. */
export function overlappingBlock<B extends ScheduleBlock>(span: Interval, blocks: readonly B[], excludeId?: string): B | undefined {
  return blocks.find((b) => b.id !== excludeId && occupies(b) && overlaps(span, blockSpan(b)));
}

function quote(title: string | undefined) {
  return title ? `“${title}”` : "another block";
}

export function checkPlacement(input: PlacementInput): PlacementResult {
  const { start, timeZone } = input;
  const end = blockEnd(start, input.pomodoros);
  const span = { start, end };
  const date = proposalDate(start, timeZone);
  const day = daySpan(date, timeZone);

  if (end > day.end) return { ok: false, reason: "midnight", message: "A block has to end by midnight." };

  // The only hard rule: two FOQUS blocks never overlap.
  const clash = overlappingBlock(span, input.blocks, input.blockId);
  if (clash) {
    return { ok: false, reason: "overlap", blockId: clash.id, message: `This overlaps ${quote(clash.title)}.` };
  }

  const warnings: PlacementWarning[] = [];
  const others = input.blocks.filter((b) => b.id !== input.blockId && occupies(b));

  // Another block's buffer, in either direction.
  const ownBuffer = { start: end, end: end + input.bufferMinutes * MINUTE };
  const intoBuffer = others.find((b) => b.buffer_minutes > 0 && overlaps(span, bufferSpan(b)));
  const bufferInto = others.find((b) => ownBuffer.end > ownBuffer.start && overlaps(ownBuffer, blockSpan(b)));
  if (intoBuffer) warnings.push({ kind: "buffer", message: `This runs into the buffer after ${quote(intoBuffer.title)}.` });
  else if (bufferInto) warnings.push({ kind: "buffer", message: `Its buffer runs into ${quote(bufferInto.title)}.` });

  for (const e of input.events) {
    const [es] = eventSpans([e]);
    if (es && overlaps(span, es)) {
      warnings.push({ kind: "event", message: `This overlaps ${e.title}${e.calendar ? ` (${e.calendar} calendar)` : ""}.` });
      break;
    }
  }

  const personal = personalSpans(date, input.personal, timeZone).find((p) => overlaps(span, p));
  if (personal) warnings.push({ kind: "personal", message: `This overlaps ${personal.label}, a personal block.` });

  const window = windowSpan(date, input.availability, timeZone);
  if (!window || !within(span, [window])) {
    warnings.push({
      kind: "availability",
      message: window
        ? `This is outside your available hours (${input.availability!.start_time}–${input.availability!.end_time}).`
        : "This day has no available hours.",
    });
  }

  const load = others
    .filter((b) => b.status !== "missed" && proposalDate(Date.parse(b.starts_at), timeZone) === date)
    .reduce((n, b) => n + b.planned_pomodoros, 0);
  const total = load + input.pomodoros;
  if (total > input.dailyCap) {
    const when = date === input.today ? "today" : `on ${formatDayHeader(date)}`;
    warnings.push({ kind: "cap", message: `${total} pomodoros planned ${when}. Your cap is ${input.dailyCap}.` });
  }

  const afterDue = input.action.due_on !== null && input.action.due_on < date;
  if (afterDue) warnings.push({ kind: "due", message: `This action is due ${formatDayHeader(input.action.due_on!)}, before this block.` });

  // Goal work outside the peak window: no warning, just the off-peak marker.
  const peak = windowSpan(date, input.peak, timeZone);
  const offPeak = input.action.goal_id !== null && (!peak || !within(span, [peak]));

  return { ok: true, warnings, offPeak, afterDue, start, end };
}

/**
 * The nearest start on the 5-minute grid, within the same day, where the block overlaps no other
 * FOQUS block (§5.8: "snaps to the nearest free position"). Ties go to the later position.
 * Returns null when nothing in the day fits; the block then returns to where it was.
 */
export function snapToFree(input: PlacementInput): number | null {
  const date = proposalDate(input.start, input.timeZone);
  const day = daySpan(date, input.timeZone);
  const step = SNAP_MINUTES * MINUTE;
  const length = blockEnd(0, input.pomodoros);
  const fits = (s: number) =>
    s >= day.start && s + length <= day.end && !overlappingBlock({ start: s, end: s + length }, input.blocks, input.blockId);
  const maxSteps = Math.ceil((day.end - day.start) / step);
  for (let k = 0; k <= maxSteps; k++) {
    if (fits(input.start + k * step)) return input.start + k * step;
    if (k > 0 && fits(input.start - k * step)) return input.start - k * step;
  }
  return null;
}

/** Snap a minute-of-day to the 5-minute grid. */
export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}
