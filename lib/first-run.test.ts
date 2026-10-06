import { describe, expect, it } from "vitest";
import { firstRunDecision, parseFirstRun, REQUIRED_STEPS, SETUP_FLOW_STEPS } from "./first-run";

describe("first-run setup", () => {
  it("starts only for an empty app, resumes an unfinished one, and never returns once done", () => {
    expect(firstRunDecision(null, false)).toBe("start");
    expect(firstRunDecision(null, true)).toBe("none");
    expect(firstRunDecision({ step: 3 }, true)).toBe("resume");
    expect(firstRunDecision("done", false)).toBe("none");
  });
  it("reads the stored mark safely", () => {
    expect(parseFirstRun("done")).toBe("done");
    expect(parseFirstRun('{"step":2}')).toEqual({ step: 2 });
    expect(parseFirstRun('{"step":99}')).toBeNull();
    expect(parseFirstRun("garbage")).toBeNull();
    expect(parseFirstRun(null)).toBeNull();
  });
  it("has six steps without Google, and only availability is required", () => {
    expect(SETUP_FLOW_STEPS).toEqual(["Availability", "Peak", "Personal blocks", "Areas", "Compass", "First goal"]);
    expect([...REQUIRED_STEPS]).toEqual([0]);
  });
});
