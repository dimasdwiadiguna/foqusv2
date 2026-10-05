"use client";

import { useSyncExternalStore } from "react";
import { parseSetupProgress, type SetupProgress } from "@/lib/goal-setup";

/**
 * Where the owner left the GPS wizard, kept on this device. It is a UI bookmark, not data: the goal
 * itself is saved through `repo/` from step 1, so losing this only loses the "continue" shortcut.
 */
const KEY = "foqus.goal-setup";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSetupProgress(progress: SetupProgress | null) {
  try {
    if (progress) localStorage.setItem(KEY, JSON.stringify(progress));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: resuming falls back to the goal list.
  }
  listeners.forEach((l) => l());
}

export function useSetupProgress(): SetupProgress | null {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
  return parseSetupProgress(raw);
}
