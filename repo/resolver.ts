/** The missed-block resolver (§5.10). Each choice is one transaction. */
import { getDb } from "@/db";
import type { Block } from "@/types";
import { completeAction, dropAction } from "./actions";
import { placeBlock, type Placement } from "./blocks";
import { nowInstant } from "./clock";
import { updateRow } from "./rows";
import { ALL_TABLES, writeTx } from "./tx";

const TABLES = ALL_TABLES;

async function unresolved(id: string): Promise<Block> {
  const b = await getDb().t("blocks").get(id);
  if (!b || b.deleted_at || b.status !== "scheduled") throw new Error("That block is already resolved.");
  return b;
}

/** Done: the block becomes `done` with `completed` pomodoros; optionally the action too. */
export async function resolveDone(blockId: string, completed: number, actionDone: boolean): Promise<void> {
  await writeTx(TABLES, async () => {
    const b = await unresolved(blockId);
    const n = Math.max(0, Math.min(Math.round(completed), b.planned_pomodoros));
    await updateRow("blocks", blockId, { status: "done", completed_pomodoros: n, resolved_at: nowInstant() });
    if (actionDone) await completeAction(b.action_id);
  });
}

async function markRescheduled(b: Block, successor: string | null): Promise<void> {
  await updateRow("blocks", b.id, { status: "missed", resolution: "rescheduled", resolved_at: nowInstant(), replaced_by_block_id: successor });
  const action = await getDb().t("actions").get(b.action_id);
  if (action && !action.deleted_at) await updateRow("actions", action.id, { reschedule_count: action.reschedule_count + 1 });
}

/**
 * Reschedule to a new time ("Next free slot" or "Pick a time"): a successor block is placed, the
 * old one becomes `missed` / `rescheduled` and links to it, and the action's reschedule count rises.
 */
export async function rescheduleTo(blockId: string, placement: Placement): Promise<Block> {
  return writeTx(TABLES, async () => {
    const old = await unresolved(blockId);
    const next = await placeBlock(old.action_id, placement);
    await markRescheduled(old, next.id);
    return next;
  });
}

/** Reschedule "Back to tray": the old block is missed, and its pomodoros return to the tray. */
export async function rescheduleToTray(blockId: string): Promise<void> {
  await writeTx(TABLES, async () => markRescheduled(await unresolved(blockId), null));
}

/** Drop: the block is missed / dropped. The action stays in the tray unless it is dropped too. */
export async function resolveDrop(blockId: string, dropTheAction: boolean): Promise<void> {
  await writeTx(TABLES, async () => {
    const b = await unresolved(blockId);
    await updateRow("blocks", blockId, { status: "missed", resolution: "dropped", resolved_at: nowInstant() });
    if (dropTheAction) await dropAction(b.action_id);
  });
}
