import { describe, expect, it } from "vitest";
import {
  achievementNumbers,
  defaultPlanDates,
  goalProgress,
  goalStats,
  maxConcurrentGoals,
  nextRank,
  planDatesError,
  wouldExceedConcurrentGoals,
} from "./goals";

const span = (goal_id: string, starts_on: string, ends_on: string) => ({ goal_id, starts_on, ends_on });
const Q4 = { starts_on: "2026-10-01", ends_on: "2026-12-31" };

describe("concurrent goals (§5.3)", () => {
  const four = [
    span("a", "2026-10-01", "2026-12-31"),
    span("b", "2026-10-01", "2026-11-30"),
    span("c", "2026-11-01", "2026-12-31"),
    span("d", "2026-10-15", "2026-11-15"),
  ];

  it("counts the peak overlap", () => {
    expect(maxConcurrentGoals(four)).toBe(4);
    expect(maxConcurrentGoals([])).toBe(0);
  });

  it("treats end dates as inclusive", () => {
    expect(maxConcurrentGoals([span("a", "2026-10-01", "2026-10-10"), span("b", "2026-10-10", "2026-10-20")])).toBe(2);
    expect(maxConcurrentGoals([span("a", "2026-10-01", "2026-10-09"), span("b", "2026-10-10", "2026-10-20")])).toBe(1);
  });

  it("counts a goal once even with two plans", () => {
    expect(maxConcurrentGoals([span("a", "2026-10-01", "2026-12-31"), span("a", "2026-12-01", "2027-01-31")])).toBe(1);
  });

  it("warns for a fifth overlapping goal", () => {
    expect(wouldExceedConcurrentGoals(four, span("e", "2026-11-01", "2026-11-10"))).toBe(true);
  });

  it("does not warn when the fifth goal overlaps only three", () => {
    // On 1–14 Oct only a and b run.
    expect(wouldExceedConcurrentGoals(four, span("e", "2026-10-01", "2026-10-14"))).toBe(false);
  });

  it("replaces the candidate's own plan when editing", () => {
    expect(wouldExceedConcurrentGoals(four, span("d", "2026-10-01", "2026-12-31"))).toBe(false);
  });
});

describe("plan dates", () => {
  it("must be inside the season and in order", () => {
    expect(planDatesError("2026-10-05", "2026-12-31", Q4)).toBeNull();
    expect(planDatesError("2026-12-31", "2026-10-05", Q4)).toMatch(/before/);
    expect(planDatesError("2026-09-30", "2026-12-31", Q4)).toMatch(/inside/);
    expect(planDatesError("2026-10-05", "2027-01-01", Q4)).toMatch(/inside/);
    expect(planDatesError("", "2027-01-01", Q4)).toMatch(/Pick/);
  });

  it("default to today and the season's end", () => {
    expect(defaultPlanDates("2026-10-05", Q4)).toEqual({ startsOn: "2026-10-05", endsOn: "2026-12-31" });
    expect(defaultPlanDates("2026-09-20", Q4)).toEqual({ startsOn: "2026-10-01", endsOn: "2026-12-31" });
  });
});

describe("goalProgress", () => {
  const actions = [
    { id: "x", status: "todo" as const, estimate_pomodoros: 4 },
    { id: "y", status: "done" as const, estimate_pomodoros: 2 },
    { id: "z", status: "dropped" as const, estimate_pomodoros: 10 },
  ];

  it("uses the metric when it has a target", () => {
    expect(goalProgress({ metric_target: 10, metric_current: 4 }, actions, new Map())).toBe(0.4);
    expect(goalProgress({ metric_target: 10, metric_current: 15 }, actions, new Map())).toBe(1);
    expect(goalProgress({ metric_target: 10, metric_current: null }, actions, new Map())).toBe(0);
  });

  it("otherwise uses pomodoros, ignoring dropped actions and counting done ones in full", () => {
    // done y = 2 of 2, x = 1 of 4 → 3 / 6
    expect(goalProgress({ metric_target: null, metric_current: null }, actions, new Map([["x", 1]]))).toBe(0.5);
  });

  it("is 0 with nothing sized", () => {
    expect(goalProgress({ metric_target: null, metric_current: null }, [], new Map())).toBe(0);
  });
});

describe("goalStats", () => {
  const now = "2026-10-05T12:00:00.000Z";
  const block = (ends_at: string, planned: number, completed: number, extra: object = {}) => ({
    status: "done" as const,
    ends_at,
    planned_pomodoros: planned,
    completed_pomodoros: completed,
    deleted_at: null,
    ...extra,
  });

  it("is empty with no blocks", () => {
    expect(goalStats([], now)).toEqual({ pomodoros: 0, hours: 0, followThrough: null });
  });

  it("sums pomodoros and follow-through over ended blocks", () => {
    const s = goalStats(
      [
        block("2026-10-04T10:00:00.000Z", 4, 3),
        block("2026-10-05T10:00:00.000Z", 2, 3), // over-delivery counts as 2 of 2
        block("2026-10-06T10:00:00.000Z", 2, 0, { status: "scheduled" }), // not ended
        block("2026-10-03T10:00:00.000Z", 2, 2, { deleted_at: "2026-10-03T11:00:00.000Z" }),
        block("2026-10-03T10:00:00.000Z", 2, 0, { status: "draft" }),
      ],
      now,
    );
    expect(s.pomodoros).toBe(6);
    expect(s.hours).toBe(2.5);
    expect(s.followThrough).toBeCloseTo(5 / 6);
  });
});

describe("nextRank", () => {
  it("goes after every active goal", () => {
    expect(nextRank([])).toBe(1);
    expect(nextRank([1, 3, 2])).toBe(4);
  });
});

describe("achievementNumbers", () => {
  it("lists the metric, actions, pomodoros, hours, and follow-through", () => {
    const n = achievementNumbers(
      { metric_label: "clients", metric_target: 20, metric_current: 21 },
      [{ status: "done" }, { status: "done" }, { status: "todo" }, { status: "dropped" }],
      { pomodoros: 34, hours: 14.2, followThrough: 0.814 },
    );
    expect(n).toEqual([
      { label: "clients", value: "21 / 20" },
      { label: "Actions done", value: "2 of 3" },
      { label: "Pomodoros", value: "34" },
      { label: "Focus hours", value: "14.2" },
      { label: "Follow-through", value: "81%" },
    ]);
  });

  it("leaves out what does not exist", () => {
    const n = achievementNumbers({ metric_label: null, metric_target: null, metric_current: null }, [], { pomodoros: 0, hours: 0, followThrough: null });
    expect(n.map((x) => x.label)).toEqual(["Actions done", "Pomodoros", "Focus hours"]);
  });
});
