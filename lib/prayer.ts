/**
 * Shalat times (Stage 2 exit). Pure: computes each day's five prayer times from the location with
 * the Kemenag RI convention, and the fixed spans FOQUS keeps free around them.
 *
 * Kemenag RI: Subuh at the sun 20° below the horizon, Isya at 18°, Ashar by the Shafi'i shadow
 * rule, plus 2 minutes of ihtiyat rounded up to the minute; Dzuhur one more minute (after zawal).
 * Checked against Kemenag's published Jakarta schedule (see the tests).
 */
import { CalculationParameters, Coordinates, Madhab, PrayerTimes, Rounding } from "adhan";
import type { DateString, PrayerName, PrayerSettings, RowMeta } from "@/types";
import { parseDate, toLocalTime, weekdayOf } from "./time";

export type PrayerConfig = Omit<PrayerSettings, keyof RowMeta>;

export const PRAYER_NAMES: readonly PrayerName[] = ["subuh", "dzuhur", "ashar", "maghrib", "isya"];
export const PRAYER_LABEL: Record<PrayerName, string> = { subuh: "Subuh", dzuhur: "Dzuhur", ashar: "Ashar", maghrib: "Maghrib", isya: "Isya" };

const MINUTE = 60_000;
const KEY: Record<PrayerName, "fajr" | "dhuhr" | "asr" | "maghrib" | "isha"> = { subuh: "fajr", dzuhur: "dhuhr", ashar: "asr", maghrib: "maghrib", isya: "isha" };
/** Kemenag's extra minute after zawal for Dzuhur. */
const BASE_ADJUST: Record<PrayerName, number> = { subuh: 0, dzuhur: 1, ashar: 0, maghrib: 0, isya: 0 };

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
} satisfies PrayerConfig;

/** Whether the settings can produce times: on, with a location. */
export function prayerReady(c: Pick<PrayerConfig, "enabled" | "latitude" | "longitude"> | null | undefined): c is PrayerConfig & { latitude: number; longitude: number } {
  return Boolean(c && c.enabled && c.latitude !== null && c.longitude !== null);
}

export interface PrayerTime {
  name: PrayerName;
  label: string;
  /** Adzan, epoch ms. */
  adzan: number;
}

/** The five adzan times on a local date. */
export function prayerTimes(date: DateString, config: PrayerConfig): PrayerTime[] {
  if (config.latitude === null || config.longitude === null) return [];
  const { year, month, day } = parseDate(date);
  const params = new CalculationParameters("Other", 20, 18);
  params.madhab = Madhab.Shafi;
  params.rounding = Rounding.None;
  // adhan reads the calendar date from the Date's local fields; a local noon gives the right day.
  const times = new PrayerTimes(new Coordinates(config.latitude, config.longitude), new Date(year, month - 1, day, 12), params);
  return PRAYER_NAMES.map((name) => {
    const raw = times[KEY[name]].getTime();
    const shifted = raw + (config.ihtiyat_minutes + BASE_ADJUST[name] + (config.prayers[name]?.adjust_minutes ?? 0)) * MINUTE;
    return { name, label: PRAYER_LABEL[name], adzan: Math.ceil(shifted / MINUTE) * MINUTE };
  });
}

export interface PrayerSpan {
  name: PrayerName;
  /** "Ashar", or "Jumat" for Friday's Dzuhur. */
  label: string;
  adzan: number;
  start: number;
  end: number;
}

/**
 * The fixed spans on a date: `before_minutes` before adzan to `after_minutes` after it, for each
 * prayer that is on. On Fridays, when Jumat is on, Dzuhur's span is Jumat's longer one.
 */
export function prayerSpans(date: DateString, config: PrayerConfig): PrayerSpan[] {
  if (!prayerReady(config)) return [];
  const friday = weekdayOf(date) === 5;
  return prayerTimes(date, config)
    .filter((t) => config.prayers[t.name]?.enabled !== false)
    .map((t) => {
      const jumat = friday && t.name === "dzuhur" && config.jumat.enabled;
      const before = jumat ? config.jumat.before_minutes : config.before_minutes;
      const after = jumat ? config.jumat.after_minutes : config.after_minutes;
      return { name: t.name, label: jumat ? "Jumat" : t.label, adzan: t.adzan, start: t.adzan - before * MINUTE, end: t.adzan + after * MINUTE };
    });
}

/** "Ashar 14:46" for a span, in the settings time zone. */
export function prayerTitle(span: Pick<PrayerSpan, "label" | "adzan">, timeZone: string): string {
  return `${span.label} ${toLocalTime(span.adzan, timeZone)}`;
}

/** Validate minutes and the location; throws a plain sentence. */
export function checkPrayer(c: PrayerConfig): PrayerConfig {
  const minutes = (n: number, lo: number, hi: number, what: string) => {
    if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${what} is ${lo} to ${hi} minutes.`);
  };
  minutes(c.before_minutes, 0, 60, "Time before adzan");
  minutes(c.after_minutes, 0, 120, "Time after adzan");
  minutes(c.jumat.before_minutes, 0, 60, "Time before Jumat");
  minutes(c.jumat.after_minutes, 0, 180, "Time after Jumat");
  minutes(c.ihtiyat_minutes, 0, 10, "Ihtiyat");
  for (const n of PRAYER_NAMES) minutes(c.prayers[n].adjust_minutes, -30, 30, `The ${PRAYER_LABEL[n]} adjustment`);
  if (c.latitude !== null && (c.latitude < -90 || c.latitude > 90)) throw new Error("The latitude is not valid.");
  if (c.longitude !== null && (c.longitude < -180 || c.longitude > 180)) throw new Error("The longitude is not valid.");
  if (c.enabled && (c.latitude === null || c.longitude === null)) throw new Error("Set your location first.");
  return c;
}
