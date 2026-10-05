/**
 * Limits and validation for the Settings → Focus section (§4.2, §6.7). Pure.
 */
import type { RowPatch, Settings } from "@/types";
import { isValidTimeZone } from "./time";

export const FOCUS_LIMITS = {
  max_pomodoros_per_block: { min: 1, max: 8, step: 1 },
  daily_pomodoro_cap: { min: 1, max: 32, step: 1 },
  default_buffer_minutes: { min: 0, max: 60, step: 5 },
} as const;

export type NumericFocusSetting = keyof typeof FOCUS_LIMITS;

/** Snap a value onto a setting's step and clamp it to its range. */
export function clampSetting(key: NumericFocusSetting, value: number): number {
  const { min, max, step } = FOCUS_LIMITS[key];
  if (!Number.isFinite(value)) return min;
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export type SettingsPatch = RowPatch<Settings>;

/**
 * Return a cleaned patch, or throw with a plain-sentence message if a value cannot be accepted.
 * Numbers are clamped rather than rejected; an unknown time zone is rejected.
 */
export function validateSettingsPatch(patch: SettingsPatch): SettingsPatch {
  const out: SettingsPatch = { ...patch };
  for (const key of Object.keys(FOCUS_LIMITS) as NumericFocusSetting[]) {
    const v = out[key];
    if (v !== undefined) out[key] = clampSetting(key, v);
  }
  if (out.timezone !== undefined && !isValidTimeZone(out.timezone)) {
    throw new Error(`"${out.timezone}" is not a time zone this device recognises.`);
  }
  if (out.focus_minutes !== undefined && out.focus_minutes !== 25) {
    throw new Error("A pomodoro is fixed at 25 minutes of focus.");
  }
  if (out.break_minutes !== undefined && out.break_minutes !== 5) {
    throw new Error("A pomodoro break is fixed at 5 minutes.");
  }
  return out;
}
