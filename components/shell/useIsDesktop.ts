"use client";

import { useSyncExternalStore } from "react";

/** The desktop layout (§6.11) applies at 1024 px and wider. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(cb: () => void) {
  const m = window.matchMedia(DESKTOP_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** Whether the window is desktop-wide. False on the server and on phones. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}
