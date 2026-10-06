import { describe, expect, it } from "vitest";
import { dueReview, planWeekFor, reviewWeekFor } from "./review";

describe("weekly review availability (§5.15)", () => {
  it("is available from Sunday for this week, and until done during the next week", () => {
    expect(reviewWeekFor("2026-10-10")).toBe("2026-09-28"); // Saturday: last week's review
    expect(reviewWeekFor("2026-10-11")).toBe("2026-10-05"); // Sunday: this week's
    expect(reviewWeekFor("2026-10-12")).toBe("2026-10-05"); // Monday: still last week's
    expect(planWeekFor("2026-10-05")).toBe("2026-10-12");
  });
  it("is due only when not completed and the week had activity", () => {
    const any = () => true;
    expect(dueReview("2026-10-11", new Set(), any)).toBe("2026-10-05");
    expect(dueReview("2026-10-11", new Set(["2026-10-05"]), any)).toBeNull();
    expect(dueReview("2026-10-11", new Set(), () => false)).toBeNull();
  });
});
