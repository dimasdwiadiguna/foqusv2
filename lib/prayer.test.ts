import { describe, expect, it } from "vitest";
import { DEFAULT_PRAYER, prayerSpans, prayerTimes, prayerTitle, type PrayerConfig } from "./prayer";
import { toLocalTime } from "./time";

const TZ = "Asia/Jakarta";
const jakarta: PrayerConfig = { ...DEFAULT_PRAYER, enabled: true, latitude: -6.2088, longitude: 106.8456, location_label: "Jakarta" };
const hhmm = (ms: number) => toLocalTime(ms, TZ);

describe("prayerTimes (Kemenag RI)", () => {
  it("matches Kemenag's published Jakarta schedule for 7 October 2026", () => {
    // Kemenag RI via liputan6.com/jadwal-sholat/kota-jakarta/2026/10: 04:20, 11:44, 14:46, 17:49, 18:58.
    const t = prayerTimes("2026-10-07", jakarta).map((p) => `${p.label} ${hhmm(p.adzan)}`);
    expect(t).toEqual(["Subuh 04:20", "Dzuhur 11:44", "Ashar 14:46", "Maghrib 17:49", "Isya 18:58"]);
  });

  it("applies each prayer's adjustment and the ihtiyat", () => {
    const adjusted = { ...jakarta, prayers: { ...jakarta.prayers, maghrib: { enabled: true, adjust_minutes: 2 } } };
    expect(hhmm(prayerTimes("2026-10-07", adjusted)[3].adzan)).toBe("17:51");
    expect(hhmm(prayerTimes("2026-10-07", { ...jakarta, ihtiyat_minutes: 0 })[0].adzan)).toBe("04:18");
  });

  it("needs a location", () => {
    expect(prayerTimes("2026-10-07", { ...jakarta, latitude: null })).toEqual([]);
  });
});

describe("prayerSpans", () => {
  it("runs from 5 minutes before adzan to 10 after, for each prayer that is on", () => {
    const s = prayerSpans("2026-10-07", jakarta);
    expect(s.map((x) => `${x.label} ${hhmm(x.start)}–${hhmm(x.end)}`)).toEqual([
      "Subuh 04:15–04:30",
      "Dzuhur 11:39–11:54",
      "Ashar 14:41–14:56",
      "Maghrib 17:44–17:59",
      "Isya 18:53–19:08",
    ]);
    const noAshar = { ...jakarta, prayers: { ...jakarta.prayers, ashar: { enabled: false, adjust_minutes: 0 } } };
    expect(prayerSpans("2026-10-07", noAshar).map((x) => x.label)).toEqual(["Subuh", "Dzuhur", "Maghrib", "Isya"]);
  });

  it("uses Jumat's longer span for Dzuhur on Fridays", () => {
    const fri = prayerSpans("2026-10-09", jakarta).find((x) => x.name === "dzuhur")!;
    expect(fri.label).toBe("Jumat");
    expect((fri.end - fri.start) / 60_000).toBe(55);
    const off = prayerSpans("2026-10-09", { ...jakarta, jumat: { ...jakarta.jumat, enabled: false } }).find((x) => x.name === "dzuhur")!;
    expect(off.label).toBe("Dzuhur");
    expect(prayerTitle(fri, TZ)).toMatch(/^Jumat \d\d:\d\d$/);
  });

  it("is empty when off", () => {
    expect(prayerSpans("2026-10-07", { ...jakarta, enabled: false })).toEqual([]);
  });
});
