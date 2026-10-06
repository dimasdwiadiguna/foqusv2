import { describe, expect, it } from "vitest";
import { shortcutFor } from "./shortcuts";

describe("keyboard shortcuts (§6.11)", () => {
  it("maps N, F, T, and the arrows outside Focus", () => {
    expect(["n", "N", "f", "t", "ArrowLeft", "ArrowRight", "x"].map((key) => shortcutFor({ key }, "other"))).toEqual(["quickAdd", "quickAdd", "focus", "today", "prevDay", "nextDay", null]);
  });
  it("maps Space to pause or resume on the Focus screen only", () => {
    expect(shortcutFor({ key: " " }, "focus")).toBe("pauseResume");
    expect(shortcutFor({ key: "n" }, "focus")).toBeNull();
    expect(shortcutFor({ key: " " }, "other")).toBeNull();
  });
  it("stays quiet while typing, with modifiers, or with a dialog open", () => {
    expect(shortcutFor({ key: "n", targetTag: "INPUT" }, "other")).toBeNull();
    expect(shortcutFor({ key: "n", targetTag: "textarea" }, "other")).toBeNull();
    expect(shortcutFor({ key: "n", editable: true }, "other")).toBeNull();
    expect(shortcutFor({ key: "n", metaKey: true }, "other")).toBeNull();
    expect(shortcutFor({ key: "ArrowLeft", dialogOpen: true }, "other")).toBeNull();
    expect(shortcutFor({ key: " ", targetTag: "TEXTAREA" }, "focus")).toBeNull();
  });
});
