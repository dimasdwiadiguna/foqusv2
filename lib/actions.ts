/** An action's numbers (§5.1), its pomodoro dots (§6.5), and input validation (§4.3, §5.4). Pure. */
import type { Action, Block, Instant } from "@/types";

export const MIN_ESTIMATE = 1;
export const MAX_ESTIMATE = 40;
export const MAX_TITLE = 200;

type BlockLike = Pick<Block, "action_id" | "status" | "starts_at" | "planned_pomodoros" | "completed_pomodoros" | "deleted_at">;

/** Pomodoros finished across an action's blocks. */
export function completedPomodoros(actionId: string, blocks: readonly BlockLike[]): number {
  let sum = 0;
  for (const b of blocks) if (b.action_id === actionId && !b.deleted_at) sum += b.completed_pomodoros;
  return sum;
}

/** Completed pomodoros for every action that has any. */
export function completedByAction(blocks: readonly BlockLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of blocks) {
    if (b.deleted_at || b.completed_pomodoros === 0) continue;
    out.set(b.action_id, (out.get(b.action_id) ?? 0) + b.completed_pomodoros);
  }
  return out;
}

export interface ActionNumbers {
  estimate: number;
  completed: number;
  remaining: number;
  unscheduled: number;
}

/** §5.1: estimate, completed, remaining, and unscheduled pomodoros at instant `now`. */
export function actionNumbers(action: Pick<Action, "id" | "estimate_pomodoros">, blocks: readonly BlockLike[], now: Instant): ActionNumbers {
  const estimate = action.estimate_pomodoros;
  const completed = completedPomodoros(action.id, blocks);
  const remaining = Math.max(estimate - completed, 0);
  const nowMs = Date.parse(now);
  let future = 0;
  for (const b of blocks) {
    if (b.action_id === action.id && !b.deleted_at && b.status === "scheduled" && Date.parse(b.starts_at) >= nowMs) {
      future += b.planned_pomodoros;
    }
  }
  return { estimate, completed, remaining, unscheduled: Math.max(remaining - future, 0) };
}

export type Dots = { kind: "dots"; filled: number; total: number } | { kind: "count"; completed: number; total: number };

/** §6.5: up to 8 dots, otherwise "● 5/12". Completed beyond the total shows as extra filled dots. */
export function dots(completed: number, total: number): Dots {
  const shown = Math.max(total, completed);
  if (shown > 8) return { kind: "count", completed, total };
  return { kind: "dots", filled: completed, total: shown };
}

/** A screen-reader label for dots: "2 of 4 pomodoros done". */
export function dotsLabel(completed: number, total: number): string {
  return `${completed} of ${total} ${total === 1 ? "pomodoro" : "pomodoros"} done`;
}

export function clampEstimate(n: number): number {
  if (!Number.isFinite(n)) return MIN_ESTIMATE;
  return Math.min(MAX_ESTIMATE, Math.max(MIN_ESTIMATE, Math.round(n)));
}

export function cleanTitle(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (!t) throw new Error("Give it a title.");
  if (t.length > MAX_TITLE) throw new Error(`Keep the title under ${MAX_TITLE} characters.`);
  return t;
}

/**
 * Check the owner fields of an action (§4.3): exactly one of goal and area, and a major move only
 * on goal actions. Throws a plain sentence.
 */
export function checkActionOwner(a: Pick<Action, "goal_id" | "area_id" | "major_move_id">): void {
  if ((a.goal_id === null) === (a.area_id === null)) {
    throw new Error("An action belongs to a goal or to an area, never both or neither.");
  }
  if (a.major_move_id !== null && a.goal_id === null) {
    throw new Error("Only goal actions can sit under a major move.");
  }
}
