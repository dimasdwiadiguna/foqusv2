import { describe, expect, it } from "vitest";
import { followThrough, peakSplit, weekStats } from "./stats";
import { weekDates } from "./time";

const TZ = "Asia/Jakarta";
const iso = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`).toISOString();
const block = (action_id: string, date: string, time: string, planned: number, completed: number, status = "done", resolution: string | null = null) => ({
  action_id,
  status: status as "done",
  resolution: resolution as null,
  starts_at: iso(date, time),
  ends_at: new Date(Date.parse(iso(date, time)) + planned * 30 * 60_000).toISOString(),
  planned_pomodoros: planned,
  completed_pomodoros: completed,
  deleted_at: null,
});

describe("followThrough", () => {
  it("caps completed at planned and ignores drafts and blocks outside the window", () => {
    const blocks = [block("a", "2026-10-05", "06:00", 2, 3), block("a", "2026-10-06", "06:00", 2, 0, "missed", "dropped"), block("a", "2026-10-06", "09:00", 2, 0, "draft")];
    expect(followThrough(blocks, 0, Date.parse(iso("2026-10-07", "00:00")))).toBe(0.5);
    expect(followThrough(blocks, Date.parse(iso("2026-10-06", "00:00")), Date.parse(iso("2026-10-07", "00:00")))).toBe(0);
    expect(followThrough([], 0, Date.now())).toBeNull();
  });
});

describe("weekStats (§5.15 numbers)", () => {
  it("computes completed vs planned, follow-through, goal share, hours, ratings, rescheduled and dropped", () => {
    const s = weekStats({
      weekStart: "2026-10-05",
      days: weekDates("2026-10-05"),
      timeZone: TZ,
      now: iso("2026-10-11", "20:00"),
      blocks: [
        block("g1", "2026-10-05", "06:00", 4, 4),
        block("t1", "2026-10-06", "10:00", 2, 2),
        block("t1", "2026-10-07", "10:00", 2, 0, "missed", "rescheduled"),
        block("g1", "2026-10-08", "06:00", 2, 0, "missed", "dropped"),
        block("g1", "2026-10-12", "06:00", 2, 2), // next week
        block("t1", "2026-10-09", "06:00", 2, 0, "draft"),
      ],
      actions: [
        { id: "g1", goal_id: "G", area_id: null },
        { id: "t1", goal_id: null, area_id: "A" },
      ],
      owners: (k) => (k === "goal:G" ? { label: "Thesis", color: "#fff" } : { label: "Work", color: "#000" }),
      checkins: [
        { date: "2026-10-05", energy: 4, focus: 3, completed_at: "x", deleted_at: null },
        { date: "2026-10-06", energy: 2, focus: 4, completed_at: "x", deleted_at: null },
        { date: "2026-10-07", energy: 1, focus: 1, completed_at: null, deleted_at: null },
      ],
      focusMinutes: 25,
    });
    expect(s).toMatchObject({ completed: 6, planned: 8, rescheduled: 1, dropped: 1, avg_energy: 3, avg_focus: 3.5 });
    // Follow-through counts every ended block, the rescheduled miss too: 6 of 10.
    expect(s.follow_through).toBeCloseTo(0.6);
    expect(s.goal_share).toBeCloseTo(4 / 6);
    expect(s.hours).toEqual([
      { key: "goal:G", label: "Thesis", color: "#fff", kind: "goal", hours: 1.7 },
      { key: "area:A", label: "Work", color: "#000", kind: "area", hours: 0.8 },
    ]);
  });

  it("has nulls for an empty week", () => {
    const s = weekStats({ weekStart: "2026-10-05", days: weekDates("2026-10-05"), timeZone: TZ, now: iso("2026-10-11", "20:00"), blocks: [], actions: [], owners: () => undefined, checkins: [], focusMinutes: 25 });
    expect(s).toMatchObject({ completed: 0, planned: 0, follow_through: null, goal_share: null, avg_energy: null, hours: [] });
  });
});

describe("peakSplit", () => {
  it("counts pomodoros starting inside the peak window", () => {
    const peak = () => ({ start_time: "05:00", end_time: "09:00" });
    const split = peakSplit(
      [block("g", "2026-10-05", "06:00", 2, 0, "scheduled"), block("t", "2026-10-05", "08:00", 3, 0, "scheduled"), block("t", "2026-10-05", "10:00", 4, 0, "scheduled"), block("t", "2026-10-06", "05:00", 1, 0, "draft")],
      peak,
      new Set(["g"]),
      TZ,
    );
    expect(split).toEqual({ goal: 2, area: 3 });
  });
});
