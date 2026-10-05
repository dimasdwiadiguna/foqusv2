import type { Instant, RowMeta } from "./common";

export type BlockStatus = "draft" | "scheduled" | "active" | "done" | "missed";
export type BlockResolution = "rescheduled" | "dropped";
export type BlockOrigin = "manual" | "draft" | "adhoc";

/** §4.4 — id is always a random UUID (the Google event id derives from it). */
export interface Block extends RowMeta {
  action_id: string;
  starts_at: Instant;
  /** 1 to `settings.max_pomodoros_per_block`. */
  planned_pomodoros: number;
  /** `starts_at + planned_pomodoros × 30 min`, kept in step by `repo/`. */
  ends_at: Instant;
  buffer_minutes: number;
  status: BlockStatus;
  completed_pomodoros: number;
  /** Set for `missed` blocks. */
  resolution: BlockResolution | null;
  resolved_at: Instant | null;
  origin: BlockOrigin;
  /** Goal work placed outside the peak window. */
  off_peak: boolean;
  /** Placed after the action's due date. */
  after_due: boolean;
  /** Links a rescheduled block to its successor. */
  replaced_by_block_id: string | null;
}

export type FocusPhase = "focus" | "break" | "paused" | "ended";

/**
 * Enough to resume a session at the right second after a reload. The timer is computed from this
 * anchor and "now" (`lib/timer`), never from ticking.
 */
export interface FocusSessionState {
  phase: FocusPhase;
  /** When this stretch of the phase began (for `paused`: when the pause began). */
  phase_started_at: Instant;
  /** Seconds of this phase already run before `phase_started_at` (after a resume). */
  phase_elapsed_before?: number;
  /** The phase to return to when resuming from `paused`. */
  resume_phase?: Exclude<FocusPhase, "paused" | "ended">;
  /** Seconds left in the interrupted phase when paused. */
  resume_seconds_remaining?: number;
}

export interface FocusPomodoro {
  index: number;
  started_at: Instant;
  ended_at: Instant | null;
  completed: boolean;
}

/** §4.4 */
export interface FocusSession extends RowMeta {
  block_id: string | null;
  action_id: string;
  started_at: Instant;
  ended_at: Instant | null;
  planned_pomodoros: number;
  completed_pomodoros: number;
  focus_seconds: number;
  pause_seconds: number;
  /** 1–5. */
  focus_rating: number | null;
  action_completed: boolean;
  note: string | null;
  scratchpad: string | null;
  state: FocusSessionState;
  pomodoros: FocusPomodoro[];
}
