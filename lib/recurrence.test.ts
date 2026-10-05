import { describe, expect, it } from "vitest";
import { checkRule, formatWeekdays, occurrenceDates } from "./recurrence";
import { occurrenceId } from "./ids";

const rule = { weekdays: [1, 3, 5] as (1 | 3 | 5)[], starts_on: "2026-10-01", ends_on: null, active: true, deleted_at: null };

describe("occurrenceDates", () => {
  it("lists matching weekdays of the week", () => {
    expect(occurrenceDates(rule, "2026-10-05", "2026-10-05")).toEqual(["2026-10-05", "2026-10-07", "2026-10-09"]);
  });
  it("skips days already past, and days outside the rule's dates", () => {
    expect(occurrenceDates(rule, "2026-10-05", "2026-10-06")).toEqual(["2026-10-07", "2026-10-09"]);
    expect(occurrenceDates({ ...rule, starts_on: "2026-10-08" }, "2026-10-05", "2026-10-05")).toEqual(["2026-10-09"]);
    expect(occurrenceDates({ ...rule, ends_on: "2026-10-06" }, "2026-10-05", "2026-10-05")).toEqual(["2026-10-05"]);
  });
  it("generates nothing when paused or deleted", () => {
    expect(occurrenceDates({ ...rule, active: false }, "2026-10-05", "2026-10-05")).toEqual([]);
    expect(occurrenceDates({ ...rule, deleted_at: "x" }, "2026-10-05", "2026-10-05")).toEqual([]);
  });
  it("uses deterministic occurrence ids", () => {
    expect(occurrenceId("r1", "2026-10-05")).toBe("r1:2026-10-05");
  });
});

describe("checkRule", () => {
  const base = { title: " Run ", weekdays: [5, 1, 1] as (1 | 5)[], pomodoros: 2, preferred_start: "06:00", starts_on: "2026-10-05", ends_on: null };
  it("cleans and validates", () => {
    expect(checkRule(base, 4)).toMatchObject({ title: "Run", weekdays: [1, 5] });
    expect(() => checkRule({ ...base, title: " " }, 4)).toThrow(/title/);
    expect(() => checkRule({ ...base, weekdays: [] }, 4)).toThrow(/day/);
    expect(() => checkRule({ ...base, pomodoros: 5 }, 4)).toThrow(/1 to 4/);
    expect(() => checkRule({ ...base, preferred_start: "25:00" }, 4)).toThrow(/time/);
    expect(() => checkRule({ ...base, ends_on: "2026-10-01" }, 4)).toThrow(/before/);
  });
});

describe("formatWeekdays", () => {
  it("names common sets", () => {
    expect(formatWeekdays([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(formatWeekdays([7, 6])).toBe("Weekends");
    expect(formatWeekdays([1, 2, 3, 4, 5, 6, 7])).toBe("Every day");
    expect(formatWeekdays([5, 1, 3])).toBe("Mon, Wed, Fri");
  });
});
