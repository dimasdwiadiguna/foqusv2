/** Blocks (§4.4, §5.7, §5.8). Every placement re-checks the hard rule inside the transaction. */
import { getDb } from "@/db";
import { getPlacementContext, getSettings } from "@/data/queries";
import { checkPlacement } from "@/lib/placement";
import { startOfWeek, todayIn, toLocalDate } from "@/lib/time";
import type { Block, BlockOrigin, Instant, TableName } from "@/types";
import { nowInstant } from "./clock";
import { createRow, softDelete, updateRow } from "./rows";
import { writeTx } from "./tx";

const BLOCK_TABLES: TableName[] = ["blocks", "actions", "settings", "availability_windows", "peak_windows", "personal_blocks"];

export interface Placement {
  /** Epoch ms. */
  start: number;
  pomodoros: number;
  bufferMinutes: number;
}

/**
 * Validate a placement for `actionId` and compute the stored flags. Throws a plain sentence when
 * the hard rule (no overlap with another FOQUS block) or the day boundary is broken. Soft warnings
 * are the UI's business: by the time this runs, the owner has confirmed them.
 */
async function resolvePlacement(actionId: string, p: Placement, blockId?: string) {
  const action = await getDb().t("actions").get(actionId);
  if (!action || action.deleted_at) throw new Error("That action no longer exists.");
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  const ctx = await getPlacementContext(toLocalDate(p.start, settings.timezone));
  const max = ctx.settings.max_pomodoros_per_block;
  if (!Number.isInteger(p.pomodoros) || p.pomodoros < 1 || p.pomodoros > max) {
    throw new Error(`A block holds 1 to ${max} pomodoros.`);
  }
  if (!Number.isInteger(p.bufferMinutes) || p.bufferMinutes < 0 || p.bufferMinutes > 120) throw new Error("Pick a buffer between 0 and 120 minutes.");
  // A recurring occurrence is tied to its week (§5.5).
  if (action.occurrence_date && startOfWeek(toLocalDate(p.start, settings.timezone)) !== startOfWeek(action.occurrence_date)) {
    throw new Error("A recurring action can only move within its own week.");
  }
  const result = checkPlacement({
    start: p.start,
    pomodoros: p.pomodoros,
    bufferMinutes: p.bufferMinutes,
    blockId,
    action,
    timeZone: ctx.settings.timezone,
    today: todayIn(nowInstant(), ctx.settings.timezone),
    availability: ctx.availability,
    peak: ctx.peak,
    personal: ctx.personal,
    events: [],
    blocks: ctx.blocks,
    dailyCap: ctx.settings.daily_pomodoro_cap,
  });
  if (!result.ok) throw new Error(result.message);
  return {
    starts_at: new Date(result.start).toISOString(),
    ends_at: new Date(result.end).toISOString(),
    planned_pomodoros: p.pomodoros,
    buffer_minutes: p.bufferMinutes,
    off_peak: result.offPeak,
    after_due: result.afterDue,
  };
}

/** Place a new block. Manually placed blocks are committed immediately (§5.7). */
export async function placeBlock(actionId: string, p: Placement, origin: BlockOrigin = "manual"): Promise<Block> {
  return writeTx(BLOCK_TABLES, async () =>
    createRow("blocks", {
      action_id: actionId,
      ...(await resolvePlacement(actionId, p)),
      status: "scheduled",
      completed_pomodoros: 0,
      resolution: null,
      resolved_at: null,
      origin,
      replaced_by_block_id: null,
    }),
  );
}

/** Move, resize, or change the buffer of an existing block. `ends_at` follows `starts_at` and pomodoros. */
export async function updateBlockPlacement(id: string, p: Placement): Promise<Block> {
  return writeTx(BLOCK_TABLES, async () => {
    const block = await getDb().t("blocks").get(id);
    if (!block || block.deleted_at) throw new Error("That block no longer exists.");
    return updateRow("blocks", id, await resolvePlacement(block.action_id, p, id));
  });
}

/** "Mark done" from the block sheet: the block counts as done with its planned pomodoros. */
export async function markBlockDone(id: string): Promise<Block> {
  return writeTx(["blocks"], async () => {
    const block = await getDb().t("blocks").get(id);
    if (!block || block.deleted_at) throw new Error("That block no longer exists.");
    // Done before its end: the rest of the slot is free again.
    const now = Math.floor(Date.parse(nowInstant()) / 60_000) * 60_000;
    const early = now > Date.parse(block.starts_at) && now < Date.parse(block.ends_at);
    return updateRow("blocks", id, {
      status: "done",
      completed_pomodoros: Math.max(block.completed_pomodoros, block.planned_pomodoros),
      ...(early ? { ends_at: new Date(now).toISOString() } : {}),
    });
  });
}

export function deleteBlock(id: string): Promise<void> {
  return softDelete("blocks", id);
}

/**
 * Soft-delete blocks of these actions that have not started yet (draft or scheduled, starting after
 * `now`). Used when an action is done or dropped and when a goal is dropped (§5.3, §5.4).
 */
export async function deleteFutureBlocks(actionIds: readonly string[], now: Instant = nowInstant()): Promise<number> {
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
