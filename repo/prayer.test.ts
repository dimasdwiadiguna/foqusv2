import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBusyPersonal, getRow } from "@/data/queries";
import { updatePrayerSettings } from "@/repo";
import { freshDb } from "@/test/db";

beforeEach(() => freshDb("2026-10-07T00:00:00.000Z"));
afterEach(() => vi.useRealTimers());

describe("shalat settings", () => {
  it("are seeded off, need a location to turn on, and then join the busy list", async () => {
    expect(await getRow("prayer_settings", "prayer")).toMatchObject({ enabled: false, before_minutes: 5, after_minutes: 10 });
    await expect(updatePrayerSettings({ enabled: true })).rejects.toThrow(/location/);
    await updatePrayerSettings({ enabled: true, latitude: -6.2088, longitude: 106.8456, location_label: " Jakarta " });
    expect(await getRow("prayer_settings", "prayer")).toMatchObject({ enabled: true, location_label: "Jakarta", _dirty: 1 });
    expect((await getBusyPersonal()).some((p) => "kind" in p && p.kind === "prayer")).toBe(true);
    await updatePrayerSettings({ prayers: { ashar: { enabled: false, adjust_minutes: 0 } } as never });
    const row = await getRow("prayer_settings", "prayer");
    expect(row?.prayers.ashar.enabled).toBe(false);
    expect(row?.prayers.subuh.enabled).toBe(true);
    await expect(updatePrayerSettings({ after_minutes: 500 })).rejects.toThrow(/after adzan/);
    await updatePrayerSettings({ enabled: false });
    expect((await getBusyPersonal()).some((p) => "kind" in p)).toBe(false);
  });
});
