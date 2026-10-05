import { describe, expect, it } from "vitest";
import { actionNumbers, checkActionOwner, clampEstimate, cleanTitle, completedByAction, dots, dotsLabel } from "./actions";

const now = "2026-10-05T03:00:00.000Z";
const block = (o: Partial<{ action_id: string; status: "scheduled" | "done" | "missed" | "draft" | "active"; starts_at: string; planned_pomodoros: number; completed_pomodoros: number; deleted_at: string | null }>) => ({
  action_id: "a",
  status: "scheduled" as const,
  starts_at: "2026-10-05T05:00:00.000Z",
  planned_pomodoros: 2,
  completed_pomodoros: 0,
  deleted_at: null,
  ...o,
});

describe("actionNumbers (§5.1)", () => {
  it("derives completed, remaining, and unscheduled", () => {
    const blocks = [
      block({ status: "done", starts_at: "2026-10-04T05:00:00.000Z", completed_pomodoros: 2 }),
      block({ planned_pomodoros: 2 }), // future scheduled
      block({ status: "draft", planned_pomodoros: 3 }), // drafts do not count
      block({ action_id: "other", completed_pomodoros: 4, status: "done" }),
      block({ planned_pomodoros: 1, deleted_at: now }),
    ];
    expect(actionNumbers({ id: "a", estimate_pomodoros: 6 }, blocks, now)).toEqual({
      estimate: 6,
      completed: 2,
      remaining: 4,
      unscheduled: 2,
    });
  });

  it("never goes below zero", () => {
    const blocks = [block({ status: "done", completed_pomodoros: 5 })];
    expect(actionNumbers({ id: "a", estimate_pomodoros: 3 }, blocks, now)).toMatchObject({ remaining: 0, unscheduled: 0 });
  });

  it("maps completed pomodoros per action", () => {
    const m = completedByAction([block({ completed_pomodoros: 1 }), block({ completed_pomodoros: 2 }), block({ action_id: "b" })]);
    expect(m.get("a")).toBe(3);
    expect(m.has("b")).toBe(false);
  });
});

describe("dots (§6.5)", () => {
  it("shows dots up to 8 and a count beyond", () => {
    expect(dots(2, 4)).toEqual({ kind: "dots", filled: 2, total: 4 });
    expect(dots(0, 8)).toEqual({ kind: "dots", filled: 0, total: 8 });
    expect(dots(5, 12)).toEqual({ kind: "count", completed: 5, total: 12 });
    expect(dots(5, 3)).toEqual({ kind: "dots", filled: 5, total: 5 });
    expect(dotsLabel(1, 1)).toBe("1 of 1 pomodoro done");
  });
});

describe("validation", () => {
  it("clamps estimates to 1–40", () => {
    expect(clampEstimate(0)).toBe(1);
    expect(clampEstimate(41)).toBe(40);
    expect(clampEstimate(2.6)).toBe(3);
    expect(clampEstimate(Number.NaN)).toBe(1);
  });

  it("cleans titles", () => {
    expect(cleanTitle("  Outline   section 2 ")).toBe("Outline section 2");
    expect(() => cleanTitle("   ")).toThrow();
  });

  it("requires exactly one owner", () => {
    expect(() => checkActionOwner({ goal_id: "g", area_id: null, major_move_id: "m" })).not.toThrow();
    expect(() => checkActionOwner({ goal_id: null, area_id: "a", major_move_id: null })).not.toThrow();
    expect(() => checkActionOwner({ goal_id: "g", area_id: "a", major_move_id: null })).toThrow();
    expect(() => checkActionOwner({ goal_id: null, area_id: null, major_move_id: null })).toThrow();
    expect(() => checkActionOwner({ goal_id: null, area_id: "a", major_move_id: "m" })).toThrow();
  });
});
