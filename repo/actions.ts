/** Actions and the week list (§5.4). */
import { getDb } from "@/db";
import { OTHER_AREA_ID } from "@/db/seed";
import { checkActionOwner, clampEstimate, cleanTitle } from "@/lib/actions";
import { nextOrder } from "@/lib/order";
import { startOfWeek } from "@/lib/time";
import type { Action, RowPatch, TableName } from "@/types";
import { deleteAllBlocks, deleteFutureBlocks } from "./blocks";
import { nowInstant } from "./clock";
import { createRow, softDelete, updateRow } from "./rows";
import { liveWhere, writeTx } from "./tx";

const ACTION_TABLES: TableName[] = ["actions", "blocks", "goals", "areas", "major_moves", "season_plans"];

export interface NewAction {
  title: string;
  goal_id?: string | null;
  area_id?: string | null;
  major_move_id?: string | null;
  estimate_pomodoros?: number;
  due_on?: string | null;
  notes?: string | null;
  /** Monday of the week list, or null for the backlog. */
  planned_week?: string | null;
  /** Size of each session for work that needs several sittings; null for one block. */
  session_pomodoros?: number | null;
}

type Owner = Pick<Action, "goal_id" | "area_id" | "major_move_id">;

/** Validate that the owner exists and the move belongs to the goal. Throws a plain sentence. */
export async function checkOwner(owner: Owner): Promise<void> {
  checkActionOwner(owner);
  const db = getDb();
  if (owner.goal_id) {
    const goal = await db.t("goals").get(owner.goal_id);
    if (!goal || goal.deleted_at) throw new Error("That goal no longer exists.");
  }
  if (owner.area_id) {
    const area = await db.t("areas").get(owner.area_id);
    if (!area || area.deleted_at) throw new Error("That area no longer exists.");
  }
  if (owner.major_move_id) {
    const move = await db.t("major_moves").get(owner.major_move_id);
    const plan = move && !move.deleted_at ? await db.t("season_plans").get(move.season_plan_id) : undefined;
    if (!plan || plan.goal_id !== owner.goal_id) throw new Error("That major move is not part of this goal.");
  }
}

/** Live actions sharing an owner list (same goal, or same area). */
async function siblings(owner: Owner): Promise<Action[]> {
  return owner.goal_id ? liveWhere("actions", "goal_id", owner.goal_id) : liveWhere("actions", "area_id", owner.area_id ?? "");
}

/**
 * Create an action. With neither a goal nor an area it lands in "Other"; the estimate defaults to 1
 * (§6.7 Quick add). It goes to the end of its list.
 */
export async function addAction(input: NewAction): Promise<Action> {
  const owner: Owner = {
    goal_id: input.goal_id ?? null,
    area_id: input.goal_id ? null : (input.area_id ?? OTHER_AREA_ID),
    major_move_id: input.goal_id ? (input.major_move_id ?? null) : null,
  };
  const title = cleanTitle(input.title);
  return writeTx(ACTION_TABLES, async () => {
    await checkOwner(owner);
    return createRow("actions", {
      ...owner,
      title,
      notes: input.notes?.trim() || null,
      estimate_pomodoros: clampEstimate(input.estimate_pomodoros ?? 1),
      due_on: input.due_on || null,
      status: "todo",
      planned_week: input.planned_week ?? null,
      sort_order: nextOrder((await siblings(owner)).map((a) => a.sort_order)),
      reschedule_count: 0,
      recurrence_rule_id: null,
      occurrence_date: null,
      completed_at: null,
      session_pomodoros: cleanSession(input.session_pomodoros ?? null),
    });
  });
}

export type ActionEdit = Partial<
  Pick<Action, "title" | "notes" | "goal_id" | "area_id" | "major_move_id" | "estimate_pomodoros" | "due_on" | "planned_week" | "session_pomodoros">
>;

/** A session is 1 to 8 pomodoros (the settings maximum per block); null means one block. */
function cleanSession(n: number | null): number | null {
  if (n === null) return null;
  if (!Number.isInteger(n) || n < 1 || n > 8) throw new Error("A session is 1 to 8 pomodoros.");
  return n;
}

/**
 * Edit an action, including moving it between goals, areas, and major moves. Moving to an area
 * clears the major move; moving to another list puts the action at its end.
 */
export async function updateAction(id: string, edit: ActionEdit): Promise<Action> {
  return writeTx(ACTION_TABLES, async () => {
    const current = await getDb().t("actions").get(id);
    if (!current || current.deleted_at) throw new Error("That action no longer exists.");
    const patch: RowPatch<Action> = {};
    if (edit.title !== undefined) patch.title = cleanTitle(edit.title);
    if (edit.notes !== undefined) patch.notes = edit.notes?.trim() || null;
    if (edit.estimate_pomodoros !== undefined) patch.estimate_pomodoros = clampEstimate(edit.estimate_pomodoros);
    if (edit.due_on !== undefined) patch.due_on = edit.due_on || null;
    if (edit.session_pomodoros !== undefined) patch.session_pomodoros = cleanSession(edit.session_pomodoros);
    if (edit.planned_week !== undefined && edit.planned_week !== current.planned_week) {
      if (current.occurrence_date) throw new Error("A recurring action stays in its own week.");
      patch.planned_week = edit.planned_week;
    }

    if (edit.goal_id !== undefined || edit.area_id !== undefined || edit.major_move_id !== undefined) {
      const goal_id = edit.goal_id !== undefined ? edit.goal_id : current.goal_id;
      const owner: Owner = {
        goal_id,
        area_id: goal_id ? null : edit.area_id !== undefined ? edit.area_id : current.area_id,
        major_move_id: goal_id
          ? edit.major_move_id !== undefined
            ? edit.major_move_id
            : goal_id === current.goal_id
              ? current.major_move_id
              : null
          : null,
      };
      await checkOwner(owner);
      const listChanged = owner.goal_id !== current.goal_id || owner.area_id !== current.area_id;
      Object.assign(patch, owner);
      if (listChanged) patch.sort_order = nextOrder((await siblings(owner)).map((a) => a.sort_order));
    }
    return updateRow("actions", id, patch);
  });
}

/** Mark done (§5.4): sets `completed_at` and deletes the action's future blocks. */
export async function completeAction(id: string): Promise<void> {
  await writeTx(ACTION_TABLES, async () => {
    const now = nowInstant();
    await updateRow("actions", id, { status: "done", completed_at: now });
    await deleteFutureBlocks([id], now);
  });
}

/** Back to todo from done or dropped. */
export async function reopenAction(id: string): Promise<void> {
  await updateRow("actions", id, { status: "todo", completed_at: null });
}

/** Drop an action: it stays in history but leaves every list, and its future blocks go. */
export async function dropAction(id: string): Promise<void> {
  await writeTx(ACTION_TABLES, async () => {
    await updateRow("actions", id, { status: "dropped" });
    await deleteFutureBlocks([id], nowInstant());
  });
}

/** Soft-delete an action and its blocks. */
export async function deleteAction(id: string): Promise<void> {
  await writeTx(ACTION_TABLES, async () => {
    await deleteAllBlocks([id]);
    await softDelete("actions", id);
  });
}

/** Put or take an action on a week list (§5.4). `weekStart` is that week's Monday, or null. */
export async function setPlannedWeek(id: string, weekStart: string | null): Promise<void> {
  const a = await getDb().t("actions").get(id);
  if (a?.occurrence_date && weekStart !== startOfWeek(a.occurrence_date)) throw new Error("A recurring action stays in its own week.");
  await updateRow("actions", id, { planned_week: weekStart });
}

/** Set sort orders to match `orderedIds` (one list, after a drag). */
export async function reorderActions(orderedIds: readonly string[]): Promise<void> {
  await writeTx(["actions"], async () => {
    for (const [i, id] of orderedIds.entries()) {
      const a = await getDb().t("actions").get(id);
      if (a && !a.deleted_at && a.sort_order !== i) await updateRow("actions", id, { sort_order: i });
    }
  });
}

/**
 * Week rollover (§5.4): every still-todo action from an earlier week's list moves to this week's.
 * Before Step 2.3 there is no weekly review, so this always applies. Safe to run on every open.
 * Recurring occurrences never carry over: they are tied to their day and are dropped (§5.5).
 */
export async function rolloverWeek(weekStart: string): Promise<number> {
  return writeTx(["actions"], async () => {
    const stale = (await getDb().t("actions").where("planned_week").below(weekStart).toArray()).filter(
      (a) => !a.deleted_at && a.status === "todo",
    );
    for (const a of stale) await updateRow("actions", a.id, a.occurrence_date ? { status: "dropped" } : { planned_week: weekStart });
    return stale.filter((a) => !a.occurrence_date).length;
  });
}
