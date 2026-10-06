import { describe, expect, it } from "vitest";
import type { CoachMessage } from "@/types";
import { dailyBrief, dismissedUntil, evaluateRules, mergeInsights, principleFor, PRINCIPLES, type CoachGoal, type CoachInput, type RuleCode } from "./coach";
import type { PlanStrength } from "./plan-strength";

const strength = (total: number): PlanStrength => ({
  total,
  band: total >= 70 ? "strong" : total >= 40 ? "fair" : "weak",
  completeness: 0,
  moves: 0,
  scheduled: 0,
  followThrough: 0,
  noFollowThroughData: false,
  noSizedActions: false,
  remaining: 0,
  needed: 0,
  scheduledPomodoros: 0,
  rate: null,
  improvements: [{ text: "Write why this goal matters (+8)", points: 8, link: "/goal-setup?goal=g&step=2" }],
});
const goal = (over: Partial<CoachGoal> = {}): CoachGoal => ({
  id: "g",
  title: "Thesis",
  scheduledThisWeek: 4,
  remaining: 10,
  freeMinutesBeforeEnd: 10_000,
  endsOn: "2026-12-31",
  strength: strength(80),
  ...over,
});
// A calm week where no rule fires.
const calm: CoachInput = {
  today: "2026-10-07",
  weekStart: "2026-10-05",
  goals: [goal()],
  planned: { goal: 6, area: 4 },
  load: 0.5,
  overCapDays: [],
  followThrough14: 0.75,
  followThroughWeek: 0.8,
  peak: { goal: 4, area: 2 },
  checkins: [
    { date: "2026-10-06", energy: 3 },
    { date: "2026-10-05", energy: 2 },
    { date: "2026-10-04", energy: 2 },
  ],
  actions: [{ id: "a", title: "Email", reschedule_count: 2 }],
  doneActions: Array.from({ length: 10 }, () => ({ estimate: 2, completed: 3 })),
  missedCheckin: false,
  reviewDue: null,
};
const codes = (i: CoachInput) => evaluateRules(i).map((x) => x.code);

describe("coach rules (§5.18): each fires on its trigger and not otherwise", () => {
  it("is silent for a calm week", () => {
    expect(codes(calm)).toEqual([]);
  });

  const cases: [RuleCode, Partial<CoachInput>, Partial<CoachInput>][] = [
    ["GOAL_STARVED", { goals: [goal({ scheduledThisWeek: 0 })] }, { goals: [goal({ scheduledThisWeek: 1 })] }],
    ["LOW_GOAL_SHARE", { planned: { goal: 2, area: 8 } }, { planned: { goal: 3, area: 7 } }],
    ["OVERBOOKED", { load: 0.95 }, { load: 0.9 }],
    ["OVERBOOKED", { overCapDays: ["2026-10-08"] }, { overCapDays: [] }],
    ["LOW_FOLLOW_THROUGH", { followThrough14: 0.59 }, { followThrough14: 0.6 }],
    ["LOW_FOLLOW_THROUGH", { followThrough14: 0.1 }, { followThrough14: null }],
    ["PEAK_MISUSE", { peak: { goal: 2, area: 3 } }, { peak: { goal: 3, area: 3 } }],
    ["LOW_ENERGY", { checkins: [{ date: "2026-10-06", energy: 2 }, { date: "2026-10-05", energy: 1 }, { date: "2026-10-04", energy: 2 }] }, { checkins: [{ date: "2026-10-06", energy: 2 }, { date: "2026-10-05", energy: 1 }] }],
    ["CHRONIC_RESCHEDULE", { actions: [{ id: "a", title: "Email", reschedule_count: 3 }] }, { actions: [{ id: "a", title: "Email", reschedule_count: 2 }] }],
    ["DEADLINE_RISK", { goals: [goal({ remaining: 40, freeMinutesBeforeEnd: 1000 })] }, { goals: [goal({ remaining: 30, freeMinutesBeforeEnd: 900 })] }],
    ["ESTIMATE_DRIFT", { doneActions: Array.from({ length: 10 }, () => ({ estimate: 2, completed: 4 })) }, { doneActions: Array.from({ length: 9 }, () => ({ estimate: 2, completed: 4 })) }],
    ["TOO_MANY_GOALS", { goals: [1, 2, 3, 4, 5].map((n) => goal({ id: `g${n}` })) }, { goals: [1, 2, 3, 4].map((n) => goal({ id: `g${n}` })) }],
    ["WEAK_PLAN", { goals: [goal({ strength: strength(39) })] }, { goals: [goal({ strength: strength(40) })] }],
    ["MISSED_CHECKIN", { missedCheckin: true }, { missedCheckin: false }],
    ["REVIEW_DUE", { reviewDue: "2026-10-05" }, { reviewDue: null }],
    ["STRONG_WEEK", { followThroughWeek: 0.85 }, { followThroughWeek: 0.84 }],
  ];
  for (const [code, on, off] of cases) {
    it(`${code}: ${JSON.stringify(on).slice(0, 60)}`, () => {
      expect(codes({ ...calm, ...on })).toContain(code);
      expect(codes({ ...calm, ...off })).not.toContain(code);
    });
  }

  it("orders by priority and links where it can be acted on", () => {
    const all = evaluateRules({ ...calm, reviewDue: "2026-10-05", goals: [goal({ scheduledThisWeek: 0, strength: strength(20) })], followThroughWeek: 0.9 });
    expect(all.map((i) => i.code)).toEqual(["REVIEW_DUE", "GOAL_STARVED", "WEAK_PLAN", "STRONG_WEEK"]);
    expect(all.find((i) => i.code === "WEAK_PLAN")).toMatchObject({ body: "Write why this goal matters (+8)", action_link: "/goal-setup?goal=g&step=2", goal_id: "g" });
  });
});

describe("mergeInsights: dismissal", () => {
  const now = "2026-10-07T03:00:00.000Z";
  const insight = evaluateRules({ ...calm, missedCheckin: true })[0];
  const stored = (over: Partial<CoachMessage>): CoachMessage => ({
    id: "MISSED_CHECKIN:2026-10-06",
    source: "rule",
    rule_code: "MISSED_CHECKIN",
    goal_id: null,
    title: insight.title,
    body: insight.body,
    action_link: insight.action_link,
    status: "new",
    valid_until: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    _dirty: 1,
    ...over,
  });

  it("creates a new message for a new trigger, and leaves an unchanged one alone", () => {
    expect(mergeInsights([], [insight], now)).toEqual([{ kind: "create", id: "MISSED_CHECKIN:2026-10-06", row: expect.objectContaining({ status: "new", source: "rule", rule_code: "MISSED_CHECKIN" }) }]);
    expect(mergeInsights([stored({})], [insight], now)).toEqual([]);
  });

  it("keeps a dismissed insight away for 7 days for the same trigger, then lets it back", () => {
    const dismissed = stored({ status: "dismissed", valid_until: dismissedUntil(now) });
    expect(dismissed.valid_until).toBe("2026-10-14T03:00:00.000Z");
    expect(mergeInsights([dismissed], [insight], "2026-10-14T02:59:00.000Z")).toEqual([]);
    expect(mergeInsights([dismissed], [insight], "2026-10-14T03:01:00.000Z")).toEqual([{ kind: "update", id: dismissed.id, patch: expect.objectContaining({ status: "new" }) }]);
    // A different trigger (another day) is a new message even while this one is held.
    const other = { ...insight, key: "2026-10-07" };
    expect(mergeInsights([dismissed], [other], now).map((w) => w.id)).toEqual(["MISSED_CHECKIN:2026-10-07"]);
  });

  it("marks a message done when its trigger is gone", () => {
    expect(mergeInsights([stored({})], [], now)).toEqual([{ kind: "update", id: "MISSED_CHECKIN:2026-10-06", patch: { status: "done" } }]);
  });
});

describe("daily brief and principles", () => {
  it("writes one sentence", () => {
    expect(dailyBrief({ blocks: 3, pomodoros: 6, firstAt: "05:30", topGoal: { title: "Research proposal", strength: strength(78) }, topInsight: { title: "Run 10 km has no time this week" } })).toBe(
      "3 blocks, 6 pomodoros today. First up at 05:30. Research proposal is Strong (78). Run 10 km has no time this week.",
    );
    expect(dailyBrief({ blocks: 0, pomodoros: 0, firstAt: null, topGoal: null, topInsight: null })).toBe("Nothing scheduled today.");
  });
  it("shows one principle per day, cycling", () => {
    expect(principleFor("2026-10-07")).toBe(principleFor("2026-10-07"));
    expect(principleFor("2026-10-07")).not.toBe(principleFor("2026-10-08"));
    expect(PRINCIPLES).toContain(principleFor("2025-03-01"));
  });
});
