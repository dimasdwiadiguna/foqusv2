/** `YYYY-MM-DD`, a calendar date with no time. */
export type DateString = string;
/** `HH:MM`, a 24-hour clock time. */
export type TimeString = string;
/** A UTC ISO-8601 instant, e.g. `2026-10-05T00:30:00.000Z`. */
export type Instant = string;
/** 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Columns every synced row carries (§3.2, §4.1). */
export interface RowMeta {
  id: string;
  created_at: Instant;
  updated_at: Instant;
  /** Soft delete. Reads filter out rows where this is set. */
  deleted_at: Instant | null;
  /** Local only. Set to 1 by `repo/` on every write; cleared only by sync (Stage 3). */
  _dirty: 0 | 1;
}

/** The fields a caller supplies when creating a row. */
export type NewRow<T extends RowMeta> = Omit<T, keyof RowMeta> & { id?: string };
/** The fields a caller may change on an existing row. */
export type RowPatch<T extends RowMeta> = Partial<Omit<T, keyof RowMeta>>;
