import { getDb } from "@/db";
import type { Instant } from "@/types";
import { softDelete } from "./rows";

/**
 * Soft-delete blocks of these actions that have not started yet (draft or scheduled, starting after
 * `now`). Used when an action is done or dropped and when a goal is dropped (§5.3, §5.4).
 */
export async function deleteFutureBlocks(actionIds: readonly string[], now: Instant): Promise<number> {
  if (actionIds.length === 0) return 0;
  const nowMs = Date.parse(now);
  const blocks = await getDb().t("blocks").where("action_id").anyOf([...actionIds]).toArray();
  let n = 0;
  for (const b of blocks) {
    if (b.deleted_at) continue;
    if ((b.status === "draft" || b.status === "scheduled") && Date.parse(b.starts_at) > nowMs) {
      await softDelete("blocks", b.id);
      n++;
    }
  }
  return n;
}

/** Soft-delete every block of these actions (used when actions themselves are deleted). */
export async function deleteAllBlocks(actionIds: readonly string[]): Promise<void> {
  if (actionIds.length === 0) return;
  const blocks = await getDb().t("blocks").where("action_id").anyOf([...actionIds]).toArray();
  for (const b of blocks) if (!b.deleted_at) await softDelete("blocks", b.id);
}
