/**
 * Sessions (Stage 2 exit): one action that needs several sittings is scheduled as several blocks of
 * `session_pomodoros` each. Pure and deterministic, built on `pickSlot` like the weekly draft.
 */
import type { Action, Block } from "@/types";
import type { ScheduleBlock } from "./availability";
import { POMODORO_MINUTES } from "./availability";
import type { DraftBlock, DraftInput } from "./draft";
import { MINUTE } from "./intervals";
import { pickSlot } from "./scheduler";

export interface SessionInput extends Omit<DraftInput, "items" | "maxPerBlock"> {
  action: Pick<Action, "id" | "goal_id" | "due_on">;
  count: number;
  size: number;
}

/**
 * Place `count` sessions of `size` pomodoros, earliest first, each on a day without another session
 * of this action where possible (pickSlot's preference). Sessions that find no slot are reported as
 * `missing`; nothing is shortened.
 */
export function planSessions(input: SessionInput): { blocks: DraftBlock[]; missing: number } {
  const placed: ScheduleBlock[] = [];
  const out: DraftBlock[] = [];
  for (let i = 0; i < input.count; i++) {
    const slot = pickSlot({
      action: input.action,
      pomodoros: input.size,
      bufferMinutes: input.bufferMinutes,
      timeZone: input.timeZone,
      now: input.now,
      today: input.today,
      windows: input.windows,
      personal: input.personal,
      events: input.events,
      blocks: [...input.blocks, ...placed],
      dailyCap: input.dailyCap,
      days: input.days,
    });
    if (!slot) return { blocks: out, missing: input.count - i };
    const end = slot.start + input.size * POMODORO_MINUTES * MINUTE;
    placed.push({
      id: `session-${i}`,
      action_id: input.action.id,
      starts_at: new Date(slot.start).toISOString(),
      ends_at: new Date(end).toISOString(),
      buffer_minutes: input.bufferMinutes,
      status: "scheduled",
      planned_pomodoros: input.size,
      deleted_at: null,
    });
    out.push({ action_id: input.action.id, start: slot.start, end, date: slot.date, pomodoros: input.size, bufferMinutes: input.bufferMinutes, offPeak: slot.offPeak, afterDue: slot.afterDue });
  }
  return { blocks: out, missing: 0 };
}

/** Default split for `unscheduled` pomodoros: sessions of `size` (or as large as a block allows). */
export function defaultSplit(unscheduled: number, size: number | null, maxPerBlock: number): { count: number; size: number } {
  const s = Math.max(1, Math.min(size ?? maxPerBlock, maxPerBlock));
  return { count: Math.max(1, Math.ceil(unscheduled / s)), size: s };
}

/**
 * "1 of 3 sessions scheduled": for an action with a session size, the sessions its estimate needs
 * and how many have a block (scheduled, running, or done).
 */
export function sessionProgress(
  action: Pick<Action, "id" | "estimate_pomodoros" | "session_pomodoros">,
  blocks: readonly Pick<Block, "action_id" | "status" | "deleted_at">[],
): { total: number; scheduled: number } | null {
  if (!action.session_pomodoros) return null;
  const total = Math.ceil(action.estimate_pomodoros / action.session_pomodoros);
  const scheduled = blocks.filter((b) => b.action_id === action.id && !b.deleted_at && (b.status === "scheduled" || b.status === "active" || b.status === "done")).length;
  return { total, scheduled: Math.min(scheduled, total) };
}
