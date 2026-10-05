import type { Instant, RowMeta, TimeString, Weekday } from "./common";

/** §4.2 — a single row with id `settings`. */
export interface Settings extends RowMeta {
  timezone: string;
  focus_minutes: number;
  break_minutes: number;
  max_pomodoros_per_block: number;
  daily_pomodoro_cap: number;
  default_buffer_minutes: number;
  auto_start_next_phase: boolean;
  onboarding_completed_at: Instant | null;
}

/** §4.2 — seven rows, ids `avail-1` … `avail-7`. */
export interface AvailabilityWindow extends RowMeta {
  weekday: Weekday;
  start_time: TimeString;
  end_time: TimeString;
}

/** §4.2 — seven rows, ids `peak-1` … `peak-7`. */
export interface PeakWindow extends RowMeta {
  weekday: Weekday;
  start_time: TimeString;
  end_time: TimeString;
}

/** §4.2 — recurring time FOQUS never schedules over. */
export interface PersonalBlock extends RowMeta {
  label: string;
  weekdays: Weekday[];
  start_time: TimeString;
  end_time: TimeString;
  active: boolean;
}

