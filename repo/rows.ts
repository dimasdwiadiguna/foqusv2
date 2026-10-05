/**
 * The generic write path (§3.2). Every write in the app goes through these three functions, which
 * maintain `created_at`, `updated_at`, `deleted_at`, and `_dirty`. There are no hard deletes.
 */
import { getDb } from "@/db";
import { newMeta, randomId } from "@/db/meta";
import type { NewRow, RowPatch, TableName, Tables } from "@/types";
import { SERVER_OWNED_TABLES } from "@/types";
import { nowInstant } from "./clock";

/** Tables the client writes. Google tables are server-owned (Stage 4) and only arrive by pull. */
export type WritableTable = Exclude<TableName, (typeof SERVER_OWNED_TABLES)[number]>;

export class NotFoundError extends Error {
  constructor(table: TableName, id: string) {
    super(`No ${table} row with id ${id}.`);
    this.name = "NotFoundError";
  }
}

/** Insert a row. Uses `data.id` when given (deterministic ids, §4.1), otherwise a random UUID. */
export async function createRow<N extends WritableTable>(table: N, data: NewRow<Tables[N]>): Promise<Tables[N]> {
  const { id, ...fields } = data;
  const row = { ...fields, ...newMeta(id ?? randomId(), nowInstant()) } as Tables[N];
  await getDb().t(table).add(row);
  return row;
}

/** Change fields on a live row. Refreshes `updated_at` and marks the row dirty. */
export async function updateRow<N extends WritableTable>(
  table: N,
  id: string,
  patch: RowPatch<Tables[N]>,
): Promise<Tables[N]> {
  const t = getDb().t(table);
  // Errors thrown inside a Dexie transaction come back wrapped, so "not found" is signalled with null.
  const next = await getDb().transaction("rw", t, async () => {
    const current = await t.get(id);
    if (!current || current.deleted_at) return null;
    const updated = { ...current, ...stripMeta(patch), updated_at: nowInstant(), _dirty: 1 } as Tables[N];
    await t.put(updated);
    return updated;
  });
  if (!next) throw new NotFoundError(table, id);
  return next;
}

/** Soft-delete a row: set `deleted_at`, refresh `updated_at`, mark dirty. Deleting twice is a no-op. */
export async function softDelete(table: WritableTable, id: string): Promise<void> {
  const t = getDb().t(table);
  const found = await getDb().transaction("rw", t, async () => {
    const current = await t.get(id);
    if (!current) return false;
    if (current.deleted_at) return true;
    const now = nowInstant();
    await t.put({ ...current, deleted_at: now, updated_at: now, _dirty: 1 });
    return true;
  });
  if (!found) throw new NotFoundError(table, id);
}

/** Callers can never set sync metadata through a patch, even with a cast. */
function stripMeta<T extends object>(patch: T): T {
  const copy = { ...patch } as Record<string, unknown>;
  for (const key of ["id", "created_at", "updated_at", "deleted_at", "_dirty"]) delete copy[key];
  return copy as T;
}
