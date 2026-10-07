import { describe, expect, it } from "vitest";
import { checkHabit, countLevel, habitStreak, habitWeek, levelText, type Level } from "./habits";
import { toLocalDate, weekDates } from "./time";

const water = { kind: "count" as const, unit: "glasses", levels: { min: 4, std: 6, elite: 8 } };
const log = (date: string, level: Level, deleted_at: string | null = null) => ({ date, level, deleted_at });
const EVERY = [1, 2, 3, 4, 5, 6, 7] as (1 | 2 | 3 | 4 | 5 | 6 | 7)[];
const WEEKDAYS = [1, 2, 3, 4, 5] as (1 | 2 | 3 | 4 | 5)[];

describe("levels", () => {
  it("turns a count into Min, Std, or Elite", () => {
    expect([0, 3, 4, 5, 6, 7, 8, 12].map((n) => countLevel(n, water.levels))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(levelText(water, 2)).toBe("6 glasses");
    expect(levelText({ kind: "level", unit: null, levels: { min: "1 stretch", std: "10 minutes", elite: "30 minutes" } }, 3)).toBe("30 minutes");
  });
});

describe("checkHabit", () => {
  it("cleans and validates", () => {
    expect(checkHabit({ title: " Water ", ...water, weekdays: [3, 1, 1] })).toMatchObject({ title: "Water", weekdays: [1, 3] });
    expect(() => checkHabit({ title: "x", ...water, levels: { min: 6, std: 4, elite: 8 }, weekdays: EVERY })).toThrow(/go up/);
    expect(() => checkHabit({ title: "x", ...water, levels: { min: 0, std: 4, elite: 8 }, weekdays: EVERY })).toThrow(/whole number/);
    expect(() => checkHabit({ title: "x", kind: "level", unit: null, levels: { min: "a", std: " ", elite: "c" }, weekdays: EVERY })).toThrow(/Describe/);
    expect(() => checkHabit({ title: "x", ...water, weekdays: [] })).toThrow(/day/);
  });
});

describe("the elastic streak", () => {
  it("counts any level, and today is open until it is logged", () => {
    const logs = [log("2026-10-05", 1), log("2026-10-06", 3), log("2026-10-07", 2)];
    expect(habitStreak(EVERY, logs, "2026-10-07")).toEqual({ current: 3, today: 2 });
    // Today not logged yet: the run through yesterday still stands.
    expect(habitStreak(EVERY, logs.slice(0, 2), "2026-10-07")).toEqual({ current: 2, today: 0 });
  });

  it("breaks on an expected day with nothing, but not on a day the habit is not expected", () => {
    // Fri 9, (Sat, Sun not expected), Mon 12: a weekday habit keeps its streak over the weekend.
    const logs = [log("2026-10-08", 1), log("2026-10-09", 2), log("2026-10-12", 1)];
    expect(habitStreak(WEEKDAYS, logs, "2026-10-12").current).toBe(3);
    expect(habitStreak(EVERY, logs, "2026-10-12").current).toBe(1);
    // A missed Wednesday breaks it.
    expect(habitStreak(WEEKDAYS, [log("2026-10-06", 1), log("2026-10-08", 1)], "2026-10-08").current).toBe(1);
    // A deleted log does not count.
    expect(habitStreak(EVERY, [log("2026-10-07", 2, "x")], "2026-10-07").current).toBe(0);
  });

  it("follows the local date at the midnight boundary", () => {
    // Logged at 23:50 and 00:10 in Jakarta: two different local days, in a row.
    const d1 = toLocalDate("2026-10-06T16:50:00Z", "Asia/Jakarta");
    const d2 = toLocalDate("2026-10-06T17:10:00Z", "Asia/Jakarta");
    expect([d1, d2]).toEqual(["2026-10-06", "2026-10-07"]);
    expect(habitStreak(EVERY, [log(d1, 1), log(d2, 1)], "2026-10-07").current).toBe(2);
  });
});

describe("habitWeek", () => {
  it("counts expected days so far and each level", () => {
    const logs = [log("2026-10-05", 1), log("2026-10-06", 3), log("2026-10-08", 2), log("2026-10-10", 3)];
    expect(habitWeek(WEEKDAYS, logs, weekDates("2026-10-05"), "2026-10-08")).toEqual({ expected: 4, hit: 3, min: 1, std: 1, elite: 1 });
    expect(habitWeek(EVERY, logs, weekDates("2026-10-05"), "2026-10-11")).toEqual({ expected: 7, hit: 4, min: 1, std: 1, elite: 2 });
  });
});
