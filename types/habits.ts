import type { DateString, Instant, RowMeta, Weekday } from "./common";

/**
 * Stage 2 exit — elastic habits (Stephen Guise): tracked, not scheduled. Each habit has three
 * levels, Min, Std, and Elite; any level wins the day.
 *
 * - `count` habits (water: 4 / 6 / 8 glasses) reach a level by count.
 * - `level` habits (stretch: "1 stretch" / "10 minutes" / "30 minutes") are marked at a level.
 */
export type HabitKind = "count" | "level";

export interface Habit extends RowMeta {
  title: string;
  /** Optional link: at most one of goal and area. */
  goal_id: string | null;
  area_id: string | null;
  kind: HabitKind;
  /** Count habits: what is counted ("glasses"). */
  unit: string | null;
  /** Count habits: thresholds; level habits: short labels. */
  levels: { min: number | string; std: number | string; elite: number | string };
  /** Days the habit is expected; other days neither count nor break the streak. */
  weekdays: Weekday[];
  active: boolean;
  sort_order: number;
  archived_at: Instant | null;
}

/** One day of one habit. id `<habit_id>:<date>`. `level`: 0 none, 1 Min, 2 Std, 3 Elite. */
export interface HabitLog extends RowMeta {
  habit_id: string;
  date: DateString;
  level: 0 | 1 | 2 | 3;
  /** Count habits: the count reached. */
  count: number | null;
}
