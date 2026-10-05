"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { getAllRows, getRow, getSettings } from "./queries";
import { startOfWeek, todayIn } from "@/lib/time";
import * as q from "./queries";
import type { TableName, Tables } from "@/types";

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
