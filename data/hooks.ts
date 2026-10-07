"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { getAllRows, getRow, getSettings } from "./queries";
import { startOfWeek, todayIn } from "@/lib/time";
import * as q from "./queries";
import { getQuarterlyDue, getReviewDue, getReviewGoals, getReviewHabits, getSeasonStats, getStrengths, getWeekStats } from "./coach";
import { sortInsights, type RuleCode } from "@/lib/coach";
import { COMPASS_ID } from "@/lib/ids";
import type { TableName, Tables, Weekday } from "@/types";

/** A live row, or undefined while loading or if it does not exist. */
export function useRow<N extends TableName>(table: N, id: string): Tables[N] | undefined {
  return useLiveQuery(() => getRow(table, id), [table, id]);
}

/** All live rows of a table, or undefined while loading. */
export function useRows<N extends TableName>(table: N): Tables[N][] | undefined {
  return useLiveQuery(() => getAllRows(table), [table]);
}

export function useSettings() {
  return useLiveQuery(getSettings, []);
}

/** The current instant, refreshed every `intervalMs`. UI only; `lib/` takes "now" as an argument. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** Today's date in the settings time zone (never the device's), or undefined while loading. */
export function useToday(): string | undefined {
  const settings = useSettings();
  const now = useNow();
  return settings ? todayIn(now, settings.timezone) : undefined;
}

// ---------------------------------------------------------------------------
// Step 1.2


export const useAreas = (includeArchived = false) => useLiveQuery(() => q.getAreas(includeArchived), [includeArchived]);
export const useSeasons = () => useLiveQuery(q.getSeasons, []);
export const useGoalsInSeason = (seasonId: string) => useLiveQuery(() => q.getGoalsInSeason(seasonId), [seasonId]);
export const usePlansForGoal = (goalId: string) => useLiveQuery(() => q.getPlansForGoal(goalId), [goalId]);
export const useMajorMoves = (planId: string | undefined) =>
  useLiveQuery(() => (planId ? q.getMajorMoves(planId) : []), [planId]);
export const useActionsForGoal = (goalId: string) => useLiveQuery(() => q.getActionsForGoal(goalId), [goalId]);
export const useActionsForArea = (areaId: string) => useLiveQuery(() => q.getActionsForArea(areaId), [areaId]);
export const useCompletedByAction = () => useLiveQuery(q.getCompletedByAction, []);
export const useOpenCountsByArea = () => useLiveQuery(q.getOpenCountsByArea, []);
export const useActiveGoals = () => useLiveQuery(q.getActiveGoals, []);
export const useMovesForGoal = (goalId: string | null) =>
  useLiveQuery(() => (goalId ? q.getMovesForGoal(goalId) : []), [goalId]);
export const useBlocksForActions = (actionIds: readonly string[]) =>
  useLiveQuery(() => q.getBlocksForActions(actionIds), [actionIds.join(",")]);

/** The Monday of the current week in the settings time zone, or undefined while loading. */
export function useWeekStart(): string | undefined {
  const today = useToday();
  return today ? startOfWeek(today) : undefined;
}

// ---------------------------------------------------------------------------
// Step 1.3

export const useDaySchedule = (weekday: Weekday) => useLiveQuery(() => q.getDaySchedule(weekday), [weekday]);
export const usePersonalBlocks = () => useLiveQuery(q.getPersonalBlocks, []);
export const useBlocksForDays = (from: string | undefined, to: string | undefined, timeZone: string | undefined) =>
  useLiveQuery(() => (from && to && timeZone ? q.getBlocksForDays(from, to, timeZone) : []), [from, to, timeZone]);
/** This week's list: todo actions whose `planned_week` is `weekStart`. */
export const useWeekList = (weekStart: string | undefined) =>
  useLiveQuery(
    async () => (weekStart ? (await q.getAllRows("actions")).filter((a) => a.planned_week === weekStart && a.status === "todo") : []),
    [weekStart],
  );
export const useWindows = (kind: "availability" | "peak") =>
  useLiveQuery(async () => (await q.getAllRows(kind === "availability" ? "availability_windows" : "peak_windows")).sort((a, b) => a.weekday - b.weekday), [kind]);

// ---------------------------------------------------------------------------
// Step 1.4

/** The running session, null when none, undefined while loading. */
export const useActiveSession = () => useLiveQuery(q.getActiveSessionRow, []);
/** Unresolved blocks (scheduled, ended before now), oldest first. */
export function useUnresolvedBlocks() {
  const now = useNow(30_000);
  // Re-query each half minute: a block becomes unresolved when its end passes.
  const minute = Math.floor(now / 30_000);
  return useLiveQuery(() => q.getUnresolvedBlocks(Date.now()), [minute]);
}

// ---------------------------------------------------------------------------
// Step 2.1

/** The check-in for `date`: the row, null when there is none yet, undefined while loading. */
export const useCheckin = (date: string | undefined) =>
  useLiveQuery(async () => (date ? ((await q.getRow("daily_checkins", date)) ?? null) : undefined), [date]);
export const useCheckins = () => useLiveQuery(q.getCheckins, []);
/** Check-in and focus streaks as of today, undefined while loading. */
export function useStreaks() {
  const settings = useSettings();
  const today = useToday();
  const tz = settings?.timezone;
  return useLiveQuery(async () => (today && tz ? q.getStreaks(today, tz) : undefined), [today, tz]);
}

// ---------------------------------------------------------------------------
// Step 2.2

/** The capacity meter for a week's remaining days; null for a past week, undefined while loading. */
export function useCapacity(weekStart: string | undefined) {
  const now = useNow(60_000);
  const minute = Math.floor(now / 60_000);
  return useLiveQuery(async () => (weekStart ? q.getCapacity(weekStart, Date.now()) : null), [weekStart, minute]);
}
export const useRules = () => useLiveQuery(q.getRules, []);

// ---------------------------------------------------------------------------
// Step 2.3

/** Plan strength for each active goal (rank order), refreshed every minute and on data changes. */
export function useStrengths() {
  const now = useNow(60_000);
  const minute = Math.floor(now / 60_000);
  return useLiveQuery(() => getStrengths(Date.now()), [minute]);
}
/** Weekly snapshots of a plan's strength, oldest first. */
export const useStrengthHistory = (planId: string | undefined) =>
  useLiveQuery(async () => (planId ? (await q.getAllRows("plan_strength_snapshots")).filter((s) => s.season_plan_id === planId).sort((a, b) => a.week_start.localeCompare(b.week_start)) : []), [planId]);
/** New coach insights, highest priority first. */
export const useInsights = () =>
  useLiveQuery(async () => sortInsights((await q.getAllRows("coach_messages")).filter((m) => m.status === "new").map((m) => ({ ...m, code: m.rule_code as RuleCode }))), []);
export function useReviewDue() {
  const now = useNow(60_000);
  const minute = Math.floor(now / 60_000);
  return useLiveQuery(() => getReviewDue(Date.now()), [minute]);
}
export const useReview = (week: string | undefined) => useLiveQuery(async () => (week ? ((await q.getRow("weekly_reviews", week)) ?? null) : undefined), [week]);
export const useReviews = () => useLiveQuery(async () => (await q.getAllRows("weekly_reviews")).filter((r) => r.completed_at).sort((a, b) => b.week_start.localeCompare(a.week_start)), []);
export const useCompass = () => useLiveQuery(async () => (await q.getRow("compass", COMPASS_ID)) ?? null, []);
export function useWeekStats(week: string | undefined) {
  const now = useNow(60_000);
  const minute = Math.floor(now / 60_000);
  return useLiveQuery(async () => (week ? getWeekStats(week, Date.now()) : undefined), [week, minute]);
}
export function useReviewGoals() {
  const now = useNow(60_000);
  const minute = Math.floor(now / 60_000);
  return useLiveQuery(() => getReviewGoals(Date.now()), [minute]);
}
export function useQuarterlyDue() {
  const now = useNow(60_000);
  const minute = Math.floor(now / 60_000);
  return useLiveQuery(() => getQuarterlyDue(Date.now()), [minute]);
}
export const useSeasonStats = (season: string | undefined) => useLiveQuery(async () => (season ? getSeasonStats(season, Date.now()) : undefined), [season]);
export const useSeason = (id: string | undefined) => useLiveQuery(async () => (id ? ((await q.getRow("seasons", id)) ?? null) : undefined), [id]);

// ---------------------------------------------------------------------------
// Stage 2 exit: shalat

export const usePrayerSettings = () => useLiveQuery(q.getPrayerSettings, []);
/** Personal blocks plus shalat (when on): what timelines and suggestions schedule around. */
export const useBusyPersonal = () => useLiveQuery(q.getBusyPersonal, []);

// ---------------------------------------------------------------------------
// Stage 2 exit: elastic habits

export const useHabits = (includeArchived = false) => useLiveQuery(() => q.getHabits(includeArchived), [includeArchived]);
export const useHabitLogs = (from: string | undefined, to: string | undefined) =>
  useLiveQuery(async () => (from && to ? q.getHabitLogs(from, to) : []), [from, to]);
export const useReviewHabits = (week: string | undefined) => useLiveQuery(async () => (week ? getReviewHabits(week, Date.now()) : undefined), [week]);
