/**
 * The backup file (Step 1.5, Settings → Data). Pure: building the file and validating one.
 * One JSON object holding every row of every table, soft-deleted rows included.
 */
import type { Instant, TableName } from "@/types";

export const BACKUP_FORMAT = "foqus-backup";
export const BACKUP_VERSION = 1;

/** Every table, with the fields a row must have to be accepted (beyond the sync metadata). */
const REQUIRED: Record<TableName, readonly string[]> = {
  settings: ["timezone", "max_pomodoros_per_block", "daily_pomodoro_cap", "default_buffer_minutes"],
  availability_windows: ["weekday", "start_time", "end_time"],
  peak_windows: ["weekday", "start_time", "end_time"],
  personal_blocks: ["label", "weekdays", "start_time", "end_time"],
  areas: ["name", "color", "sort_order"],
  seasons: ["year", "quarter", "starts_on", "ends_on"],
  goals: ["title", "rank", "status"],
  season_plans: ["goal_id", "season_id", "outcome", "starts_on", "ends_on"],
  major_moves: ["season_plan_id", "title", "status"],
  recurrence_rules: ["title", "weekdays", "pomodoros"],
  actions: ["title", "estimate_pomodoros", "status"],
  blocks: ["action_id", "starts_at", "ends_at", "planned_pomodoros", "status"],
  focus_sessions: ["action_id", "started_at", "state"],
  daily_checkins: ["date"],
  weekly_reviews: ["week_start"],
  compass: [],
  plan_strength_snapshots: ["season_plan_id", "week_start", "total"],
  coach_messages: ["title", "body", "status"],
  google_calendars: ["gcal_id", "mode"],
  external_events: ["calendar_id", "starts_at", "ends_at"],
  // Stage 2 exit (Dexie version 2). Older backups simply have none of these.
  prayer_settings: ["enabled", "before_minutes", "after_minutes"],
  habits: ["title", "kind", "levels", "weekdays"],
  habit_logs: ["habit_id", "date", "level"],
};

export const BACKUP_TABLES = Object.keys(REQUIRED) as TableName[];

export type BackupRow = Record<string, unknown> & { id: string };

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exported_at: Instant;
  tables: Record<TableName, BackupRow[]>;
  /** Tables the file does not have at all (a backup made before they existed). Import leaves them alone. */
  absent?: TableName[];
}

/** Build the file from every row of every table. The local-only `_dirty` flag is left out. */
export function buildBackup(tables: Record<TableName, readonly Record<string, unknown>[]>, now: Instant): Backup {
  const out = {} as Record<TableName, BackupRow[]>;
  for (const t of BACKUP_TABLES) {
    out[t] = (tables[t] ?? []).map((row) => {
      const copy = { ...row };
      delete copy._dirty;
      return copy as BackupRow;
    });
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: now, tables: out };
}

export function backupFileName(date: string): string {
  return `foqus-backup-${date}.json`;
}

export function rowCounts(tables: Record<string, readonly unknown[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
}

export type ValidationResult = { ok: true; backup: Backup; rows: number } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInstant = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** Parse and check a file's text. Every failure is a plain sentence for the owner. */
export function parseBackup(text: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not a FOQUS backup: it is not valid JSON." };
  }
  return validateBackup(raw);
}

export function validateBackup(raw: unknown): ValidationResult {
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, error: "This file is not a FOQUS backup." };
  if (raw.version !== BACKUP_VERSION) return { ok: false, error: `This backup was made by a different version of FOQUS (format ${String(raw.version)}).` };
  if (!isInstant(raw.exported_at)) return { ok: false, error: "This backup has no valid export date." };
  if (!isObject(raw.tables)) return { ok: false, error: "This backup has no tables." };

  const unknown = Object.keys(raw.tables).filter((k) => !(k in REQUIRED));
  if (unknown.length) return { ok: false, error: `This backup has a table FOQUS does not know: ${unknown[0]}.` };

  const tables = {} as Record<TableName, BackupRow[]>;
  const absent = BACKUP_TABLES.filter((t) => !(t in (raw.tables as Record<string, unknown>)));
  let rows = 0;
  for (const t of BACKUP_TABLES) {
    const list = raw.tables[t] ?? [];
    if (!Array.isArray(list)) return { ok: false, error: `The ${t} table in this backup is not a list.` };
    const ids = new Set<string>();
    for (const [i, row] of list.entries()) {
      const where = `Row ${i + 1} of ${t}`;
      if (!isObject(row)) return { ok: false, error: `${where} is not a record.` };
      if (typeof row.id !== "string" || !row.id) return { ok: false, error: `${where} has no id.` };
      if (ids.has(row.id)) return { ok: false, error: `${where} repeats the id ${row.id}.` };
      ids.add(row.id);
      if (!isInstant(row.created_at) || !isInstant(row.updated_at)) return { ok: false, error: `${where} has invalid dates.` };
      if (row.deleted_at !== null && !isInstant(row.deleted_at)) return { ok: false, error: `${where} has an invalid deletion date.` };
      const missing = REQUIRED[t].find((f) => !(f in row));
      if (missing) return { ok: false, error: `${where} is missing ${missing}.` };
    }
    tables[t] = list as BackupRow[];
    rows += list.length;
  }
  return { ok: true, backup: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: raw.exported_at as string, tables, absent }, rows };
}
