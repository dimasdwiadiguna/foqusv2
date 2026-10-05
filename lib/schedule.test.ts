import { describe, expect, it } from "vitest";
import { checkWeekdays, checkWindow } from "./schedule";

describe("schedule validation", () => {
  it("accepts valid windows", () => {
    expect(() => checkWindow("05:00", "21:00")).not.toThrow();
    expect(() => checkWindow("22:00", "24:00")).not.toThrow();
  });

  it("rejects bad windows", () => {
    expect(() => checkWindow("21:00", "05:00")).toThrow(/after/);
    expect(() => checkWindow("05:00", "05:00")).toThrow(/after/);
    expect(() => checkWindow("5:00", "21:00")).toThrow(/05:00/);
    expect(() => checkWindow("05:03", "21:00")).toThrow(/5-minute/);
  });

  it("cleans weekdays", () => {
    expect(checkWeekdays([3, 1, 3])).toEqual([1, 3]);
    expect(() => checkWeekdays([])).toThrow();
    expect(() => checkWeekdays([0, 8])).toThrow();
  });
});
