import { describe, expect, it } from "vitest";
import { checkinDays, focusDays, milestoneReached, streakFrom } from "./streaks";

const block = (starts_at: string, over: Partial<{ action_id: string; completed_pomodoros: number; status: "done" | "draft" | "scheduled" | "missed"; deleted_at: string | null }> = {}) => ({
  action_id: "goal-action",
  starts_at,
  status: "done" as const,
  completed_pomodoros: 1,
  deleted_at: null,
  ...over,
});
const GOAL = new Set(["goal-action"]);
const TZ = "Asia/Jakarta"; // UTC+7

describe("streakFrom", () => {
  it("counts consecutive days ending today", () => {
    expect(streakFrom(["2026-10-03", "2026-10-04", "2026-10-05"], "2026-10-05")).toEqual({ current: 3, today: true });
  });

  it("keeps yesterday's run alive while today is open", () => {
    expect(streakFrom(["2026-10-03", "2026-10-04"], "2026-10-05")).toEqual({ current: 2, today: false });
  });

  it("breaks on a gap day", () => {
    // 4 Oct is missing: only 5 Oct counts.
    expect(streakFrom(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05"], "2026-10-05")).toEqual({ current: 1, today: true });
    // A whole day without counting (yesterday): the streak is gone.
    expect(streakFrom(["2026-10-02", "2026-10-03"], "2026-10-05")).toEqual({ current: 0, today: false });
  });

  it("crosses month and year ends, and ignores duplicates", () => {
    expect(streakFrom(["2026-12-31", "2027-01-01", "2027-01-01"], "2027-01-01").current).toBe(2);
    expect(streakFrom(["2026-09-30", "2026-10-01"], "2026-10-01").current).toBe(2);
  });

  it("is zero with nothing", () => {
    expect(streakFrom([], "2026-10-05")).toEqual({ current: 0, today: false });
  });
});

describe("checkinDays", () => {
  it("counts only completed, live check-ins", () => {
    expect(
      checkinDays([
        { date: "2026-10-03", completed_at: "2026-10-03T12:00:00Z", deleted_at: null },
        { date: "2026-10-04", completed_at: null, deleted_at: null },
        { date: "2026-10-05", completed_at: "2026-10-05T12:00:00Z", deleted_at: "2026-10-05T13:00:00Z" },
      ]),
    ).toEqual(["2026-10-03"]);
  });
});

describe("focusDays", () => {
  it("counts goal-action blocks with at least one pomodoro", () => {
    const days = focusDays(
      [
        block("2026-10-05T01:00:00Z"),
        block("2026-10-04T01:00:00Z", { action_id: "area-task" }),
        block("2026-10-03T01:00:00Z", { completed_pomodoros: 0, status: "missed" }),
        block("2026-10-02T01:00:00Z", { status: "draft" }),
        block("2026-10-01T01:00:00Z", { deleted_at: "2026-10-01T02:00:00Z" }),
      ],
      GOAL,
      TZ,
    );
    expect(days).toEqual(["2026-10-05"]);
  });

  it("puts a block on the local day at the midnight boundary, not the UTC day", () => {
    // 23:30 on Mon 5 Oct in Jakarta is 16:30Z; 00:10 on Tue 6 Oct is 17:10Z on the 5th in UTC.
    expect(focusDays([block("2026-10-05T16:30:00Z")], GOAL, TZ)).toEqual(["2026-10-05"]);
    expect(focusDays([block("2026-10-05T17:10:00Z")], GOAL, TZ)).toEqual(["2026-10-06"]);
    // So a 23:30 session on the 5th and a 00:10 session on the 7th leave a gap on the 6th...
    const gap = focusDays([block("2026-10-05T16:30:00Z"), block("2026-10-06T17:10:00Z")], GOAL, TZ);
    expect(streakFrom(gap, "2026-10-07").current).toBe(1);
    // ...while 23:30 on the 5th and 00:10 on the 6th are two days in a row.
    const run = focusDays([block("2026-10-05T16:30:00Z"), block("2026-10-05T17:10:00Z")], GOAL, TZ);
    expect(streakFrom(run, "2026-10-06").current).toBe(2);
    // The same instants read in UTC fall on one day.
    expect(focusDays([block("2026-10-05T16:30:00Z"), block("2026-10-05T17:10:00Z")], GOAL, "UTC")).toEqual(["2026-10-05"]);
  });
});

describe("milestoneReached", () => {
  it("fires once when a milestone is crossed", () => {
    expect(milestoneReached(6, 7)).toBe(7);
    expect(milestoneReached(7, 8)).toBeNull();
    expect(milestoneReached(29, 30)).toBe(30);
    expect(milestoneReached(99, 100)).toBe(100);
    expect(milestoneReached(0, 1)).toBeNull();
  });
});
