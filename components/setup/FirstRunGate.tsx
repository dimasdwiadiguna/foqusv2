"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { firstRunOnOpen } from "@/data";

let decided: "resume" | "start" | "none" | null = null;

/**
 * Sends an empty app (or an unfinished setup) to first-run setup (Step 2.4). Checked once per page
 * load; screens wait for the answer so they never flash before the redirect.
 */
export function FirstRunGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(decided === "none");
  useEffect(() => {
    if (decided === "none") return;
    let live = true;
    void firstRunOnOpen().then((d) => {
      decided = d;
      if (!live) return;
      if (d === "none") setReady(true);
      else router.replace("/setup");
    });
    return () => {
      live = false;
    };
  }, [router]);
  return ready ? children : null;
}

/** Setup finished or skipped in this page load: stop gating. */
export function markFirstRunDecided(): void {
  decided = "none";
}
