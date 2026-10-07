/**
 * Reads for Step 2.3: plan strength per goal, the week's review numbers, and everything the coach
 * rules need. Each gathers rows and hands them to the pure functions in `lib/`.
 */
import { getDb } from "@/db";
import { freeMinutes } from "@/lib/availability";
import { plannedBlocks } from "@/lib/checkin";
import { type CoachInput } from "@/lib/coach";
import { goalColor } from "@/lib/areas";
import { planStrength, type PlanStrength } from "@/lib/plan-strength";
import { dueReview } from "@/lib/review";
import { quarterlyDue } from "@/lib/quarterly";
import { followThrough, peakSplit, weekStats, type WeekStats } from "@/lib/stats";
import { addDays, dayBounds, parseSeasonId, quarterBounds, seasonOfDate, startOfWeek, todayIn, toLocalDate, weekDates, weekdayOf } from "@/lib/time";
import type { Block, Goal, SeasonPlan, Weekday } from "@/types";
import { getAllRows, getBlocksForDays, getCapacity, getDaySchedule, getBusyPersonal, getSettings, type DaySchedule } from "./queries";

const DAY = 24 * 60 * 60 * 1000;

export interface GoalStrength {
  goal: Goal;
  plan: SeasonPlan;
  strength: PlanStrength;
}

async function schedules(): Promise<Map<number, DaySchedule>> {
  const m = new Map<number, DaySchedule>();
  for (const d of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) m.set(d, await getDaySchedule(d));
  return m;
}

/** Plan strength for every active goal's current season plan, in rank order. */
export async function getStrengths(nowMs: number): Promise<GoalStrength[]> {
  const settings = await getSettings();
  if (!settings) return [];
  const tz = settings.timezone;
  const now = new Date(nowMs).toISOString();
  const today = todayIn(now, tz);
  const weekStart = startOfWeek(today);
  const weekSpan = { start: Date.parse(dayBounds(weekStart, tz).start), end: Date.parse(dayBounds(addDays(weekStart, 6), tz).end) };
  const goals = (await getAllRows("goals")).filter((g) => g.status === "active").sort((a, b) => a.rank - b.rank);
  const plans = await getAllRows("season_plans");
  const moves = await getAllRows("major_moves");
  const actions = await getAllRows("actions");
  const blocks = await getAllRows("blocks");
  const out: GoalStrength[] = [];
  for (const goal of goals) {
    const mine = plans.filter((p) => p.goal_id === goal.id);
    const plan = mine.find((p) => p.season_id === seasonOfDate(today)) ?? mine.find((p) => p.starts_on <= today && p.ends_on >= today);
    if (!plan) continue;
    const goalActions = actions.filter((a) => a.goal_id === goal.id);
    const ids = new Set(goalActions.map((a) => a.id));
    out.push({
      goal,
      plan,
      strength: planStrength({
        goal,
        plan,
        moves: moves.filter((m) => m.season_plan_id === plan.id),
        actions: goalActions,
        blocks: blocks.filter((b) => ids.has(b.action_id)),
        weekStart,
        weekSpan,
        now,
      }),
    });
  }
  return out;
}

/** The review numbers (§5.15) for a week, as of `nowMs`. */
export async function getWeekStats(weekStart: string, nowMs: number): Promise<WeekStats | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const tz = settings.timezone;
  const goals = new Map((await getDb().t("goals").toArray()).map((g) => [g.id, g]));
  const areas = new Map((await getDb().t("areas").toArray()).map((a) => [a.id, a]));
  return weekStats({
    weekStart,
    days: weekDates(weekStart),
    timeZone: tz,
    now: new Date(nowMs).toISOString(),
    blocks: await getBlocksForDays(weekStart, addDays(weekStart, 6), tz),
    actions: await getDb().t("actions").toArray(),
    owners: (key) => {
      const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
      if (kind === "goal") {
        const g = goals.get(id);
        return g ? { label: g.title, color: goalColor(g, areas) } : undefined;
      }
      const a = areas.get(id);
      return a ? { label: a.name, color: a.color } : undefined;
    },
    checkins: await getAllRows("daily_checkins"),
    focusMinutes: settings.focus_minutes,
  });
}

/** Whether a week had anything in it: planned blocks or check-ins. */
async function hadActivity(weekStart: string, tz: string): Promise<boolean> {
  const blocks = await getBlocksForDays(weekStart, addDays(weekStart, 6), tz);
  if (plannedBlocks(blocks).length > 0) return true;
  const days = new Set(weekDates(weekStart));
  return (await getAllRows("daily_checkins")).some((c) => days.has(c.date));
}

/** The weekly review due today (its week's Monday), or null. */
export async function getReviewDue(nowMs: number): Promise<string | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const tz = settings.timezone;
  const today = todayIn(nowMs, tz);
  const done = new Set((await getAllRows("weekly_reviews")).filter((r) => r.completed_at).map((r) => r.week_start));
  const week = dueReview(today, done, () => true);
  return week && (await hadActivity(week, tz)) ? week : null;
}

/** Everything `lib/coach.evaluateRules` needs, as of `nowMs`. */
export async function getCoachInput(nowMs: number, strengths?: GoalStrength[]): Promise<CoachInput | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const tz = settings.timezone;
  const now = new Date(nowMs).toISOString();
  const today = todayIn(now, tz);
  const weekStart = startOfWeek(today);
  const days = weekDates(weekStart);
  const sched = await schedules();
  const personal = await getBusyPersonal();
  const all = strengths ?? (await getStrengths(nowMs));
  const actions = await getAllRows("actions");
  const goalActions = new Set(actions.filter((a) => a.goal_id).map((a) => a.id));
  const blocks = await getAllRows("blocks");
  const weekBlocks = blocks.filter((b) => days.includes(toLocalDate(b.starts_at, tz)));
  const committed = (b: Block) => b.status === "scheduled" || b.status === "active" || b.status === "done";

  const goals = all.map(({ goal, plan, strength }) => {
    const ids = new Set(actions.filter((a) => a.goal_id === goal.id).map((a) => a.id));
    let free = 0;
    // Free time before the plan's end (availability − personal blocks), at most a season ahead.
    for (let d = today, i = 0; d <= plan.ends_on && i < 100; d = addDays(d, 1), i++) {
      free += freeMinutes({ date: d, timeZone: tz, availability: sched.get(weekdayOf(d))?.availability, personal, events: [], blocks: [], now });
    }
    return {
      id: goal.id,
      title: goal.title,
      scheduledThisWeek: weekBlocks.filter((b) => committed(b) && ids.has(b.action_id)).reduce((n, b) => n + b.planned_pomodoros, 0),
      remaining: strength.remaining,
      freeMinutesBeforeEnd: free,
      endsOn: plan.ends_on,
      strength,
    };
  });

  const planned = { goal: 0, area: 0 };
  const perDay = new Map<string, number>();
  for (const b of weekBlocks) {
    if (b.status === "missed") continue;
    const d = toLocalDate(b.starts_at, tz);
    perDay.set(d, (perDay.get(d) ?? 0) + b.planned_pomodoros);
    if (!committed(b)) continue;
    if (goalActions.has(b.action_id)) planned.goal += b.planned_pomodoros;
    else planned.area += b.planned_pomodoros;
  }
  const capacity = await getCapacity(weekStart, nowMs);
  const weekStartMs = Date.parse(dayBounds(weekStart, tz).start);

  const checkins = (await getAllRows("daily_checkins")).filter((c) => c.completed_at).sort((a, b) => b.date.localeCompare(a.date));
  const yesterday = addDays(today, -1);
  const yCheckin = (await getDb().t("daily_checkins").get(yesterday)) ?? null;
  const yPlanned = plannedBlocks(blocks.filter((b) => toLocalDate(b.starts_at, tz) === yesterday)).length > 0;

  const completedBy = new Map<string, number>();
  for (const b of blocks) completedBy.set(b.action_id, (completedBy.get(b.action_id) ?? 0) + b.completed_pomodoros);
  const doneActions = actions
    .filter((a) => a.status === "done" && a.completed_at && (completedBy.get(a.id) ?? 0) > 0)
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
    .map((a) => ({ estimate: a.estimate_pomodoros, completed: completedBy.get(a.id) ?? 0 }));

  return {
    today,
    weekStart,
    goals,
    planned,
    load: capacity?.load ?? 0,
    overCapDays: [...perDay.entries()].filter(([, n]) => n > settings.daily_pomodoro_cap).map(([d]) => d).sort(),
    followThrough14: followThrough(blocks, nowMs - 14 * DAY, nowMs),
    followThroughWeek: followThrough(weekBlocks, weekStartMs, nowMs),
    peak: peakSplit(weekBlocks, (w) => sched.get(w)?.peak, goalActions, tz),
    checkins: checkins.map((c) => ({ date: c.date, energy: c.energy })),
    actions: actions.filter((a) => a.status === "todo").map((a) => ({ id: a.id, title: a.title, reschedule_count: a.reschedule_count })),
    doneActions,
    missedCheckin: !(yCheckin && !yCheckin.deleted_at && yCheckin.completed_at) && (yPlanned || Boolean(yCheckin && !yCheckin.deleted_at)),
    reviewDue: await getReviewDue(nowMs),
    quarterlyDue: await getQuarterlyDue(nowMs),
  };
}

export interface ReviewGoal {
  goal_id: string;
  title: string;
  strength: number;
  /** Against last week's snapshot; null without one. */
  strength_change: number | null;
  metric_label: string | null;
  metric_current: number | null;
  metric_target: number | null;
}

/** Per goal for the review's numbers (§5.15): plan strength and its change, and metric progress. */
export async function getReviewGoals(nowMs: number): Promise<ReviewGoal[]> {
  const settings = await getSettings();
  if (!settings) return [];
  const lastWeek = addDays(startOfWeek(todayIn(nowMs, settings.timezone)), -7);
  const snapshots = await getAllRows("plan_strength_snapshots");
  return (await getStrengths(nowMs)).map(({ goal, plan, strength }) => {
    const prev = snapshots.find((s) => s.season_plan_id === plan.id && s.week_start === lastWeek);
    return {
      goal_id: goal.id,
      title: goal.title,
      strength: strength.total,
      strength_change: prev ? strength.total - prev.total : null,
      metric_label: plan.metric_label,
      metric_current: plan.metric_current,
      metric_target: plan.metric_target,
    };
  });
}

/** What a completed review stores in `stats` (§5.15): the week's numbers, per-goal numbers, and streaks. */
export type ReviewSnapshot = WeekStats & { goals: ReviewGoal[]; streaks: { checkin: number; focus: number } };

/** The season whose quarterly review is due today (§5.16), or null. */
export async function getQuarterlyDue(nowMs: number): Promise<string | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const today = todayIn(nowMs, settings.timezone);
  const reviewed = new Set((await getAllRows("seasons")).filter((s) => s.reviewed_at).map((s) => s.id));
  const withGoals = new Set((await getAllRows("season_plans")).map((p) => p.season_id));
  return quarterlyDue(today, reviewed, (s) => withGoals.has(s));
}

export interface SeasonStats extends WeekStats {
  achieved: number;
  goals: number;
}

/** The quarterly review's season numbers (§5.16): totals over the quarter, plus goals achieved. */
export async function getSeasonStats(season: string, nowMs: number): Promise<SeasonStats | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const { year, quarter } = parseSeasonId(season);
  const { startsOn, endsOn } = quarterBounds(year, quarter);
  const days: string[] = [];
  for (let d = startsOn; d <= endsOn; d = addDays(d, 1)) days.push(d);
  const tz = settings.timezone;
  const goals = new Map((await getDb().t("goals").toArray()).map((g) => [g.id, g]));
  const areas = new Map((await getDb().t("areas").toArray()).map((a) => [a.id, a]));
  const base = weekStats({
    weekStart: startsOn,
    days,
    timeZone: tz,
    now: new Date(nowMs).toISOString(),
    blocks: await getBlocksForDays(startsOn, endsOn, tz),
    actions: await getDb().t("actions").toArray(),
    owners: (key) => {
      const id = key.slice(key.indexOf(":") + 1);
      if (key.startsWith("goal:")) {
        const g = goals.get(id);
        return g ? { label: g.title, color: goalColor(g, areas) } : undefined;
      }
      const a = areas.get(id);
      return a ? { label: a.name, color: a.color } : undefined;
    },
    checkins: await getAllRows("daily_checkins"),
    focusMinutes: settings.focus_minutes,
  });
  const plans = (await getAllRows("season_plans")).filter((p) => p.season_id === season);
  return { ...base, achieved: plans.filter((p) => p.resolution === "achieved").length, goals: plans.length };
}
