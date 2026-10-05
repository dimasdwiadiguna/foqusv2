import { describe, expect, it } from "vitest";
import { ACCENT, AREA_PALETTE, cleanAreaName, goalColor, isPaletteColor, suggestAreaColor } from "./areas";

describe("areas (§5.2)", () => {
  it("has the 8-color palette", () => {
    expect(AREA_PALETTE).toHaveLength(8);
    expect(isPaletteColor("#9aa3b2")).toBe(true);
    expect(isPaletteColor("#123456")).toBe(false);
  });

  it("gives goals their area's color or the accent", () => {
    const areas = new Map([["w", { color: "#5B8DEF" }]]);
    expect(goalColor({ area_id: "w" }, areas)).toBe("#5B8DEF");
    expect(goalColor({ area_id: null }, areas)).toBe(ACCENT);
    expect(goalColor({ area_id: "gone" }, areas)).toBe(ACCENT);
  });

  it("suggests an unused color", () => {
    expect(suggestAreaColor([{ color: "#5B8DEF", archived_at: null }])).toBe("#3DDC97");
    expect(suggestAreaColor([{ color: "#5B8DEF", archived_at: "2026-10-01T00:00:00Z" }])).toBe("#5B8DEF");
  });

  it("cleans names", () => {
    expect(cleanAreaName("  Deep   work ")).toBe("Deep work");
    expect(() => cleanAreaName(" ")).toThrow();
    expect(() => cleanAreaName("x".repeat(41))).toThrow();
  });
});
