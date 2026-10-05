/** Wizard progress (§6.7 GPS wizard): which goal is mid-setup and at which step. Pure. */

export const SETUP_STEPS = ["Goal", "Why", "Plan", "Reality check", "System"] as const;
export const SETUP_STEP_COUNT = SETUP_STEPS.length;
/** The finish screen comes after the last step. */
export const SETUP_FINISH = SETUP_STEP_COUNT + 1;

export interface SetupProgress {
  goalId: string;
  seasonId: string;
  /** 1–5, or 6 for the finish screen. */
  step: number;
}

export function clampStep(step: number): number {
  return Number.isInteger(step) ? Math.min(SETUP_FINISH, Math.max(1, step)) : 1;
}

/** Parse what was stored; anything malformed reads as "nothing in progress". */
export function parseSetupProgress(raw: string | null): SetupProgress | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SetupProgress>;
    if (typeof v.goalId !== "string" || typeof v.seasonId !== "string" || typeof v.step !== "number") return null;
    return { goalId: v.goalId, seasonId: v.seasonId, step: clampStep(v.step) };
  } catch {
    return null;
  }
}
