import type { Instant, RowMeta } from "@/types";

/** Sync metadata for a brand-new row (§3.2.3). */
export function newMeta(id: string, now: Instant): RowMeta {
  return { id, created_at: now, updated_at: now, deleted_at: null, _dirty: 1 };
}

/** A random UUID for rows without a deterministic id (§3.2.2). */
export function randomId(): string {
  return crypto.randomUUID();
}
