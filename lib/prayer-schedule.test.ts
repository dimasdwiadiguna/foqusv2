import { describe, expect, it } from "vitest";
import { freeMinutes, personalSpans, type PrayerSource } from "./availability";
import { draftWeek } from "./draft";
import { checkPlacement, type PlacementInput } from "./placement";
import { DEFAULT_PRAYER, prayerSpans } from "./prayer";
import { pickSlot } from "./scheduler";
import { weekDates } from "./time";

const TZ = "Asia/Jakarta";
const at = (time: string, date = "2026-10-07") => Date.parse(`${date}T${time}:00+07:00`);
const config = { ...DEFAULT_PRAYER, enabled: true, latitude: -6.2088, longitude: 106.8456, location_label: "Jakarta" };
const shalat: PrayerSource = { kind: "prayer", config };
const windows = () => ({ availability: { start_time: "05:00", end_time: "21:00" }, peak: { start_time: "05:00", end_time: "09:00" } });

describe("shalat spans as fixed time (Stage 2 exit)", () => {
  it("appear with personal blocks on each day, labelled with the adzan time", () => {
    expect(personalSpans("2026-10-07", [shalat], TZ).map((s) => s.label)).toEqual(["Subuh 04:20", "Dzuhur 11:44", "Ashar 14:46", "Maghrib 17:49", "Isya 18:58"]);
    expect(personalSpans("2026-10-07", [shalat], TZ).every((s) => s.kind === "prayer")).toBe(true);
  });

  it("are taken out of free time", () => {
    const input = { date: "2026-10-07", timeZone: TZ, availability: { start_time: "05:00", end_time: "21:00" }, events: [], blocks: [], now: new Date(at("00:00")).toISOString() };
    // Dzuhur, Ashar, Maghrib, and Isya fall inside 05:00–21:00: 15 minutes each, with each end
    // rounded up to the 5-minute grid (11:39–11:55, 14:41–15:00, 17:44–18:00, 18:53–19:10).
    expect(freeMinutes({ ...input, personal: [] }) - freeMinutes({ ...input, personal: [shalat] })).toBe(16 + 19 + 16 + 17);
  });

  it("make a manual placement ask \"Place anyway?\" instead of refusing it", () => {
    const base: PlacementInput = {
      start: at("14:30"),
      pomodoros: 1,
      bufferMinutes: 0,
      action: { goal_id: null, due_on: null },
      timeZone: TZ,
      today: "2026-10-07",
      availability: { start_time: "05:00", end_time: "21:00" },
      peak: { start_time: "05:00", end_time: "09:00" },
      personal: [shalat],
      events: [],
      blocks: [],
      dailyCap: 10,
    };
    const r = checkPlacement(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.map((w) => w.message)).toContain("This overlaps Ashar 14:46 (shalat).");
  });

  it("are never used by the slot picker or the draft", () => {
    const now = new Date(at("11:00")).toISOString();
    const slot = pickSlot({ action: { id: "a", goal_id: null, due_on: null }, pomodoros: 2, bufferMinutes: 0, timeZone: TZ, now, today: "2026-10-07", windows, personal: [shalat], events: [], blocks: [], dailyCap: 10 });
    // 11:00–12:00 would cross Dzuhur (11:39–11:54): the first fit is after it.
    expect(slot?.start).toBe(at("11:55"));

    const items = Array.from({ length: 12 }, (_, i) => ({ action: { id: `t${i}`, goal_id: null, due_on: null, sort_order: i, occurrence_date: null }, unscheduled: 3, goalRank: null, planEndsOn: null, preferredStart: null }));
    const { blocks } = draftWeek({ items, days: weekDates("2026-10-05"), today: "2026-10-07", now, timeZone: TZ, windows, personal: [shalat], events: [], blocks: [], dailyCap: 10, maxPerBlock: 4, bufferMinutes: 10 });
    expect(blocks.length).toBeGreaterThan(5);
    for (const b of blocks) {
      for (const s of prayerSpans(b.date, config)) expect(b.start < s.end && s.start < b.end + b.bufferMinutes * 60_000).toBe(false);
    }
  });
});
