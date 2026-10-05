/** The weekly draft (§5.11): draft blocks for the week, then Commit or Discard. */
import { getDb } from "@/db";
import { getDaySchedule, getPersonalBlocks, getSettings } from "@/data/queries";
import { actionNumbers } from "@/lib/actions";
import { draftWeek, type DidntFit } from "@/lib/draft";
import { addDays, dayBounds, endOfWeek, seasonOfDate, todayIn, weekDates } from "@/lib/time";
import type { Block, DateString, Weekday } from "@/types";
import { nowInstant } from "./clock";
import { createRow, softDelete, updateRow } from "./rows";
import { ALL_TABLES, writeTx } from "./tx";

async function weekBlocks(weekStart: DateString, timeZone: string): Promise<Block[]> {
  const from = dayBounds(addDays(weekStart, -1), timeZone).start;
  const to = dayBounds(endOfWeek(weekStart), timeZone).end;
  return (await getDb().t("blocks").where("starts_at").between(from, to, true, false).toArray()).filter((b) => !b.deleted_at);
}

async function draftsIn(weekStart: DateString, timeZone: string): Promise<Block[]> {
  const { start } = dayBounds(weekStart, timeZone);
  return (await weekBlocks(weekStart, timeZone)).filter((b) => b.status === "draft" && b.starts_at >= start);
}

export interface DraftResult {
  placed: number;
  didntFit: DidntFit[];
}

/**
 * "Draft my week": replace any earlier draft with a new one for the week's remaining days.
 * Committed blocks stay untouched.
 */
export async function draftMyWeek(weekStart: DateString): Promise<DraftResult> {
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  const tz = settings.timezone;
  const now = nowInstant();
  const today = todayIn(now, tz);
  const schedules = new Map<number, Awaited<ReturnType<typeof getDaySchedule>>>();
  for (const d of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) schedules.set(d, await getDaySchedule(d));
  const personal = await getPersonalBlocks();

  return writeTx(ALL_TABLES, async () => {
    for (const b of await draftsIn(weekStart, tz)) await softDelete("blocks", b.id);
    const committed = await weekBlocks(weekStart, tz);
    const list = (await getDb().t("actions").where("planned_week").equals(weekStart).toArray()).filter((a) => !a.deleted_at && a.status === "todo");
    const goals = new Map((await getDb().t("goals").toArray()).filter((g) => !g.deleted_at).map((g) => [g.id, g]));
    const plans = (await getDb().t("season_plans").toArray()).filter((p) => !p.deleted_at);
    const rules = new Map((await getDb().t("recurrence_rules").toArray()).map((r) => [r.id, r]));
    const items = [];
    for (const action of list) {
      if (action.goal_id && goals.get(action.goal_id)?.status !== "active") continue;
      const blocks = (await getDb().t("blocks").where("action_id").equals(action.id).toArray()).filter((b) => !b.deleted_at);
      const unscheduled = actionNumbers(action, blocks, now).unscheduled;
      if (unscheduled <= 0) continue;
      const goalPlans = action.goal_id ? plans.filter((p) => p.goal_id === action.goal_id) : [];
      items.push({
        action,
        unscheduled,
        goalRank: action.goal_id ? (goals.get(action.goal_id)?.rank ?? null) : null,
        planEndsOn: (goalPlans.find((p) => p.season_id === seasonOfDate(today)) ?? goalPlans[0])?.ends_on ?? null,
        preferredStart: action.recurrence_rule_id ? (rules.get(action.recurrence_rule_id)?.preferred_start ?? null) : null,
      });
    }
    const result = draftWeek({
      items,
      days: weekDates(weekStart),
      today,
      now,
      timeZone: tz,
      windows: (w) => ({ availability: schedules.get(w)?.availability, peak: schedules.get(w)?.peak }),
      personal,
      events: [],
      blocks: committed,
      dailyCap: settings.daily_pomodoro_cap,
      maxPerBlock: settings.max_pomodoros_per_block,
      bufferMinutes: settings.default_buffer_minutes,
    });
    for (const b of result.blocks) {
      await createRow("blocks", {
        action_id: b.action_id,
        starts_at: new Date(b.start).toISOString(),
        ends_at: new Date(b.end).toISOString(),
        planned_pomodoros: b.pomodoros,
        buffer_minutes: b.bufferMinutes,
        status: "draft",
        completed_pomodoros: 0,
        resolution: null,
        resolved_at: null,
        origin: "draft",
        off_peak: b.offPeak,
        after_due: b.afterDue,
        replaced_by_block_id: null,
      });
    }
    return { placed: result.blocks.length, didntFit: result.didntFit };
  });
}

/** Commit: every draft block becomes scheduled. Drafts whose start has already passed are dropped. */
export async function commitDraft(weekStart: DateString): Promise<number> {
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  return writeTx(ALL_TABLES, async () => {
    const now = nowInstant();
    let n = 0;
    for (const b of await draftsIn(weekStart, settings.timezone)) {
      if (b.starts_at < now) await softDelete("blocks", b.id);
      else {
        await updateRow("blocks", b.id, { status: "scheduled" });
        n++;
      }
    }
    return n;
  });
}

/** Discard: every draft block of the week is removed. */
export async function discardDraft(weekStart: DateString): Promise<number> {
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  return writeTx(ALL_TABLES, async () => {
    const drafts = await draftsIn(weekStart, settings.timezone);
    for (const b of drafts) await softDelete("blocks", b.id);
    return drafts.length;
  });
}
