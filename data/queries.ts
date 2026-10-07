/**
 * Read queries. Every read filters out soft-deleted rows (§3.2.3). Hooks in this folder wrap these
 * in live queries so screens update when the data changes.
 */
import { getDb } from "@/db";
import { SETTINGS_ID } from "@/db/seed";
import type {
  Action,
  Area,
  AvailabilityWindow,
  Block,
  DailyCheckin,
  FocusSession,
  Goal,
  MajorMove,
  PeakWindow,
  PersonalBlock,
  RecurrenceRule,
  Season,
  SeasonPlan,
  Settings,
  TableName,
  Tables,
  Weekday,
} from "@/types";
import { availabilityId, peakId } from "@/lib/ids";
import { addDays, dayBounds, endOfWeek, todayIn, weekDates, weekdayOf } from "@/lib/time";
import { capacity, type Capacity } from "@/lib/capacity";
import { completedByAction } from "@/lib/actions";
import { BACKUP_TABLES, buildBackup, type Backup } from "@/lib/backup";
import { checkinDays, focusDays, streakFrom, type Streak } from "@/lib/streaks";

export async function getRow<N extends TableName>(table: N, id: string): Promise<Tables[N] | undefined> {
  const row = await getDb().t(table).get(id);
  return row && !row.deleted_at ? row : undefined;
}

export async function getAllRows<N extends TableName>(table: N): Promise<Tables[N][]> {
  return getDb()
    .t(table)
    .filter((row) => !row.deleted_at)
    .toArray();
}

export function getSettings(): Promise<Settings | undefined> {
  return getRow("settings", SETTINGS_ID);
}

// ---------------------------------------------------------------------------
// Step 1.2: areas, seasons, goals, actions


async function liveWhere<N extends TableName>(table: N, index: string, value: string): Promise<Tables[N][]> {
  return (await getDb().t(table).where(index).equals(value).toArray()).filter((r) => !r.deleted_at);
}

const bySortOrder = <T extends { sort_order: number; created_at: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

/** Areas in their sort order. Archived areas only when asked. */
export async function getAreas(includeArchived = false): Promise<Area[]> {
  const all = await getAllRows("areas");
  return all.filter((a) => includeArchived || !a.archived_at).sort(bySortOrder);
}

export async function getSeasons(): Promise<Season[]> {
  return (await getAllRows("seasons")).sort((a, b) => a.id.localeCompare(b.id));
}

export interface GoalWithPlan {
  goal: Goal;
  plan: SeasonPlan;
}

/** Goals that have a plan in this season: active by rank, then closed goals by when they closed. */
export async function getGoalsInSeason(seasonId: string): Promise<GoalWithPlan[]> {
  const plans = await liveWhere("season_plans", "season_id", seasonId);
  const out: GoalWithPlan[] = [];
  for (const plan of plans) {
    const goal = await getRow("goals", plan.goal_id);
    if (goal) out.push({ goal, plan });
  }
  return out.sort((a, b) => {
    const aActive = a.goal.status === "active" ? 0 : 1;
    const bActive = b.goal.status === "active" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    if (aActive === 0) return a.goal.rank - b.goal.rank || a.goal.created_at.localeCompare(b.goal.created_at);
    return (b.goal.closed_at ?? "").localeCompare(a.goal.closed_at ?? "");
  });
}

export function getPlansForGoal(goalId: string): Promise<SeasonPlan[]> {
  return liveWhere("season_plans", "goal_id", goalId).then((p) => p.sort((a, b) => a.season_id.localeCompare(b.season_id)));
}

export async function getMajorMoves(planId: string): Promise<MajorMove[]> {
  return (await liveWhere("major_moves", "season_plan_id", planId)).sort(bySortOrder);
}

export async function getActionsForGoal(goalId: string): Promise<Action[]> {
  return (await liveWhere("actions", "goal_id", goalId)).sort(bySortOrder);
}

export async function getActionsForArea(areaId: string): Promise<Action[]> {
  return (await liveWhere("actions", "area_id", areaId)).sort(bySortOrder);
}

export async function getBlocksForActions(actionIds: readonly string[]): Promise<Block[]> {
  if (actionIds.length === 0) return [];
  return (await getDb().t("blocks").where("action_id").anyOf([...actionIds]).toArray()).filter((b) => !b.deleted_at);
}

/** Completed pomodoros per action, across all blocks. */
export async function getCompletedByAction(): Promise<Map<string, number>> {
  return completedByAction(await getAllRows("blocks"));
}

/** Unresolved season plans of active goals: the input to the concurrent-goal warning (§5.3). */
export async function getActivePlanSpans(): Promise<SeasonPlan[]> {
  const active = new Set(
    (await getDb().t("goals").where("status").equals("active").toArray()).filter((g) => !g.deleted_at).map((g) => g.id),
  );
  return (await getAllRows("season_plans")).filter((p) => p.resolution === null && active.has(p.goal_id));
}

/** Count of open (todo) area tasks per area. */
export async function getOpenCountsByArea(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const a of await getDb().t("actions").where("status").equals("todo").toArray()) {
    if (a.deleted_at || !a.area_id) continue;
    out.set(a.area_id, (out.get(a.area_id) ?? 0) + 1);
  }
  return out;
}

/** Active goals in rank order (for pickers). */
export async function getActiveGoals(): Promise<Goal[]> {
  return (await getDb().t("goals").where("status").equals("active").toArray())
    .filter((g) => !g.deleted_at)
    .sort((a, b) => a.rank - b.rank);
}

/** Open major moves of a goal's unresolved plans (for pickers). */
export async function getMovesForGoal(goalId: string): Promise<MajorMove[]> {
  const plans = (await getPlansForGoal(goalId)).filter((p) => p.resolution === null);
  const moves: MajorMove[] = [];
  for (const p of plans) moves.push(...(await getMajorMoves(p.id)));
  return moves;
}

// ---------------------------------------------------------------------------
// Step 1.3: schedule, blocks, placement


export interface DaySchedule {
  availability: AvailabilityWindow | undefined;
  peak: PeakWindow | undefined;
}

export async function getDaySchedule(weekday: Weekday): Promise<DaySchedule> {
  return {
    availability: await getRow("availability_windows", availabilityId(weekday)),
    peak: await getRow("peak_windows", peakId(weekday)),
  };
}

export async function getPersonalBlocks(): Promise<PersonalBlock[]> {
  return (await getAllRows("personal_blocks")).sort((a, b) => a.start_time.localeCompare(b.start_time) || a.label.localeCompare(b.label));
}

/** Live blocks starting in `[fromIso, toIso)`, by start. */
export async function getBlocksBetween(fromIso: string, toIso: string): Promise<Block[]> {
  const rows = await getDb().t("blocks").where("starts_at").between(fromIso, toIso, true, false).toArray();
  return rows.filter((b) => !b.deleted_at).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Blocks on the local dates `from`…`to` (inclusive) in the zone. */
export function getBlocksForDays(from: string, to: string, timeZone: string): Promise<Block[]> {
  return getBlocksBetween(dayBounds(from, timeZone).start, dayBounds(to, timeZone).end);
}

export type TitledBlock = Block & { title: string };

/**
 * Everything `lib/placement` needs for a proposal on `date`: the day's windows, personal blocks,
 * settings, and the blocks of that day and its neighbours with their action titles.
 */
export async function getPlacementContext(date: string) {
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  const tz = settings.timezone;
  const blocks = await getBlocksForDays(addDays(date, -1), addDays(date, 1), tz);
  const titles = new Map<string, string>();
  for (const b of blocks) {
    if (!titles.has(b.action_id)) titles.set(b.action_id, (await getDb().t("actions").get(b.action_id))?.title ?? "");
  }
  return {
    settings,
    ...(await getDaySchedule(weekdayOf(date))),
    personal: await getPersonalBlocks(),
    blocks: blocks.map((b) => ({ ...b, title: titles.get(b.action_id) ?? "" })) as TitledBlock[],
  };
}

// ---------------------------------------------------------------------------
// Step 1.4: sessions, unresolved blocks, slot picking


/** The session that has not ended, if any. */
export async function getActiveSessionRow(): Promise<FocusSession | null> {
  return (await getAllRows("focus_sessions")).find((s) => s.ended_at === null && s.state.phase !== "ended") ?? null;
}

/** Unresolved blocks (§5.7): `scheduled` and ended before `nowMs`, oldest first. */
export async function getUnresolvedBlocks(nowMs: number): Promise<Block[]> {
  const rows = await getDb().t("blocks").where("status").equals("scheduled").toArray();
  return rows
    .filter((b) => !b.deleted_at && Date.parse(b.ends_at) < nowMs)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** What `lib/scheduler.pickSlot` needs from today to `until` (default: the end of this week). */
export async function getWeekContext(today: string, until: string = endOfWeek(today)) {
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  const windows = new Map<number, DaySchedule>();
  for (const d of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) windows.set(d, await getDaySchedule(d));
  return {
    settings,
    personal: await getPersonalBlocks(),
    blocks: await getBlocksForDays(addDays(today, -1), until, settings.timezone),
    windows: (w: Weekday) => ({ availability: windows.get(w)?.availability, peak: windows.get(w)?.peak }),
  };
}

// ---------------------------------------------------------------------------
// Step 1.5: backup


/** Every row of every table, soft-deleted rows included, as a backup file. */
export async function getBackup(now: string): Promise<Backup> {
  const tables = {} as Record<TableName, Record<string, unknown>[]>;
  for (const t of BACKUP_TABLES) tables[t] = (await getDb().t(t).toArray()) as unknown as Record<string, unknown>[];
  return buildBackup(tables, now);
}

/** Row counts per table, soft-deleted rows included. */
export async function getRowCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of BACKUP_TABLES) out[t] = await getDb().t(t).count();
  return out;
}

// ---------------------------------------------------------------------------
// Step 2.1: check-ins and streaks


/** Live check-ins, newest first. */
export async function getCheckins(): Promise<DailyCheckin[]> {
  return (await getAllRows("daily_checkins")).sort((a, b) => b.date.localeCompare(a.date));
}

/** Both streaks (§5.19) as of `today` in the settings time zone. */
export async function getStreaks(today: string, timeZone: string): Promise<{ checkin: Streak; focus: Streak }> {
  const goalActions = new Set((await getAllRows("actions")).filter((a) => a.goal_id).map((a) => a.id));
  const blocks = await getAllRows("blocks");
  return {
    checkin: streakFrom(checkinDays(await getAllRows("daily_checkins")), today),
    focus: streakFrom(focusDays(blocks, goalActions, timeZone), today),
  };
}

// ---------------------------------------------------------------------------
// Step 2.2: capacity


/** The capacity meter (§5.12) for the remaining days of `weekStart`'s week, at `nowMs`. */
export async function getCapacity(weekStart: string, nowMs: number): Promise<Capacity | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const tz = settings.timezone;
  const now = new Date(nowMs).toISOString();
  const today = todayIn(now, tz);
  const days = weekDates(weekStart).filter((d) => d >= today);
  if (days.length === 0) return null;
  const schedules = new Map<number, DaySchedule>();
  for (const d of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) schedules.set(d, await getDaySchedule(d));
  const blocks = await getBlocksForDays(days[0], days[days.length - 1], tz);
  const goalActions = new Set((await getAllRows("actions")).filter((a) => a.goal_id).map((a) => a.id));
  return capacity({
    days,
    timeZone: tz,
    now,
    windows: (w) => ({ availability: schedules.get(w)?.availability }),
    personal: await getPersonalBlocks(),
    events: [],
    blocks,
    goalActionIds: goalActions,
  });
}

/** Live recurring rules, by title. */
export async function getRules(): Promise<RecurrenceRule[]> {
  return (await getAllRows("recurrence_rules")).sort((a, b) => a.title.localeCompare(b.title));
}
