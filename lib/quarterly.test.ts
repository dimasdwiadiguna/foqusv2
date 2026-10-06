import { describe, expect, it } from "vitest";
import { goalsToResolve, joinSeasonNote, quarterlyDue, quarterlyOpensOn, splitSeasonNote } from "./quarterly";

const any = (s: string) => s >= "2026-Q4";

describe("quarterly review prompt (§5.16)", () => {
  it("first appears on 24 December 2026 for Q4 2026", () => {
    expect(quarterlyOpensOn("2026-Q4")).toBe("2026-12-24");
    expect(quarterlyDue("2026-12-23", new Set(), any)).toBeNull();
    expect(quarterlyDue("2026-12-24", new Set(), any)).toBe("2026-Q4");
    expect(quarterlyDue("2026-12-31", new Set(), any)).toBe("2026-Q4");
  });

  it("stays due into the next quarter until done, then stops", () => {
    expect(quarterlyDue("2027-01-15", new Set(), any)).toBe("2026-Q4");
    expect(quarterlyDue("2027-01-15", new Set(["2026-Q4"]), any)).toBeNull();
    expect(quarterlyDue("2026-12-28", new Set(["2026-Q4"]), any)).toBeNull();
  });

  it("is not asked for a season without goals", () => {
    expect(quarterlyDue("2026-12-28", new Set(), () => false)).toBeNull();
    // Mid-quarter, with last quarter never reviewed but empty: nothing.
    expect(quarterlyDue("2026-11-10", new Set(), (s) => s === "2026-Q4")).toBeNull();
  });

  it("works for every quarter end", () => {
    expect(quarterlyOpensOn("2027-Q1")).toBe("2027-03-24");
    expect(quarterlyOpensOn("2027-Q2")).toBe("2027-06-23");
    expect(quarterlyOpensOn("2027-Q3")).toBe("2027-09-23");
  });
});

describe("goalsToResolve", () => {
  it("lists active goals whose plan in the season is unresolved", () => {
    const goals = [
      { id: "a", status: "active" as const, deleted_at: null },
      { id: "b", status: "active" as const, deleted_at: null },
      { id: "c", status: "achieved" as const, deleted_at: null },
      { id: "d", status: "active" as const, deleted_at: null },
    ];
    const plans = [
      { goal_id: "a", season_id: "2026-Q4", resolution: null, deleted_at: null },
      { goal_id: "b", season_id: "2026-Q4", resolution: "carried" as const, deleted_at: null },
      { goal_id: "c", season_id: "2026-Q4", resolution: "achieved" as const, deleted_at: null },
      { goal_id: "d", season_id: "2027-Q1", resolution: null, deleted_at: null },
    ];
    expect(goalsToResolve("2026-Q4", goals, plans).map((g) => g.id)).toEqual(["a"]);
  });
});

describe("season note", () => {
  it("round-trips both parts, either one, or none", () => {
    for (const [w, c] of [["Morning blocks", "Fewer goals"], ["Morning blocks", ""], ["", "Fewer goals"], ["Line 1\nLine 2", "x"]]) {
      expect(splitSeasonNote(joinSeasonNote(w, c))).toEqual({ worked: w, change: c });
    }
    expect(joinSeasonNote(" ", "")).toBeNull();
  });
});
