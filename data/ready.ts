"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/db";
import { ensureSeed } from "@/db/seed";
import { startOfWeek, todayIn } from "@/lib/time";
import { rolloverWeek } from "@/repo/actions";
import { getSettings } from "./queries";

let opening: Promise<void> | null = null;

/** Open the database, seed it, and roll the week list over, once per page load. */
function openOnce(): Promise<void> {
  opening ??= (async () => {
    const now = new Date().toISOString();
    await ensureSeed(getDb(), now);
    const settings = await getSettings();
    if (settings) await rolloverWeek(startOfWeek(todayIn(now, settings.timezone)));
    // Ask the browser not to evict this data under storage pressure (Step 1.5).
    void navigator.storage?.persist?.().catch(() => false);
  })();
  return opening;
}

export type DbState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/** Whether the local database is open and seeded. Screens render once this is ready. */
export function useDbReady(): DbState {
  const [state, setState] = useState<DbState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    openOnce().then(
      () => live && setState({ status: "ready" }),
      (err: unknown) => {
        opening = null;
        if (live) setState({ status: "error", message: describeOpenError(err) });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

function describeOpenError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "MissingAPIError" || name === "InvalidStateError") {
    return "This browser is not letting FOQUS store data. Private browsing can cause this.";
  }
  return "FOQUS could not open its local data.";
}
