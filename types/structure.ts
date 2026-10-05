import type { DateString, Instant, RowMeta, TimeString, Weekday } from "./common";

/** §4.3 */
export interface Area extends RowMeta {
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  archived_at: Instant | null;
}

export type Quarter = 1 | 2 | 3 | 4;

/** §4.3 — id `YYYY-QN`, e.g. `2026-Q4`. */
export interface Season extends RowMeta {
  year: number;
  quarter: Quarter;
  starts_on: DateString;
  ends_on: DateString;
  theme: string | null;
  review_note: string | null;
  reviewed_at: Instant | null;
}

export type GoalStatus = "active" | "achieved" | "dropped";

/** §4.3 */
export interface Goal extends RowMeta {
  area_id: string | null;
  title: string;
  why: string | null;
  anti_goals: string[];
  /** 1 = highest priority. */
  rank: number;
  status: GoalStatus;
  closed_at: Instant | null;
  drop_reason: string | null;
}

export interface Obstacle {
  obstacle: string;
  mitigation: string;
}

export type SeasonPlanResolution = "carried" | "achieved" | "dropped";

/** §4.3 — id `<goal_id>:<season_id>`. */
export interface SeasonPlan extends RowMeta {
  goal_id: string;
  season_id: string;
  outcome: string;
  metric_label: string | null;
  metric_target: number | null;
  metric_current: number | null;
  starts_on: DateString;
  ends_on: DateString;
  /** 0–100. */
  confidence_pct: number | null;
  /** Up to 3. */
  obstacles: Obstacle[];
  resolution: SeasonPlanResolution | null;
  resolved_at: Instant | null;
}

export type MajorMoveStatus = "open" | "done";

/** §4.3 */
export interface MajorMove extends RowMeta {
  season_plan_id: string;
  title: string;
  sort_order: number;
  status: MajorMoveStatus;
}

/** §4.3 — exactly one of `goal_id` and `area_id` is set. */
export interface RecurrenceRule extends RowMeta {
  goal_id: string | null;
  area_id: string | null;
  major_move_id: string | null;
  title: string;
  weekdays: Weekday[];
  pomodoros: number;
  preferred_start: TimeString | null;
  starts_on: DateString;
  ends_on: DateString | null;
  active: boolean;
}

export type ActionStatus = "todo" | "done" | "dropped";

/**
 * §4.3 — exactly one of `goal_id` and `area_id` is set.
 * Generated occurrences have id `<rule_id>:<occurrence_date>`.
 */
export interface Action extends RowMeta {
  goal_id: string | null;
  area_id: string | null;
  /** Goal actions only. */
  major_move_id: string | null;
  title: string;
  notes: string | null;
  /** 1–40. */
  estimate_pomodoros: number;
  due_on: DateString | null;
  status: ActionStatus;
  /** Monday of the week list it is on, or null (backlog). */
  planned_week: DateString | null;
  sort_order: number;
  reschedule_count: number;
  recurrence_rule_id: string | null;
  occurrence_date: DateString | null;
  completed_at: Instant | null;
}
