import type { TableName } from "@/types";

/**
 * Dexie store definitions. Primary key is always `id` (client-generated, §3.2.2).
 * Every table indexes `_dirty` and `updated_at` so the Stage 3 sync engine can find changed rows.
 * Adding an index later means adding a new `version()` in `db/index.ts`, never editing this one in place
 * once it has shipped.
 */
const SYNC = "_dirty, updated_at";

export const SCHEMA_V1: Record<Exclude<TableName, V2Table>, string> = {
  settings: `id, ${SYNC}`,
  availability_windows: `id, weekday, ${SYNC}`,
  peak_windows: `id, weekday, ${SYNC}`,
  personal_blocks: `id, ${SYNC}`,
  areas: `id, sort_order, ${SYNC}`,
  seasons: `id, ${SYNC}`,
  goals: `id, area_id, status, rank, ${SYNC}`,
  season_plans: `id, goal_id, season_id, ${SYNC}`,
  major_moves: `id, season_plan_id, ${SYNC}`,
  recurrence_rules: `id, goal_id, area_id, ${SYNC}`,
  actions: `id, goal_id, area_id, planned_week, status, recurrence_rule_id, ${SYNC}`,
  blocks: `id, action_id, starts_at, status, ${SYNC}`,
  focus_sessions: `id, block_id, action_id, started_at, ${SYNC}`,
  daily_checkins: `id, date, ${SYNC}`,
  weekly_reviews: `id, week_start, ${SYNC}`,
  compass: `id, ${SYNC}`,
  plan_strength_snapshots: `id, season_plan_id, week_start, ${SYNC}`,
  coach_messages: `id, status, rule_code, goal_id, ${SYNC}`,
  google_calendars: `id, ${SYNC}`,
  external_events: `id, calendar_id, starts_at, ${SYNC}`,
};

/** Tables added in version 2 (the Stage 2 exit changes). */
type V2Table = "prayer_settings" | "habits" | "habit_logs";

/**
 * Version 2 (Stage 2 exit): shalat settings, elastic habits and their daily logs. Actions gain
 * `session_pomodoros` (not indexed; the upgrade fills it with null).
 */
export const SCHEMA_V2: Record<V2Table, string> = {
  prayer_settings: `id, ${SYNC}`,
  habits: `id, goal_id, area_id, sort_order, ${SYNC}`,
  habit_logs: `id, habit_id, date, ${SYNC}`,
};
