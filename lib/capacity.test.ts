import { describe, expect, it } from "vitest";
import { capacity, capacityBand } from "./capacity";

const TZ = "Asia/Jakarta";
const iso = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`).toISOString();
const block = (date: string, time: string, end: string, over: Partial<{ action_id: string; status: "scheduled" | "draft" | "done" | "missed"; buffer_minutes: number; planned_pomodoros: number }> = {}) => ({
  action_id: "g",
  starts_at: iso(date, time),
  ends_at: iso(date, end),
  buffer_minutes: 0,
  status: "scheduled" as const,
  planned_pomodoros: 2,
  deleted_at: null,
  ...over,
});
const base = {
  days: ["2026-10-10", "2026-10-11"],
  timeZone: TZ,
  now: iso("2026-10-10", "08:00"),
  windows: () => ({ availability: { start_time: "08:00", end_time: "18:00" } }),
  personal: [{ label: "Lunch", weekdays: [6, 7] as (6 | 7)[], start_time: "12:00", end_time: "14:00", active: true, deleted_at: null }],
  events: [],
  blocks: [],
  goalActionIds: new Set(["g"]),
};

describe("capacityBand", () => {
  it("bands at 70% and 90%", () => {
    expect(capacityBand(0.69)).toBe("room");
    expect(capacityBand(0.7)).toBe("full");
    expect(capacityBand(0.9)).toBe("full");
    expect(capacityBand(0.91)).toBe("over");
  });
});

describe("capacity (§5.12)", () => {
  it("counts free time before FOQUS blocks over the remaining days", () => {
    // 10 h − 2 h lunch on each of two days.
    expect(capacity(base)).toMatchObject({ freeHours: 16, plannedHours: 0, load: 0, band: "room" });
    // Mid-day: Saturday from 15:00 on is 3 h.
    expect(capacity({ ...base, now: iso("2026-10-10", "15:00") }).freeHours).toBe(11);
  });

  it("adds block length and buffer of scheduled and draft blocks, and splits goal and area pomodoros", () => {
    const c = capacity({
      ...base,
      blocks: [
        block("2026-10-10", "08:00", "09:00", { buffer_minutes: 10 }),
        block("2026-10-11", "09:00", "11:00", { status: "draft", action_id: "t", planned_pomodoros: 4, buffer_minutes: 20 }),
        block("2026-10-11", "15:00", "16:00", { status: "missed" }),
        block("2026-10-09", "09:00", "10:00"),
      ],
    });
    expect(c).toMatchObject({ plannedHours: 3.5, goalPomodoros: 2, areaPomodoros: 4 });
    expect(c.load).toBeCloseTo(210 / 960);
  });

  it("is overbooked when there is no free time but work is planned", () => {
    const c = capacity({ ...base, windows: () => ({ availability: undefined }), blocks: [block("2026-10-10", "09:00", "10:00")] });
    expect(c).toMatchObject({ freeHours: 0, band: "over" });
  });
});
