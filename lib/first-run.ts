/**
 * First-run setup (§6.7 flows, Step 2.4). Shown when the app has no data; every step but
 * availability can be skipped; it can be resumed. The Google step joins in Step 4.1. Pure.
 */
export const SETUP_FLOW_STEPS = ["Availability", "Peak", "Personal blocks", "Areas", "Compass", "First goal"] as const;
export const REQUIRED_STEPS = new Set([0]);

/** What is stored on the device: a step to resume at, or "done". */
export type FirstRunMark = { step: number } | "done" | null;

export function parseFirstRun(raw: string | null): FirstRunMark {
  if (raw === "done") return "done";
  try {
    const v = JSON.parse(raw ?? "null") as unknown;
    if (v && typeof v === "object" && "step" in v && Number.isInteger((v as { step: unknown }).step)) {
      const step = (v as { step: number }).step;
      if (step >= 0 && step < SETUP_FLOW_STEPS.length) return { step };
    }
  } catch {
    // Unreadable: treated as never started.
  }
  return null;
}

/**
 * Whether to open setup: always to resume an unfinished one; otherwise only for an app with no data
 * (no goals, actions, blocks, or check-ins). An app that already has data never sees it.
 */
export function firstRunDecision(mark: FirstRunMark, hasData: boolean): "resume" | "start" | "none" {
  if (mark === "done") return "none";
  if (mark) return "resume";
  return hasData ? "none" : "start";
}
