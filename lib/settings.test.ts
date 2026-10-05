import { describe, expect, it } from "vitest";
import { clampSetting, validateSettingsPatch } from "./settings";

describe("clampSetting", () => {
  it("clamps to the range", () => {
    expect(clampSetting("max_pomodoros_per_block", 0)).toBe(1);
    expect(clampSetting("max_pomodoros_per_block", 99)).toBe(8);
    expect(clampSetting("daily_pomodoro_cap", 10)).toBe(10);
  });

  it("snaps buffer minutes to 5", () => {
    expect(clampSetting("default_buffer_minutes", 12)).toBe(10);
    expect(clampSetting("default_buffer_minutes", 13)).toBe(15);
    expect(clampSetting("default_buffer_minutes", -5)).toBe(0);
  });

  it("treats non-numbers as the minimum", () => {
    expect(clampSetting("daily_pomodoro_cap", Number.NaN)).toBe(1);
  });
});

describe("validateSettingsPatch", () => {
  it("passes through valid values and clamps numbers", () => {
    expect(validateSettingsPatch({ daily_pomodoro_cap: 50, auto_start_next_phase: false })).toEqual({
      daily_pomodoro_cap: 32,
      auto_start_next_phase: false,
    });
  });

  it("accepts a real time zone and rejects an unknown one", () => {
    expect(validateSettingsPatch({ timezone: "Europe/London" })).toEqual({ timezone: "Europe/London" });
    expect(() => validateSettingsPatch({ timezone: "Nowhere/Land" })).toThrow(/time zone/);
  });

  it("keeps the 25 + 5 pomodoro fixed", () => {
    expect(() => validateSettingsPatch({ focus_minutes: 50 })).toThrow();
    expect(() => validateSettingsPatch({ break_minutes: 10 })).toThrow();
  });
});
