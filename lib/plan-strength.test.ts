import { describe, expect, it } from "vitest";
import { movesPoints, planStrength, strengthBand, type StrengthInput } from "./plan-strength";

const iso = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`).toISOString();
const ms = (date: string, time: string) => Date.parse(iso(date, time));
// Tuesday 6 Oct 2026, 12:00 Jakarta; week of Mon 5 Oct. The plan ends Sun 1 Nov: 4 whole weeks.
const base: StrengthInput = {
  goal: { id: "g", why: null, anti_goals: [] },
  plan: { outcome: "", metric_target: null, confidence_pct: null, obstacles: [], ends_on: "2026-11-01", season_id: "2026-Q4" },
  moves: [],
  actions: [],
  blocks: [],
  weekStart: "2026-10-05",
  weekSpan: { start: ms("2026-10-05", "00:00"), end: ms("2026-10-12", "00:00") },
  now: iso("2026-10-06", "12:00"),
};
const action = (id: string, estimate: number, over: Partial<StrengthInput["actions"][number]> = {}) => ({
  id,
  status: "todo" as const,
  estimate_pomodoros: estimate,
  major_move_id: null,
  deleted_at: null,
  ...over,
});
const block = (action_id: string, date: string, time: string, planned: number, completed: number, status: "scheduled" | "done" | "missed" | "draft" = "done") => ({
  action_id,
  status,
  starts_at: iso(date, time),
  ends_at: new Date(ms(date, time) + planned * 30 * 60_000).toISOString(),
  planned_pomodoros: planned,
  completed_pomodoros: completed,
  deleted_at: null,
});
const move = (id: string, status: "open" | "done" = "open") => ({ id, status, deleted_at: null });

describe("bands", () => {
  it("0–39 Weak, 40–69 Fair, 70–100 Strong", () => {
    expect([0, 39, 40, 69, 70, 100].map(strengthBand)).toEqual(["weak", "weak", "fair", "fair", "strong", "strong"]);
  });
});

describe("goal completeness (25)", () => {
  it("outcome with a metric target 10, outcome only 5; why 8; an anti-goal 7", () => {
    expect(planStrength(base).completeness).toBe(0);
    expect(planStrength({ ...base, plan: { ...base.plan, outcome: "Submitted" } }).completeness).toBe(5);
    expect(planStrength({ ...base, plan: { ...base.plan, outcome: "Submitted", metric_target: 20 } }).completeness).toBe(10);
    expect(planStrength({ ...base, goal: { ...base.goal, why: "Career" } }).completeness).toBe(8);
    expect(planStrength({ ...base, goal: { ...base.goal, anti_goals: ["No weekends"] } }).completeness).toBe(7);
    expect(planStrength({ ...base, goal: { id: "g", why: "Career", anti_goals: ["x"] }, plan: { ...base.plan, outcome: "Done", metric_target: 3 } }).completeness).toBe(25);
  });
});

describe("major moves (25)", () => {
  it("counts moves: 0 → 0, 1–2 → 8, 3–5 → 15, 6+ → 10", () => {
    expect([0, 1, 2, 3, 5, 6, 9].map(movesPoints)).toEqual([0, 8, 8, 15, 15, 10, 10]);
    const three = [move("m1"), move("m2"), move("m3", "done")];
    // Without an action on every open move, only the count scores.
    expect(planStrength({ ...base, moves: three }).moves).toBe(15);
  });
  it("+5 when every open move has an open action, +5 for 80% confidence with a mitigated obstacle", () => {
    const moves = [move("m1"), move("m2", "done")];
    const actions = [action("a", 2, { major_move_id: "m1" })];
    expect(planStrength({ ...base, moves, actions }).moves).toBe(13);
    const plan = { ...base.plan, confidence_pct: 80, obstacles: [{ obstacle: "Teaching load", mitigation: "Write before class" }] };
    expect(planStrength({ ...base, moves, actions, plan }).moves).toBe(18);
    expect(planStrength({ ...base, plan: { ...plan, confidence_pct: 79 } }).moves).toBe(0);
    expect(planStrength({ ...base, plan: { ...plan, obstacles: [{ obstacle: "x", mitigation: " " }] } }).moves).toBe(0);
  });
});

describe("scheduled versus needed (25)", () => {
  it("is min(scheduled ÷ needed, 1) × 25 with needed = ceil(remaining ÷ weeks left)", () => {
    // 12 remaining over 4 weeks → 3 needed; 2 scheduled this week → 16.67 → 17.
    const actions = [action("a", 8), action("b", 4)];
    const blocks = [block("a", "2026-10-07", "06:00", 2, 0, "scheduled"), block("a", "2026-09-30", "06:00", 2, 0, "scheduled")];
    const r = planStrength({ ...base, actions, blocks });
    expect(r).toMatchObject({ needed: 3, scheduledPomodoros: 2, scheduled: 17 });
    // Completed pomodoros reduce what remains; done blocks this week count as scheduled.
    const more = planStrength({ ...base, actions, blocks: [...blocks, block("b", "2026-10-05", "06:00", 2, 2)] });
    expect(more).toMatchObject({ needed: 3, scheduledPomodoros: 4, scheduled: 25 });
    // Drafts do not count.
    expect(planStrength({ ...base, actions, blocks: [block("a", "2026-10-07", "06:00", 4, 0, "draft")] }).scheduled).toBe(0);
  });
  it("is 0 with 'Add sized actions' when there are no open actions", () => {
    const r = planStrength({ ...base, actions: [action("a", 2, { status: "done" })] });
    expect(r).toMatchObject({ scheduled: 0, noSizedActions: true });
    expect(r.improvements.map((i) => i.text)).toContain("Add sized actions (+25)");
  });
  it("takes at least one week left", () => {
    const r = planStrength({ ...base, plan: { ...base.plan, ends_on: "2026-10-07" }, actions: [action("a", 6)] });
    expect(r.needed).toBe(6);
  });
});

describe("follow-through (25)", () => {
  it("is 12 with 'No data yet' before any block ends", () => {
    const r = planStrength({ ...base, actions: [action("a", 2)], blocks: [block("a", "2026-10-07", "06:00", 2, 0, "scheduled")] });
    expect(r).toMatchObject({ followThrough: 12, noFollowThroughData: true, rate: null });
  });
  it("is Σ min(completed, planned) ÷ Σ planned × 25 over blocks ended in the last 14 days", () => {
    const blocks = [
      block("a", "2026-10-05", "06:00", 2, 2),
      block("a", "2026-10-01", "06:00", 2, 3), // capped at planned
      block("a", "2026-09-28", "06:00", 4, 0, "missed"),
      block("a", "2026-09-20", "06:00", 4, 0, "missed"), // older than 14 days
    ];
    const r = planStrength({ ...base, actions: [action("a", 20)], blocks });
    expect(r.rate).toBeCloseTo(0.5);
    expect(r.followThrough).toBe(13);
    expect(r.improvements.some((i) => i.text.startsWith("Follow-through is 50% over two weeks"))).toBe(true);
  });
});

describe("total and improvements", () => {
  it("sums the parts, bands them, and orders improvements by points", () => {
    const r = planStrength(base);
    // completeness 0 + moves 0 + scheduled 0 (no sized actions) + follow-through 12
    expect(r).toMatchObject({ total: 12, band: "weak" });
    expect(r.improvements[0].points).toBe(25);
    expect(r.improvements.map((i) => i.points)).toEqual([...r.improvements.map((i) => i.points)].sort((a, b) => b - a));
    expect(r.improvements.find((i) => i.text.startsWith("Write why"))?.link).toBe("/goal-setup?goal=g&season=2026-Q4&step=2&mode=edit");
  });
  it("reaches 100 for a complete, scheduled, kept plan", () => {
    const r = planStrength({
      ...base,
      goal: { id: "g", why: "Career", anti_goals: ["x"] },
      plan: { ...base.plan, outcome: "Submitted", metric_target: 1, confidence_pct: 90, obstacles: [{ obstacle: "o", mitigation: "m" }] },
      moves: [move("m1"), move("m2"), move("m3")],
      actions: ["m1", "m2", "m3"].map((m) => action(`a-${m}`, 2, { major_move_id: m })),
      blocks: [block("a-m1", "2026-10-05", "06:00", 2, 2), block("a-m2", "2026-10-07", "06:00", 2, 0, "scheduled")],
    });
    expect(r).toMatchObject({ total: 100, band: "strong", improvements: [] });
  });
});
