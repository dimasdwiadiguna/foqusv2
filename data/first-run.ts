"use client";

import { firstRunDecision, parseFirstRun, type FirstRunMark } from "@/lib/first-run";
import { getDb } from "@/db";

/**
 * First-run setup's bookmark, kept on this device (like the goal wizard's): the step to resume at,
 * or "done". The choices made in setup are saved as data through `repo/` at each step.
 */
const KEY = "foqus.first-run";

export function readFirstRun(): FirstRunMark {
  try {
    return parseFirstRun(localStorage.getItem(KEY));
  } catch {
    return "done";
  }
}

export function setFirstRun(mark: FirstRunMark): void {
  try {
    if (mark === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mark === "done" ? "done" : JSON.stringify(mark));
  } catch {
    // Storage blocked: setup simply will not resume.
  }
}

/** Whether the app has any of the owner's own data yet. */
export async function hasUserData(): Promise<boolean> {
  const db = getDb();
  for (const t of ["goals", "actions", "blocks", "daily_checkins"] as const) {
    if ((await db.t(t).filter((r) => !r.deleted_at).count()) > 0) return true;
  }
  return false;
}

/** What to do on open: resume or start setup, or nothing. Marks a non-empty app as done. */
export async function firstRunOnOpen(): Promise<"resume" | "start" | "none"> {
  const decision = firstRunDecision(readFirstRun(), await hasUserData());
  if (decision === "none" && readFirstRun() === null) setFirstRun("done");
  return decision;
}
