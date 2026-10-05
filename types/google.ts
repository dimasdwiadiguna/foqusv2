import type { Instant, RowMeta } from "./common";

export type CalendarMode = "ignore" | "show" | "block";

/** §4.6 — server-owned (Stage 4); the client pulls but never pushes. */
export interface GoogleCalendar extends RowMeta {
  gcal_id: string;
  summary: string;
  color: string | null;
  mode: CalendarMode;
  last_synced_at: Instant | null;
}

/** §4.6 — server-owned read cache of Google events (Stage 4). */
export interface ExternalEvent extends RowMeta {
  calendar_id: string;
  gcal_event_id: string;
  title: string;
  starts_at: Instant;
  ends_at: Instant;
  all_day: boolean;
}
