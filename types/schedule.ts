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


export type PrayerName = "subuh" | "dzuhur" | "ashar" | "maghrib" | "isya";

/**
 * Stage 2 exit — shalat times as fixed blocks. A single row with id `prayer`. Times are computed per
 * day from the location (Kemenag RI convention); each span runs from `before_minutes` before adzan
 * to `after_minutes` after it. On Fridays, Jumat replaces Dzuhur's span when enabled.
 */
export interface PrayerSettings extends RowMeta {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  before_minutes: number;
  after_minutes: number;
  /** Extra minutes added to every computed time (Kemenag ihtiyat, 2 by default). */
  ihtiyat_minutes: number;
  prayers: Record<PrayerName, { enabled: boolean; adjust_minutes: number }>;
  jumat: { enabled: boolean; before_minutes: number; after_minutes: number };
}
