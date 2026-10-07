/**
 * First-run seeding (Step 1.1): the settings row, seven availability windows, seven peak windows,
 * and the "Other" area, all with deterministic ids (§4.1) so two devices never create duplicates.
 * Idempotent: a row that already exists, even soft-deleted, is left alone.
 */
import type { Area, AvailabilityWindow, Instant, PeakWindow, PrayerSettings, RowMeta, Settings, Weekday } from "@/types";
import type { FoqusDb } from "./index";
import { newMeta } from "./meta";

import { availabilityId, OTHER_AREA_ID, peakId, PRAYER_ID, SETTINGS_ID } from "@/lib/ids";

export { OTHER_AREA_ID, SETTINGS_ID, availabilityId, peakId };
export const OTHER_AREA_COLOR = "#9AA3B2";
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];


export const DEFAULT_SETTINGS = {
  timezone: "Asia/Jakarta",
  focus_minutes: 25,
  break_minutes: 5,
  max_pomodoros_per_block: 4,
  daily_pomodoro_cap: 10,
  default_buffer_minutes: 10,
  auto_start_next_phase: true,
  onboarding_completed_at: null,
} satisfies Omit<Settings, keyof RowMeta>;

export function seedSettings(now: Instant): Settings {
  return { ...newMeta(SETTINGS_ID, now), ...DEFAULT_SETTINGS };
}

export function seedAvailability(now: Instant): AvailabilityWindow[] {
  return WEEKDAYS.map((weekday) => ({
    ...newMeta(availabilityId(weekday), now),
    weekday,
    start_time: "05:00",
    end_time: "21:00",
  }));
}

export function seedPeak(now: Instant): PeakWindow[] {
  return WEEKDAYS.map((weekday) => ({
    ...newMeta(peakId(weekday), now),
    weekday,
    start_time: "05:00",
    end_time: "09:00",
  }));
}

export function seedOtherArea(now: Instant): Area {
  return {
    ...newMeta(OTHER_AREA_ID, now),
    name: "Other",
    color: OTHER_AREA_COLOR,
    sort_order: 0,
    is_default: true,
    archived_at: null,
  };
}

/** Shalat settings (Stage 2 exit): off until a location is set; 5 minutes before and 10 after adzan. */
export const DEFAULT_PRAYER = {
  enabled: false,
  latitude: null,
  longitude: null,
  location_label: null,
  before_minutes: 5,
  after_minutes: 10,
  ihtiyat_minutes: 2,
  prayers: {
    subuh: { enabled: true, adjust_minutes: 0 },
    dzuhur: { enabled: true, adjust_minutes: 0 },
    ashar: { enabled: true, adjust_minutes: 0 },
    maghrib: { enabled: true, adjust_minutes: 0 },
    isya: { enabled: true, adjust_minutes: 0 },
  },
  jumat: { enabled: true, before_minutes: 10, after_minutes: 45 },
} satisfies Omit<PrayerSettings, keyof RowMeta>;

export function seedPrayer(now: Instant): PrayerSettings {
  return { ...newMeta(PRAYER_ID, now), ...DEFAULT_PRAYER };
}

/** Add any missing seed rows. Returns the number of rows added. */
export async function ensureSeed(db: FoqusDb, now: Instant): Promise<number> {
  const settings = db.t("settings");
  const availability = db.t("availability_windows");
  const peak = db.t("peak_windows");
  const areas = db.t("areas");
  const prayer = db.t("prayer_settings");

  return db.transaction("rw", [settings, availability, peak, areas, prayer], async () => {
    let added = 0;
    const addMissing = async <T extends { id: string }>(table: { get(id: string): Promise<T | undefined>; add(row: T): Promise<unknown> }, rows: T[]) => {
      for (const row of rows) {
        if ((await table.get(row.id)) === undefined) {
          await table.add(row);
          added++;
        }
      }
    };
    await addMissing(settings, [seedSettings(now)]);
    await addMissing(availability, seedAvailability(now));
    await addMissing(peak, seedPeak(now));
    await addMissing(areas, [seedOtherArea(now)]);
    await addMissing(prayer, [seedPrayer(now)]);
    return added;
  });
}
