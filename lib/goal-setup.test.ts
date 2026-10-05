import { describe, expect, it } from "vitest";
import { clampStep, parseSetupProgress } from "./goal-setup";

describe("goal setup progress", () => {
  it("round-trips and clamps", () => {
    expect(parseSetupProgress(JSON.stringify({ goalId: "g", seasonId: "2026-Q4", step: 3 }))).toEqual({ goalId: "g", seasonId: "2026-Q4", step: 3 });
    expect(parseSetupProgress(JSON.stringify({ goalId: "g", seasonId: "2026-Q4", step: 99 }))?.step).toBe(6);
    expect(clampStep(0)).toBe(1);
    expect(clampStep(2.5)).toBe(1);
  });

  it("ignores missing or malformed values", () => {
    expect(parseSetupProgress(null)).toBeNull();
    expect(parseSetupProgress("{oops")).toBeNull();
    expect(parseSetupProgress(JSON.stringify({ goalId: 1 }))).toBeNull();
  });
});
