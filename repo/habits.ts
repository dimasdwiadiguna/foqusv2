/** Elastic habits (Stage 2 exit): the habits and one log per habit per day. */
import { getDb } from "@/db";
import { getSettings } from "@/data/queries";
import { isCheckinEditable } from "@/lib/checkin";
import { checkHabit, countLevel, type HabitInput, type Level } from "@/lib/habits";
import { habitLogId } from "@/lib/ids";
import { nextOrder } from "@/lib/order";
import { todayIn } from "@/lib/time";
import type { DateString, Habit, HabitLog } from "@/types";
import { checkOwner } from "./actions";
import { nowInstant } from "./clock";
import { createRow, softDelete, updateRow } from "./rows";
import { ALL_TABLES, writeTx } from "./tx";

export interface NewHabit extends HabitInput {
  goal_id?: string | null;
  area_id?: string | null;
}

const owner = (i: Pick<NewHabit, "goal_id" | "area_id">) => ({ goal_id: i.goal_id ?? null, area_id: i.goal_id ? null : (i.area_id ?? null) });

async function checkLink(o: { goal_id: string | null; area_id: string | null }) {
  if (o.goal_id || o.area_id) await checkOwner({ ...o, major_move_id: null });
}

export async function createHabit(input: NewHabit): Promise<Habit> {
  const clean = checkHabit(input);
  const o = owner(input);
  return writeTx(ALL_TABLES, async () => {
    await checkLink(o);
    const all = (await getDb().t("habits").toArray()).filter((h) => !h.deleted_at);
    return createRow("habits", { ...clean, ...o, active: true, sort_order: nextOrder(all.map((h) => h.sort_order)), archived_at: null });
  });
}

export type HabitEdit = Partial<NewHabit & { active: boolean }>;

/** Edit a habit. Past logs keep their levels; changed thresholds apply from the next count. */
export async function updateHabit(id: string, edit: HabitEdit): Promise<Habit> {
  return writeTx(ALL_TABLES, async () => {
    const h = await getDb().t("habits").get(id);
    if (!h || h.deleted_at) throw new Error("That habit no longer exists.");
    const clean = checkHabit({
      title: edit.title ?? h.title,
      kind: edit.kind ?? h.kind,
      unit: edit.unit !== undefined ? edit.unit : h.unit,
      levels: edit.levels ?? h.levels,
      weekdays: edit.weekdays ?? h.weekdays,
    });
    const o = edit.goal_id !== undefined || edit.area_id !== undefined ? owner({ goal_id: edit.goal_id ?? null, area_id: edit.area_id ?? null }) : { goal_id: h.goal_id, area_id: h.area_id };
    await checkLink(o);
    return updateRow("habits", id, { ...clean, ...o, active: edit.active ?? h.active });
  });
}

export async function archiveHabit(id: string, archived = true): Promise<void> {
  await updateRow("habits", id, { archived_at: archived ? nowInstant() : null });
}

export async function deleteHabit(id: string): Promise<void> {
  await softDelete("habits", id);
}

export async function reorderHabits(ids: readonly string[]): Promise<void> {
  await writeTx(["habits"], async () => {
    for (const [i, id] of ids.entries()) {
      const h = await getDb().t("habits").get(id);
      if (h && !h.deleted_at && h.sort_order !== i) await updateRow("habits", id, { sort_order: i });
    }
  });
}

/**
 * Log a day: a count (count habits; the level follows from the thresholds) or a level (level
 * habits). Editable for today and yesterday, like check-ins.
 */
export async function logHabit(habitId: string, date: DateString, value: { count: number } | { level: Level }): Promise<HabitLog> {
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  if (!isCheckinEditable(date, todayIn(nowInstant(), settings.timezone))) throw new Error("A habit can only be logged for today or yesterday.");
  return writeTx(["habits", "habit_logs"], async () => {
    const h = await getDb().t("habits").get(habitId);
    if (!h || h.deleted_at) throw new Error("That habit no longer exists.");
    let fields: Pick<HabitLog, "level" | "count">;
    if ("count" in value) {
      if (h.kind !== "count") throw new Error("This habit is marked by level, not counted.");
      const count = Math.max(0, Math.min(Math.round(value.count), 1000));
      fields = { count, level: countLevel(count, h.levels) };
    } else {
      if (![0, 1, 2, 3].includes(value.level)) throw new Error("Pick Min, Std, or Elite.");
      fields = { level: value.level, count: null };
    }
    const id = habitLogId(habitId, date);
    const t = getDb().t("habit_logs");
    const current = await t.get(id);
    if (!current) return createRow("habit_logs", { id, habit_id: habitId, date, ...fields });
    if (current.deleted_at) {
      const revived = { ...current, ...fields, deleted_at: null, updated_at: nowInstant(), _dirty: 1 as const };
      await t.put(revived);
      return revived;
    }
    return updateRow("habit_logs", id, fields);
  });
}
