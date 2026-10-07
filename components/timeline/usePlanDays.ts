"use client";

import { useSyncExternalStore } from "react";

/** Plan on the phone shows 1 or 3 days (owner feedback at the Stage 2 exit); remembered on this device. */
const KEY = "foqus.plan-days";
const listeners = new Set<() => void>();

function read(): 1 | 3 {
  try {
    return localStorage.getItem(KEY) === "1" ? 1 : 3;
  } catch {
    return 3;
  }
}

export function usePlanDays(): [1 | 3, (n: 1 | 3) => void] {
  const n = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    read,
    () => 3 as const,
  );
  const set = (v: 1 | 3) => {
    try {
      localStorage.setItem(KEY, String(v));
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
    listeners.forEach((l) => l());
  };
  return [n, set];
}
