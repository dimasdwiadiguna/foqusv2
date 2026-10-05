import type { DateString, Instant, RowMeta } from "./common";

/** §4.5 — id is the date. */
export interface DailyCheckin extends RowMeta {
  date: DateString;
  /** 1–5. */
  energy: number | null;
  /** 1–5. */
  focus: number | null;
  note: string | null;
  completed_at: Instant | null;
}

/** §4.5 — id is the week's Monday date. */
export interface WeeklyReview extends RowMeta {
  week_start: DateString;
  wins: string | null;
  lessons: string | null;
  change_next_week: string | null;
  /** Snapshot of the numbers at completion; never recomputed. */
  stats: Record<string, unknown> | null;
  /** For resuming. */
  step: number;
  completed_at: Instant | null;
}

/** §4.5 — a single row with id `compass`. */
export interface Compass extends RowMeta {
  vision: string | null;
  values: string[];
}

/** §4.5 — id `<season_plan_id>:<week_start>`. */
export interface PlanStrengthSnapshot extends RowMeta {
  season_plan_id: string;
  week_start: DateString;
  total: number;
  completeness: number;
  moves: number;
  scheduled: number;
  follow_through: number;
}

export type CoachMessageSource = "rule" | "ai";
export type CoachMessageStatus = "new" | "dismissed" | "done";

/** §4.5 */
export interface CoachMessage extends RowMeta {
  source: CoachMessageSource;
  rule_code: string | null;
  goal_id: string | null;
  title: string;
  body: string;
  action_link: string | null;
  status: CoachMessageStatus;
  valid_until: Instant | null;
}
