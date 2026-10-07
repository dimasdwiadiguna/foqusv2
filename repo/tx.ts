import { getDb } from "@/db";
import type { TableName, Tables } from "@/types";

/**
 * Run several repo writes atomically. Nested `createRow`/`updateRow`/`softDelete` calls join this
 * transaction, so either every write lands or none does.
 */
export function writeTx<T>(tables: readonly TableName[], fn: () => Promise<T>): Promise<T> {
  return getDb().transaction("rw", tables as TableName[], fn);
}

/** Read inside the current transaction (or a fresh one), skipping soft-deleted rows. */
export async function liveWhere<N extends TableName>(
  table: N,
  index: string,
  value: string,
): Promise<Tables[N][]> {
  const rows = await getDb().t(table).where(index).equals(value).toArray();
  return rows.filter((r) => !r.deleted_at);
}

/**
 * Every table: the scope for compound operations that call other repo functions (whose nested
 * transactions must be a subset of the outer one).
 */
export const ALL_TABLES: TableName[] = [
  "settings",
  "availability_windows",
  "peak_windows",
  "personal_blocks",
  "areas",
  "seasons",
  "goals",
  "season_plans",
  "major_moves",
  "recurrence_rules",
  "prayer_settings",
  "habits",
  "habit_logs",
  "actions",
  "blocks",
  "focus_sessions",
  "daily_checkins",
  "weekly_reviews",
  "compass",
  "plan_strength_snapshots",
  "coach_messages",
  "google_calendars",
  "external_events",
];
