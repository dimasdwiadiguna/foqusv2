"use client";

import { useEffect, useState } from "react";

/**
 * Keep the screen awake while `active` (§5.9), re-acquiring whenever the app becomes visible again
 * (the browser releases the lock when it is hidden). Works in iPhone home-screen apps from iOS 18.4.
 */
export function useWakeLock(active: boolean): "held" | "unsupported" | "idle" {
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        setHeld(true);
        lock.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active, supported]);

  if (!supported) return "unsupported";
  return held ? "held" : "idle";
}
