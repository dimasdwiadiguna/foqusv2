/**
 * The weekly draft (§5.11): rank the week list, then place each item's unscheduled pomodoros in
 * chunks with `pickSlot`. Pure and deterministic: the same input always gives the same draft.
 */
import type { Action, DateString, Instant, TimeString } from "@/types";
import type { BusyEvent, FreeInput, ScheduleBlock } from "./availability";
import { POMODORO_MINUTES } from "./availability";
import { MINUTE } from "./intervals";
import { pickSlot, type PickInput } from "./scheduler";
import { toLocalDate } from "./time";

export interface DraftItem {
  action: Pick<Action, "id" | "goal_id" | "due_on" | "sort_order" | "occurrence_date">;
  /** Pomodoros still without a committed block. */
  unscheduled: number;
  /** Goal actions: the goal's rank (1 first). */
  goalRank: number | null;
  /** Goal actions: the season plan's end date. */
  planEndsOn: DateString | null;
  /** Recurring occurrences: the rule's preferred start. */
  preferredStart: TimeString | null;
}

export interface DraftInput {
  items: readonly DraftItem[];
  /** The target week's remaining days. */
  days: readonly DateString[];
  today: DateString;
  now: Instant;
  timeZone: string;
  windows: PickInput["windows"];
  personal: FreeInput["personal"];
  events: readonly BusyEvent[];
  /** Committed blocks around the week (drafts are not passed: a new draft replaces them). */
  blocks: readonly ScheduleBlock[];
  dailyCap: number;
  maxPerBlock: number;
  bufferMinutes: number;
}

export interface DraftBlock {
  action_id: string;
  start: number;
  end: number;
  date: DateString;
  pomodoros: number;
  bufferMinutes: number;
  offPeak: boolean;
  afterDue: boolean;
}

export const DIDNT_FIT = {
  due: "No free time before due date",
  cap: "Daily cap reached all week",
  none: "No free slot left",
} as const;

export interface DidntFit {
  action_id: string;
  pomodoros: number;
  reason: (typeof DIDNT_FIT)[keyof typeof DIDNT_FIT];
}

const last = "￿";
const cmp = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);

/** §5.11 ranking: recurring occurrences by date; goal actions by rank; then area tasks. */
export function rankItems(items: readonly DraftItem[]): DraftItem[] {
  const group = (i: DraftItem) => (i.action.occurrence_date ? 0 : i.action.goal_id ? 1 : 2);
  return [...items].sort((a, b) => {
    const g = group(a) - group(b);
    if (g) return g;
    const x = a.action;
    const y = b.action;
    if (group(a) === 0) {
      return cmp(x.occurrence_date!, y.occurrence_date!) || cmp(a.preferredStart ?? last, b.preferredStart ?? last) || cmp(x.id, y.id);
    }
    if (group(a) === 1) {
      const r = (a.goalRank ?? Number.MAX_SAFE_INTEGER) - (b.goalRank ?? Number.MAX_SAFE_INTEGER);
      if (r) return r;
      if (x.goal_id !== y.goal_id) return cmp(x.goal_id!, y.goal_id!);
      return (
        cmp(x.due_on ?? last, y.due_on ?? last) || cmp(a.planEndsOn ?? last, b.planEndsOn ?? last) || x.sort_order - y.sort_order || cmp(x.id, y.id)
      );
    }
    return cmp(x.due_on ?? last, y.due_on ?? last) || x.sort_order - y.sort_order || cmp(x.id, y.id);
  });
}

export function draftWeek(input: DraftInput): { blocks: DraftBlock[]; didntFit: DidntFit[] } {
  const placed: ScheduleBlock[] = [];
  const out: DraftBlock[] = [];
  const didntFit: DidntFit[] = [];
  const days = input.days.filter((d) => d >= input.today);
  const tz = input.timeZone;

  for (const item of rankItems(input.items)) {
    const { action } = item;
    const ownDay = action.occurrence_date ? { date: action.occurrence_date, preferredStart: item.preferredStart } : undefined;
    const pick = (pomodoros: number) =>
      pickSlot({
        action,
        pomodoros,
        bufferMinutes: input.bufferMinutes,
        timeZone: tz,
        now: input.now,
        today: input.today,
        windows: input.windows,
        personal: input.personal,
        events: input.events,
        // Placed drafts reserve their time like committed blocks.
        blocks: [...input.blocks, ...placed],
        dailyCap: input.dailyCap,
        days,
        ownDay,
      });

    let remaining = item.unscheduled;
    while (remaining > 0) {
      let slot = null;
      let size = Math.min(remaining, input.maxPerBlock);
      // A smaller chunk that fits is placed; the rest is re-queued.
      for (; size >= 1; size--) {
        slot = pick(size);
        if (slot) break;
      }
      if (!slot) {
        didntFit.push({ action_id: action.id, pomodoros: remaining, reason: reasonFor(input, [...input.blocks, ...placed], days, action, ownDay?.date) });
        break;
      }
      const end = slot.start + size * POMODORO_MINUTES * MINUTE;
      placed.push({
        id: `draft-${out.length}`,
        action_id: action.id,
        starts_at: new Date(slot.start).toISOString(),
        ends_at: new Date(end).toISOString(),
        buffer_minutes: input.bufferMinutes,
        status: "scheduled",
        planned_pomodoros: size,
        deleted_at: null,
      });
      out.push({ action_id: action.id, start: slot.start, end, date: slot.date, pomodoros: size, bufferMinutes: input.bufferMinutes, offPeak: slot.offPeak, afterDue: slot.afterDue });
      remaining -= size;
    }
  }
  return { blocks: out, didntFit };
}

function reasonFor(
  input: DraftInput,
  blocks: readonly ScheduleBlock[],
  days: readonly DateString[],
  action: DraftItem["action"],
  ownDay: DateString | undefined,
): DidntFit["reason"] {
  const candidates = ownDay ? days.filter((d) => d === ownDay) : days;
  const load = (d: DateString) =>
    blocks.filter((b) => !b.deleted_at && b.status !== "missed" && toLocalDate(b.starts_at, input.timeZone) === d).reduce((n, b) => n + b.planned_pomodoros, 0);
  if (candidates.length > 0 && candidates.every((d) => load(d) + 1 > input.dailyCap)) return DIDNT_FIT.cap;
  if (!ownDay && action.due_on && candidates.length > 0 && action.due_on < candidates[candidates.length - 1]) return DIDNT_FIT.due;
  return DIDNT_FIT.none;
}
