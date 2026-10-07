/**
 * Recurring actions (§5.5). A rule generates one action per matching weekday of the week, with the
 * deterministic id `<rule_id>:<date>`, so opening the app twice never creates an occurrence twice.
 * Editing, pausing, or deleting a rule only changes occurrences from today on that the owner has
 * not touched (no block yet).
 */
import { getDb } from "@/db";
import { getSettings } from "@/data/queries";
import { occurrenceId } from "@/lib/ids";
import { nextOrder } from "@/lib/order";
import { checkRule, occurrenceDates, type RuleInput } from "@/lib/recurrence";
import { seasonOfDate, startOfWeek, todayIn, weekDates } from "@/lib/time";
import type { Action, DateString, RecurrenceRule } from "@/types";
import { checkOwner } from "./actions";
import { nowInstant } from "./clock";
import { createRow, softDelete, updateRow } from "./rows";
import { ALL_TABLES, liveWhere, writeTx } from "./tx";

export interface NewRule extends Omit<RuleInput, "starts_on" | "ends_on"> {
  goal_id?: string | null;
  area_id?: string | null;
  major_move_id?: string | null;
  starts_on?: DateString;
  /** Defaults to the goal's current season plan end; open-ended for area rules. */
  ends_on?: DateString | null;
}

async function today(): Promise<{ today: DateString; maxPerBlock: number }> {
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  return { today: todayIn(nowInstant(), settings.timezone), maxPerBlock: settings.max_pomodoros_per_block };
}

/** Whether an occurrence is still the rule's to change: todo, with no live block. */
async function untouched(a: Action): Promise<boolean> {
  if (a.status !== "todo") return false;
  const blocks = await liveWhere("blocks", "action_id", a.id);
  return blocks.every((b) => b.status === "missed" && b.resolution === "dropped");
}

/** Bring this week's occurrences of one rule in line with it, from `day` on. Runs inside a transaction. */
async function syncRule(rule: RecurrenceRule, weekStart: DateString, day: DateString): Promise<number> {
  const wanted = new Set(occurrenceDates(rule, weekStart, day));
  let created = 0;
  for (const date of weekDates(weekStart)) {
    if (date < day) continue;
    const id = occurrenceId(rule.id, date);
    const existing = await getDb().t("actions").get(id);
    if (wanted.has(date)) {
      if (!existing) {
        const siblings = rule.goal_id ? await liveWhere("actions", "goal_id", rule.goal_id) : await liveWhere("actions", "area_id", rule.area_id ?? "");
        await createRow("actions", {
          id,
          goal_id: rule.goal_id,
          area_id: rule.area_id,
          major_move_id: rule.major_move_id,
          title: rule.title,
          notes: null,
          estimate_pomodoros: rule.pomodoros,
          due_on: null,
          status: "todo",
          planned_week: weekStart,
          sort_order: nextOrder(siblings.map((a) => a.sort_order)),
          reschedule_count: 0,
          recurrence_rule_id: rule.id,
          occurrence_date: date,
          completed_at: null,
          session_pomodoros: null,
        });
        created++;
      } else if (!existing.deleted_at && (await untouched(existing))) {
        // An occurrence the owner deleted stays deleted; a live, untouched one follows the rule.
        const patch = {
          title: rule.title,
          estimate_pomodoros: rule.pomodoros,
          goal_id: rule.goal_id,
          area_id: rule.area_id,
          major_move_id: rule.major_move_id,
        };
        if (Object.entries(patch).some(([k, v]) => existing[k as keyof Action] !== v)) await updateRow("actions", id, patch);
      }
    } else if (existing && !existing.deleted_at && (await untouched(existing))) {
      await softDelete("actions", id);
    }
  }
  return created;
}

/**
 * Generate this week's occurrences for every rule (§5.5), from today on. Safe to run on every open:
 * ids are deterministic and existing occurrences are left alone.
 */
export async function generateOccurrences(weekStart: DateString, day: DateString): Promise<number> {
  return writeTx(ALL_TABLES, async () => {
    let n = 0;
    for (const rule of await getDb().t("recurrence_rules").toArray()) {
      if (rule.deleted_at || !rule.active) continue;
      n += await syncRule(rule, weekStart, day);
    }
    return n;
  });
}

function owner(input: Pick<NewRule, "goal_id" | "area_id" | "major_move_id">) {
  return {
    goal_id: input.goal_id ?? null,
    area_id: input.goal_id ? null : (input.area_id ?? null),
    major_move_id: input.goal_id ? (input.major_move_id ?? null) : null,
  };
}

async function defaultEnd(goalId: string | null, day: DateString): Promise<DateString | null> {
  if (!goalId) return null;
  const plans = (await liveWhere("season_plans", "goal_id", goalId)).sort((a, b) => a.ends_on.localeCompare(b.ends_on));
  return (plans.find((p) => p.season_id === seasonOfDate(day)) ?? plans.find((p) => p.ends_on >= day) ?? plans[plans.length - 1])?.ends_on ?? null;
}

export async function createRule(input: NewRule): Promise<RecurrenceRule> {
  const { today: day, maxPerBlock } = await today();
  const o = owner(input);
  if (!o.goal_id && !o.area_id) throw new Error("Pick a goal or an area.");
  return writeTx(ALL_TABLES, async () => {
    await checkOwner(o);
    const starts_on = input.starts_on ?? day;
    const ends_on = input.ends_on !== undefined ? input.ends_on : await defaultEnd(o.goal_id, starts_on);
    const clean = checkRule({ ...input, starts_on, ends_on }, maxPerBlock);
    const rule = await createRow("recurrence_rules", { ...o, ...clean, active: true });
    await syncRule(rule, startOfWeek(day), day);
    return rule;
  });
}

export type RuleEdit = Partial<RuleInput & { active: boolean; goal_id: string | null; area_id: string | null; major_move_id: string | null }>;

/** Edit or pause a rule. Only occurrences from today on that have no block yet change. */
export async function updateRule(id: string, edit: RuleEdit): Promise<RecurrenceRule> {
  const { today: day, maxPerBlock } = await today();
  return writeTx(ALL_TABLES, async () => {
    const current = await getDb().t("recurrence_rules").get(id);
    if (!current || current.deleted_at) throw new Error("That recurring action no longer exists.");
    const ownerChanged = edit.goal_id !== undefined || edit.area_id !== undefined || edit.major_move_id !== undefined;
    const o = ownerChanged
      ? owner({ goal_id: edit.goal_id !== undefined ? edit.goal_id : current.goal_id, area_id: edit.area_id !== undefined ? edit.area_id : current.area_id, major_move_id: edit.major_move_id !== undefined ? edit.major_move_id : current.major_move_id })
      : { goal_id: current.goal_id, area_id: current.area_id, major_move_id: current.major_move_id };
    if (!o.goal_id && !o.area_id) throw new Error("Pick a goal or an area.");
    if (ownerChanged) await checkOwner(o);
    const clean = checkRule(
      {
        title: edit.title ?? current.title,
        weekdays: edit.weekdays ?? current.weekdays,
        pomodoros: edit.pomodoros ?? current.pomodoros,
        preferred_start: edit.preferred_start !== undefined ? edit.preferred_start : current.preferred_start,
        starts_on: edit.starts_on ?? current.starts_on,
        ends_on: edit.ends_on !== undefined ? edit.ends_on : current.ends_on,
      },
      maxPerBlock,
    );
    const rule = await updateRow("recurrence_rules", id, { ...o, ...clean, active: edit.active ?? current.active });
    await syncRule(rule, startOfWeek(day), day);
    return rule;
  });
}

/** Delete a rule. Past occurrences stay; untouched ones from today on go. */
export async function deleteRule(id: string): Promise<void> {
  const { today: day } = await today();
  await writeTx(ALL_TABLES, async () => {
    const rule = await getDb().t("recurrence_rules").get(id);
    if (!rule || rule.deleted_at) return;
    await softDelete("recurrence_rules", id);
    await syncRule({ ...rule, deleted_at: nowInstant() }, startOfWeek(day), day);
  });
}
