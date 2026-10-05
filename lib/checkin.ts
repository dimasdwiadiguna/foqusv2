import { addDays, parseTime, toLocalTime } from "./time";
import type { Block, DailyCheckin, DateString, Instant } from "@/types";

/** The daily check-in (§5.14): when it is due, what it can still change, and the day's numbers. */

type DayBlock = Pick<Block, "status" | "resolution" | "ends_at" | "planned_pomodoros" | "completed_pomodoros" | "deleted_at">;

/** On a day with no blocks, the check-in becomes prominent at this local time. */
export const CHECKIN_EVENING = "18:00";
export const NOTE_MAX = 500;

/**
 * The blocks that make up the day's plan: drafts are not a commitment yet, and a missed block that
 * was rescheduled lives on in its successor.
 */
export function plannedBlocks<B extends DayBlock>(blocks: readonly B[]): B[] {
  return blocks.filter((b) => !b.deleted_at && b.status !== "draft" && !(b.status === "missed" && b.resolution === "rescheduled"));
}

export type CheckinPrompt = "done" | "quiet" | "prominent";

/**
 * How the check-in shows on Today: always reachable, prominent once the day's last block has ended,
 * or after 18:00 on a day with no blocks; "done" once completed.
 */
export function checkinPrompt(input: {
  blocks: readonly DayBlock[];
  checkin: Pick<DailyCheckin, "completed_at"> | null | undefined;
  now: Instant | number;
  timeZone: string;
}): CheckinPrompt {
  if (input.checkin?.completed_at) return "done";
  const nowMs = typeof input.now === "number" ? input.now : Date.parse(input.now);
  const plan = plannedBlocks(input.blocks);
  if (plan.length === 0) return parseTime(toLocalTime(nowMs, input.timeZone)) >= parseTime(CHECKIN_EVENING) ? "prominent" : "quiet";
  const lastEnd = Math.max(...plan.map((b) => Date.parse(b.ends_at)));
  return nowMs >= lastEnd ? "prominent" : "quiet";
}

/** A check-in can be edited until the end of the next day. */
export function isCheckinEditable(date: DateString, today: DateString): boolean {
  return date === today || date === addDays(today, -1);
}

export interface DayNumbers {
  done: number;
  planned: number;
}

export function dayNumbers(blocks: readonly DayBlock[]): DayNumbers {
  let done = 0;
  let planned = 0;
  for (const b of plannedBlocks(blocks)) {
    done += b.completed_pomodoros;
    planned += b.planned_pomodoros;
  }
  return { done, planned };
}

/** "Day won" (§5.19): the day had blocks and every one of them is done. */
export function isDayWon(blocks: readonly DayBlock[]): boolean {
  const plan = plannedBlocks(blocks);
  return plan.length > 0 && plan.every((b) => b.status === "done");
}

/** The one coach line on the check-in's last screen. Rule-based; the first rule that fits wins. */
export function closingLine(input: DayNumbers & { energy: number | null; focus: number | null }): string {
  const { done, planned, energy, focus } = input;
  if (energy !== null && energy <= 2) return "Low energy today. Put tomorrow's hardest block in your peak window and keep the rest light.";
  if (planned === 0 && done === 0) return "No blocks today. Rest counts too; tomorrow starts from the plan.";
  if (focus !== null && focus <= 2) return "Focus was hard today. Try one block at a time, phone out of reach.";
  if (done >= planned) return "Every planned pomodoro done. Keep tomorrow's plan just as honest.";
  if (done / planned >= 0.7) return "Most of the plan got done. Give what slipped a better slot.";
  return "Less got done than planned. Plan fewer pomodoros tomorrow and protect them.";
}
