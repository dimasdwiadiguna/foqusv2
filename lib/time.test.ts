import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDateRange,
  formatSeason,
  formatShortDate,
  parseSeasonId,
  seasonOfDate,
  shiftSeason,
  dayBounds,
  diffDays,
  endOfWeek,
  formatDayHeader,
  formatSeasonWeek,
  formatWeekRange,
  isValidTimeZone,
  parseDate,
  quarterBounds,
  quarterOf,
  seasonId,
  seasonWeekCount,
  seasonWeekNumber,
  startOfWeek,
  toLocalDate,
  toLocalTime,
  todayIn,
  weekDates,
  weekdayOf,
  zonedToInstant,
} from "./time";

const JKT = "Asia/Jakarta";

describe("Step 1.1 acceptance", () => {
  it("Q4 2026 runs 1 Oct to 31 Dec and has 14 weeks", () => {
    expect(quarterBounds(2026, 4)).toEqual({ startsOn: "2026-10-01", endsOn: "2026-12-31" });
    expect(seasonWeekCount(2026, 4)).toBe(14);
  });

  it("5–11 Oct 2026 is week 2", () => {
    for (const d of weekDates("2026-10-05")) {
      expect(seasonWeekNumber(d)).toEqual({ year: 2026, quarter: 4, week: 2, weeks: 14 });
    }
    expect(seasonWeekNumber("2026-10-04").week).toBe(1);
    expect(seasonWeekNumber("2026-10-12").week).toBe(3);
  });

  it("23:30 UTC on a Sunday falls on Monday in Asia/Jakarta", () => {
    const sundayNight = "2026-10-04T23:30:00.000Z";
    expect(weekdayOf(toLocalDate(sundayNight, "UTC"))).toBe(7);
    expect(toLocalDate(sundayNight, JKT)).toBe("2026-10-05");
    expect(weekdayOf(toLocalDate(sundayNight, JKT))).toBe(1);
    expect(toLocalTime(sundayNight, JKT)).toBe("06:30");
  });
});

describe("civil dates", () => {
  it("parses and rejects dates", () => {
    expect(parseDate("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(() => parseDate("2026-02-29")).toThrow();
    expect(() => parseDate("2026-2-1")).toThrow();
  });

  it("adds days across months, years, and leap days", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-10-01", "2026-12-31")).toBe(91);
  });

  it("numbers weekdays 1 (Monday) to 7 (Sunday)", () => {
    expect(weekdayOf("2026-10-05")).toBe(1);
    expect(weekdayOf("2026-10-11")).toBe(7);
    expect(weekdayOf("1970-01-01")).toBe(4);
    expect(weekdayOf("1969-12-29")).toBe(1);
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
    expect(endOfWeek("2026-10-05")).toBe("2026-10-11");
    expect(startOfWeek("2027-01-01")).toBe("2026-12-28");
    expect(weekDates("2026-10-07")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });
});

describe("seasons", () => {
  it("maps months to quarters", () => {
    expect(quarterOf("2026-01-01")).toEqual({ year: 2026, quarter: 1 });
    expect(quarterOf("2026-03-31")).toEqual({ year: 2026, quarter: 1 });
    expect(quarterOf("2026-04-01")).toEqual({ year: 2026, quarter: 2 });
    expect(quarterOf("2026-09-30")).toEqual({ year: 2026, quarter: 3 });
    expect(quarterOf("2026-12-31")).toEqual({ year: 2026, quarter: 4 });
  });

  it("builds deterministic season ids", () => {
    expect(seasonId(2026, 4)).toBe("2026-Q4");
  });

  it("gives every quarter's bounds", () => {
    expect(quarterBounds(2028, 1)).toEqual({ startsOn: "2028-01-01", endsOn: "2028-03-31" });
    expect(quarterBounds(2026, 2)).toEqual({ startsOn: "2026-04-01", endsOn: "2026-06-30" });
    expect(quarterBounds(2026, 3)).toEqual({ startsOn: "2026-07-01", endsOn: "2026-09-30" });
  });

  it("counts the last week of a season", () => {
    expect(seasonWeekNumber("2026-12-31")).toEqual({ year: 2026, quarter: 4, week: 14, weeks: 14 });
    // Q1 2027 starts on a Friday, so its week 1 begins on 28 Dec 2026.
    expect(seasonWeekNumber("2027-01-01").week).toBe(1);
    expect(seasonWeekNumber("2027-01-04").week).toBe(2);
  });
});

describe("time zones", () => {
  it("converts wall-clock times to instants", () => {
    expect(zonedToInstant("2026-10-05", "05:00", JKT)).toBe("2026-10-04T22:00:00.000Z");
    expect(zonedToInstant("2026-10-05", "24:00", JKT)).toBe("2026-10-05T17:00:00.000Z");
    expect(zonedToInstant("2026-10-05", "05:00", "UTC")).toBe("2026-10-05T05:00:00.000Z");
  });

  it("gives a day's bounds in the zone", () => {
    expect(dayBounds("2026-10-05", JKT)).toEqual({
      start: "2026-10-04T17:00:00.000Z",
      end: "2026-10-05T17:00:00.000Z",
    });
  });

  it("handles daylight-saving gaps and overlaps", () => {
    const ny = "America/New_York";
    // 8 Mar 2026: 02:00 jumps to 03:00. 02:30 does not exist; it lands after the jump.
    expect(zonedToInstant("2026-03-08", "02:30", ny)).toBe("2026-03-08T07:30:00.000Z");
    // 1 Nov 2026: 01:30 happens twice; the earlier (EDT) one is chosen.
    expect(zonedToInstant("2026-11-01", "01:30", ny)).toBe("2026-11-01T05:30:00.000Z");
    // A 23-hour day.
    const { start, end } = dayBounds("2026-03-08", ny);
    expect(Date.parse(end) - Date.parse(start)).toBe(23 * 3_600_000);
  });

  it("finds today in the zone, not the device's", () => {
    expect(todayIn("2026-10-04T16:59:59.000Z", JKT)).toBe("2026-10-04");
    expect(todayIn("2026-10-04T17:00:00.000Z", JKT)).toBe("2026-10-05");
    expect(todayIn(new Date("2026-10-04T17:00:00.000Z"), "UTC")).toBe("2026-10-04");
  });

  it("validates time zone names", () => {
    expect(isValidTimeZone(JKT)).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("display", () => {
  it("formats the Today header", () => {
    expect(formatDayHeader("2026-10-05")).toBe("Mon 5 Oct");
    expect(formatSeasonWeek("2026-10-05")).toBe("Q4 2026 · Week 2 of 14");
  });

  it("formats a week's range", () => {
    expect(formatWeekRange("2026-10-07")).toBe("5 – 11 Oct");
    expect(formatWeekRange("2026-10-01")).toBe("28 Sep – 4 Oct");
  });
});

describe("season ids", () => {
  it("parses, shifts, and finds seasons", () => {
    expect(parseSeasonId("2026-Q4")).toEqual({ year: 2026, quarter: 4 });
    expect(() => parseSeasonId("2026-Q5")).toThrow();
    expect(shiftSeason("2026-Q4", 1)).toBe("2027-Q1");
    expect(shiftSeason("2026-Q1", -1)).toBe("2025-Q4");
    expect(shiftSeason("2026-Q2", 6)).toBe("2027-Q4");
    expect(seasonOfDate("2026-10-05")).toBe("2026-Q4");
  });

  it("formats seasons and short dates", () => {
    expect(formatSeason("2026-Q4")).toBe("Q4 2026");
    expect(formatShortDate("2026-11-30")).toBe("30 Nov");
    expect(formatDateRange("2026-10-01", "2026-12-31")).toBe("1 Oct – 31 Dec");
  });
});
