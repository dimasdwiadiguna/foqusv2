"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { getAllRows, getRow, getSettings } from "./queries";
import { todayIn } from "@/lib/time";
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
