/** Deterministic ids (§4.1). Rows unique per user use these so two devices never create duplicates. */
import type { Weekday } from "@/types";

export const SETTINGS_ID = "settings";
export const COMPASS_ID = "compass";
export const PRAYER_ID = "prayer";
/** One habit's day (Stage 2 exit): `<habit_id>:<date>`. */
export const habitLogId = (habitId: string, date: string) => `${habitId}:${date}`;
export const OTHER_AREA_ID = "area-other";

export const availabilityId = (weekday: Weekday) => `avail-${weekday}`;
export const peakId = (weekday: Weekday) => `peak-${weekday}`;
/** `<goal_id>:<season_id>` */
export const seasonPlanId = (goalId: string, seasonId: string) => `${goalId}:${seasonId}`;
/** A recurring rule's occurrence (§4.1): `<rule_id>:<occurrence_date>`. */
export const occurrenceId = (ruleId: string, date: string) => `${ruleId}:${date}`;
