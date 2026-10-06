/**
 * The rule-based coach (§5.18). `evaluateRules` turns this week's numbers into insights;
 * `mergeInsights` decides what changes in the stored messages (a dismissed insight stays away for 7
 * days for the same trigger); `dailyBrief` writes the sentence on Coach and Today. Pure.
 */
import type { CoachMessage, DateString, Instant } from "@/types";
import { BAND_LABEL, type PlanStrength } from "./plan-strength";
import { addDays, diffDays, formatDayHeader } from "./time";

export const THRESHOLDS = {
  lowGoalShare: 0.3,
  overbookedLoad: 0.9,
  lowFollowThrough: 0.6,
  peakMisuse: 0.5,
  lowEnergy: 2,
  lowEnergyRun: 3,
  chronicReschedule: 3,
  estimateDriftCount: 10,
  estimateDrift: 1.5,
  maxGoals: 4,
  weakPlan: 40,
  strongWeek: 0.85,
  dismissDays: 7,
} as const;

export type RuleCode =
  | "GOAL_STARVED"
  | "LOW_GOAL_SHARE"
  | "OVERBOOKED"
  | "LOW_FOLLOW_THROUGH"
  | "PEAK_MISUSE"
  | "LOW_ENERGY"
  | "CHRONIC_RESCHEDULE"
  | "DEADLINE_RISK"
  | "ESTIMATE_DRIFT"
  | "TOO_MANY_GOALS"
  | "WEAK_PLAN"
  | "MISSED_CHECKIN"
  | "REVIEW_DUE"
  | "STRONG_WEEK";

/** Highest priority first: what the daily brief mentions and the order on Coach. */
export const PRIORITY: RuleCode[] = [
  "REVIEW_DUE",
  "MISSED_CHECKIN",
  "OVERBOOKED",
  "DEADLINE_RISK",
  "GOAL_STARVED",
  "WEAK_PLAN",
  "LOW_FOLLOW_THROUGH",
  "LOW_ENERGY",
  "PEAK_MISUSE",
  "LOW_GOAL_SHARE",
  "CHRONIC_RESCHEDULE",
  "ESTIMATE_DRIFT",
  "TOO_MANY_GOALS",
  "STRONG_WEEK",
];

export interface Insight {
  code: RuleCode;
  /** What triggered it (a goal, an action, a day, a week); with the code, the trigger identity. */
  key: string;
  goal_id: string | null;
  title: string;
  body: string;
  action_link: string | null;
  /** Label for the action button. */
  action_label: string | null;
}

export interface CoachGoal {
  id: string;
  title: string;
  /** Pomodoros in this week's committed blocks (scheduled, active, done). */
  scheduledThisWeek: number;
  /** Remaining pomodoros of open actions. */
  remaining: number;
  /** Free minutes from now to the plan's end date. */
  freeMinutesBeforeEnd: number;
  endsOn: DateString;
  strength: PlanStrength | null;
}

export interface CoachInput {
  today: DateString;
  weekStart: DateString;
  goals: readonly CoachGoal[];
  /** Committed pomodoros this week. */
  planned: { goal: number; area: number };
  /** Capacity load (planned ÷ free) for the rest of the week. */
  load: number;
  /** Days this week over the daily cap. */
  overCapDays: readonly DateString[];
  /** Over the last 14 days; null without ended blocks. */
  followThrough14: number | null;
  /** This week so far; null without ended blocks. */
  followThroughWeek: number | null;
  peak: { goal: number; area: number };
  /** Completed check-ins, most recent first. */
  checkins: readonly { date: DateString; energy: number | null }[];
  /** Todo actions with their reschedule counts. */
  actions: readonly { id: string; title: string; reschedule_count: number }[];
  /** Done actions, most recently completed first, with pomodoros completed. */
  doneActions: readonly { estimate: number; completed: number }[];
  /** Whether yesterday's check-in is missing and was expected. */
  missedCheckin: boolean;
  /** The week whose review is available and not done, or null. */
  reviewDue: DateString | null;
  /** The season whose quarterly review is due, or null (§5.16). */
  quarterlyDue?: string | null;
}

export function evaluateRules(input: CoachInput): Insight[] {
  const out: Insight[] = [];
  const push = (i: Omit<Insight, "goal_id" | "action_link" | "action_label"> & Partial<Insight>) =>
    out.push({ goal_id: null, action_link: null, action_label: null, ...i });

  if (input.reviewDue) {
    push({ code: "REVIEW_DUE", key: input.reviewDue, title: "Your weekly review is ready", body: "Ten minutes to look back and plan next week.", action_link: "/review", action_label: "Start the review" });
  }
  if (input.quarterlyDue) {
    push({ code: "REVIEW_DUE", key: input.quarterlyDue, title: "Your quarterly review is ready", body: "Close the season: decide each goal's future and set up the next quarter.", action_link: `/quarterly?season=${input.quarterlyDue}`, action_label: "Start the review" });
  }
  if (input.missedCheckin) {
    const y = addDays(input.today, -1);
    push({ code: "MISSED_CHECKIN", key: y, title: "Yesterday has no check-in", body: "Two taps and a line. It stays open until midnight.", action_link: `/checkin?date=${y}`, action_label: "Check in" });
  }
  if (input.load > THRESHOLDS.overbookedLoad || input.overCapDays.length > 0) {
    const day = input.overCapDays[0];
    push({
      code: "OVERBOOKED",
      key: input.weekStart,
      title: day && input.load <= THRESHOLDS.overbookedLoad ? `${formatDayHeader(day)} is over your cap` : "The week is overbooked",
      body: "Move or drop something so the plan stays believable.",
      action_link: day ? `/plan?date=${day}` : "/plan",
      action_label: day ? "Open the day" : "Open Plan",
    });
  }
  for (const g of input.goals) {
    if (g.remaining > 0 && g.remaining * 30 > g.freeMinutesBeforeEnd) {
      push({
        code: "DEADLINE_RISK",
        key: g.id,
        goal_id: g.id,
        title: `${g.title} no longer fits before its end date`,
        body: `${g.remaining} pomodoros remain and there is less free time than that before ${formatDayHeader(g.endsOn)}. Cut scope or add time.`,
        action_link: `/goals/goal?id=${encodeURIComponent(g.id)}`,
        action_label: "Open the goal",
      });
    }
  }
  for (const g of input.goals) {
    if (g.scheduledThisWeek === 0) {
      push({ code: "GOAL_STARVED", key: g.id, goal_id: g.id, title: `${g.title} has no time this week`, body: "Give this goal at least one block.", action_link: "/plan", action_label: "Schedule a block" });
    }
  }
  for (const g of input.goals) {
    if (g.strength && g.strength.total < THRESHOLDS.weakPlan) {
      const top = g.strength.improvements[0];
      push({
        code: "WEAK_PLAN",
        key: g.id,
        goal_id: g.id,
        title: `${g.title}'s plan is weak (${g.strength.total})`,
        body: top ? top.text : "Strengthen the plan.",
        action_link: top?.link ?? `/goals/goal?id=${encodeURIComponent(g.id)}`,
        action_label: "Improve it",
      });
    }
  }
  if (input.followThrough14 !== null && input.followThrough14 < THRESHOLDS.lowFollowThrough) {
    push({
      code: "LOW_FOLLOW_THROUGH",
      key: input.weekStart,
      title: `Follow-through is ${Math.round(input.followThrough14 * 100)}% over two weeks`,
      body: "Plan fewer or smaller blocks, and protect the ones you keep.",
      action_link: "/plan",
      action_label: "Open Plan",
    });
  }
  const run = input.checkins.slice(0, THRESHOLDS.lowEnergyRun);
  if (run.length === THRESHOLDS.lowEnergyRun && run.every((c) => c.energy !== null && c.energy <= THRESHOLDS.lowEnergy)) {
    push({ code: "LOW_ENERGY", key: run[0].date, title: "Energy has been low three days running", body: "Plan a lighter day: fewer blocks, more buffer, the hardest work in your peak.", action_link: "/plan", action_label: "Lighten tomorrow" });
  }
  const peakTotal = input.peak.goal + input.peak.area;
  if (peakTotal > 0 && input.peak.area / peakTotal > THRESHOLDS.peakMisuse) {
    push({ code: "PEAK_MISUSE", key: input.weekStart, title: "Peak hours are going to area work", body: "Move goal work into your peak window and area tasks out of it.", action_link: "/plan", action_label: "Open Plan" });
  }
  const plannedTotal = input.planned.goal + input.planned.area;
  if (plannedTotal > 0 && input.planned.goal / plannedTotal < THRESHOLDS.lowGoalShare) {
    push({
      code: "LOW_GOAL_SHARE",
      key: input.weekStart,
      title: "Most of the week is going to area work",
      body: `Goal work is ${Math.round((input.planned.goal / plannedTotal) * 100)}% of planned pomodoros. Aim for 30% or more.`,
      action_link: "/plan",
      action_label: "Open Plan",
    });
  }
  for (const a of input.actions) {
    if (a.reschedule_count >= THRESHOLDS.chronicReschedule) {
      push({ code: "CHRONIC_RESCHEDULE", key: a.id, title: `“${a.title}” has moved ${a.reschedule_count} times`, body: "Break it into smaller actions, or drop it.", action_link: "/plan", action_label: "Open the tray" });
    }
  }
  const recent = input.doneActions.slice(0, THRESHOLDS.estimateDriftCount);
  if (recent.length === THRESHOLDS.estimateDriftCount) {
    const ratio = recent.reduce((n, a) => n + a.completed / Math.max(a.estimate, 1), 0) / recent.length;
    if (ratio > THRESHOLDS.estimateDrift) {
      push({ code: "ESTIMATE_DRIFT", key: input.weekStart, title: "Estimates run low", body: `Your last 10 actions took ${Math.round(ratio * 100)}% of their estimates on average. Pad new estimates.`, action_link: null, action_label: null });
    }
  }
  if (input.goals.length > THRESHOLDS.maxGoals) {
    push({ code: "TOO_MANY_GOALS", key: String(input.goals.length), title: `${input.goals.length} goals are active`, body: "Consider pausing one so the others get real time.", action_link: "/goals", action_label: "Open Goals" });
  }
  if (input.followThroughWeek !== null && input.followThroughWeek >= THRESHOLDS.strongWeek) {
    push({ code: "STRONG_WEEK", key: input.weekStart, title: `Strong week: ${Math.round(input.followThroughWeek * 100)}% follow-through`, body: "You are doing what you planned. Keep the plan this honest.", action_link: null, action_label: null });
  }
  return sortInsights(out);
}

export function sortInsights<T extends { code: RuleCode }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => PRIORITY.indexOf(a.code) - PRIORITY.indexOf(b.code));
}

export const messageId = (i: Pick<Insight, "code" | "key">) => `${i.code}:${i.key}`;

export type MessageWrite =
  | { kind: "create"; id: string; row: Omit<CoachMessage, "id" | "created_at" | "updated_at" | "deleted_at" | "_dirty"> }
  | { kind: "update"; id: string; patch: Partial<CoachMessage> };

/**
 * Bring stored messages in line with the current insights. New triggers become `new` messages; a
 * dismissed message stays dismissed until its `valid_until` (dismissal + 7 days) passes; messages
 * whose trigger is gone become `done`.
 */
export function mergeInsights(existing: readonly CoachMessage[], insights: readonly Insight[], now: Instant): MessageWrite[] {
  const writes: MessageWrite[] = [];
  const byId = new Map(existing.map((m) => [m.id, m]));
  const live = new Set<string>();
  for (const i of insights) {
    const id = messageId(i);
    live.add(id);
    const m = byId.get(id);
    const content = { title: i.title, body: i.body, action_link: i.action_link, goal_id: i.goal_id };
    if (!m) {
      writes.push({ kind: "create", id, row: { source: "rule", rule_code: i.code, status: "new", valid_until: null, ...content } });
      continue;
    }
    if (m.deleted_at) {
      writes.push({ kind: "update", id, patch: { deleted_at: null, status: "new", valid_until: null, ...content } });
      continue;
    }
    const held = m.status === "dismissed" && m.valid_until !== null && m.valid_until > now;
    if (held) continue;
    const status = "new" as const;
    if (m.status !== status || m.title !== i.title || m.body !== i.body || m.action_link !== i.action_link) {
      writes.push({ kind: "update", id, patch: { status, valid_until: null, ...content } });
    }
  }
  for (const m of existing) {
    if (m.deleted_at || m.source !== "rule" || live.has(m.id) || m.status !== "new") continue;
    writes.push({ kind: "update", id: m.id, patch: { status: "done" } });
  }
  return writes;
}

/** When a dismissed insight may come back. */
export function dismissedUntil(now: Instant): Instant {
  return new Date(Date.parse(now) + THRESHOLDS.dismissDays * 24 * 60 * 60 * 1000).toISOString();
}

/** The daily brief (§5.18): today's blocks and pomodoros, the first block, the top goal's strength, the top insight. */
export function dailyBrief(input: {
  blocks: number;
  pomodoros: number;
  firstAt: string | null;
  topGoal: { title: string; strength: PlanStrength } | null;
  topInsight: { title: string } | null;
}): string {
  const parts: string[] = [];
  if (input.blocks === 0) parts.push("Nothing scheduled today.");
  else {
    parts.push(`${input.blocks} ${input.blocks === 1 ? "block" : "blocks"}, ${input.pomodoros} ${input.pomodoros === 1 ? "pomodoro" : "pomodoros"} today.`);
    if (input.firstAt) parts.push(`First up at ${input.firstAt}.`);
  }
  if (input.topGoal) parts.push(`${input.topGoal.title} is ${BAND_LABEL[input.topGoal.strength.band]} (${input.topGoal.strength.total}).`);
  if (input.topInsight) parts.push(input.topInsight.title.endsWith(".") ? input.topInsight.title : `${input.topInsight.title}.`);
  return parts.join(" ");
}

/** Principle cards: short prompts in FOQUS's own words. One per day. */
export const PRINCIPLES: readonly string[] = [
  "When ___ happens, I will ___. Write one if-then plan for the moment you usually slip.",
  "The block is the promise. If it moves, move it on purpose, not by drift.",
  "Start with the smallest next step you can finish in one pomodoro.",
  "Protect the peak: your best hours go to the goal that matters most.",
  "A plan you keep beats a plan you admire. Schedule less, finish more.",
  "Decide the night before. The morning is for doing, not choosing.",
  "Name the obstacle before it arrives, and the move you'll make when it does.",
  "Done is a habit. Close one loop today before opening a new one.",
  "If it matters this quarter, it has a block this week.",
  "Energy is a resource. Put hard work where it is high and admin where it is low.",
  "Review, then plan. Last week's numbers are the best guide to next week.",
  "Say no to one thing today so the important thing gets a yes.",
  "Two minutes of setup beats twenty minutes of starting. Open what you need before the timer runs.",
  "When a task keeps moving, it is too big or not yours. Split it or drop it.",
];

export function principleFor(today: DateString): string {
  const n = diffDays("2026-01-01", today);
  return PRINCIPLES[((n % PRINCIPLES.length) + PRINCIPLES.length) % PRINCIPLES.length];
}
