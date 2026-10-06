/**
 * Plan strength (§5.17): a 0–100 score for an active goal's current season plan, in four parts of
 * 25 points, with the improvements that would recover lost points. Pure.
 */
import type { Action, Block, DateString, Goal, Instant, MajorMove, SeasonPlan } from "@/types";
import { diffDays } from "./time";

export type StrengthBand = "weak" | "fair" | "strong";
export const BAND_LABEL: Record<StrengthBand, string> = { weak: "Weak", fair: "Fair", strong: "Strong" };

export function strengthBand(total: number): StrengthBand {
  if (total >= 70) return "strong";
  if (total >= 40) return "fair";
  return "weak";
}

export interface Improvement {
  text: string;
  points: number;
  /** Where it can be fixed. */
  link: string;
}

export interface PlanStrength {
  total: number;
  band: StrengthBand;
  completeness: number;
  moves: number;
  scheduled: number;
  followThrough: number;
  /** "No data yet" (follow-through) and "Add sized actions" (scheduled) hints. */
  noFollowThroughData: boolean;
  noSizedActions: boolean;
  /** Remaining pomodoros of open actions. */
  remaining: number;
  /** Needed and scheduled pomodoros this week. */
  needed: number;
  scheduledPomodoros: number;
  /** Follow-through rate over 14 days, or null with no ended blocks. */
  rate: number | null;
  improvements: Improvement[];
}

export const NO_DATA_FOLLOW_THROUGH = 12;
const DAY = 24 * 60 * 60 * 1000;

export interface StrengthInput {
  goal: Pick<Goal, "id" | "why" | "anti_goals">;
  plan: Pick<SeasonPlan, "outcome" | "metric_target" | "confidence_pct" | "obstacles" | "ends_on" | "season_id">;
  moves: readonly Pick<MajorMove, "id" | "status" | "deleted_at">[];
  /** The goal's actions. */
  actions: readonly Pick<Action, "id" | "status" | "estimate_pomodoros" | "major_move_id" | "deleted_at">[];
  /** Blocks of the goal's actions (any time). */
  blocks: readonly Pick<Block, "action_id" | "status" | "starts_at" | "ends_at" | "planned_pomodoros" | "completed_pomodoros" | "deleted_at">[];
  /** Monday of this week. */
  weekStart: DateString;
  /** The instant this week starts and ends (local Monday 00:00 to next Monday 00:00). */
  weekSpan: { start: number; end: number };
  now: Instant;
}

export function movesPoints(n: number): number {
  if (n === 0) return 0;
  if (n <= 2) return 8;
  if (n <= 5) return 15;
  return 10;
}

export function planStrength(input: StrengthInput): PlanStrength {
  const { goal, plan } = input;
  const nowMs = Date.parse(input.now);
  const improvements: Improvement[] = [];
  const edit = (step: number) => `/goal-setup?goal=${encodeURIComponent(goal.id)}&season=${plan.season_id}&step=${step}&mode=edit`;
  const detail = `/goals/goal?id=${encodeURIComponent(goal.id)}`;

  // Goal completeness (25)
  const outcome = plan.outcome.trim().length > 0;
  const metric = outcome && plan.metric_target !== null;
  let completeness = metric ? 10 : outcome ? 5 : 0;
  if (!outcome) improvements.push({ text: "Write the outcome this goal aims for (+10)", points: 10, link: edit(1) });
  else if (!metric) improvements.push({ text: "Add a measurable target to your outcome (+5)", points: 5, link: edit(1) });
  if (goal.why?.trim()) completeness += 8;
  else improvements.push({ text: "Write why this goal matters (+8)", points: 8, link: edit(2) });
  if (goal.anti_goals.some((a) => a.trim())) completeness += 7;
  else improvements.push({ text: "Name one anti-goal, something you will not do (+7)", points: 7, link: edit(2) });

  // Major moves (25)
  const moves = input.moves.filter((m) => !m.deleted_at);
  const actions = input.actions.filter((a) => !a.deleted_at);
  const countPts = movesPoints(moves.length);
  let movesScore = countPts;
  if (countPts < 15) {
    const gain = 15 - countPts;
    improvements.push({
      text: moves.length > 5 ? `Trim to 5 major moves or fewer (+${gain})` : `Define 3–5 major moves (+${gain})`,
      points: gain,
      link: edit(3),
    });
  }
  const openMoves = moves.filter((m) => m.status === "open");
  const covered = moves.length > 0 && openMoves.every((m) => actions.some((a) => a.major_move_id === m.id && a.status === "todo"));
  if (covered) movesScore += 5;
  else if (moves.length > 0) improvements.push({ text: "Give every open major move at least one action (+5)", points: 5, link: detail });
  const mitigated = plan.obstacles.some((o) => o.obstacle.trim() && o.mitigation.trim());
  if ((plan.confidence_pct ?? 0) >= 80 && mitigated) movesScore += 5;
  else improvements.push({ text: "Reach 80% confidence with a plan for one obstacle (+5)", points: 5, link: edit(4) });

  // Scheduled versus needed (25)
  const goalActionIds = new Set(actions.map((a) => a.id));
  const blocks = input.blocks.filter((b) => !b.deleted_at && goalActionIds.has(b.action_id));
  const completedBy = new Map<string, number>();
  for (const b of blocks) completedBy.set(b.action_id, (completedBy.get(b.action_id) ?? 0) + b.completed_pomodoros);
  const open = actions.filter((a) => a.status === "todo" && a.estimate_pomodoros > 0);
  const remaining = open.reduce((n, a) => n + Math.max(a.estimate_pomodoros - (completedBy.get(a.id) ?? 0), 0), 0);
  const weeksLeft = Math.max(1, Math.floor((diffDays(input.weekStart, plan.ends_on) + 1) / 7));
  const needed = Math.ceil(remaining / weeksLeft);
  const scheduledPomodoros = blocks
    .filter((b) => (b.status === "scheduled" || b.status === "done" || b.status === "active") && inSpan(b.starts_at, input.weekSpan))
    .reduce((n, b) => n + b.planned_pomodoros, 0);
  const noSizedActions = open.length === 0;
  let scheduled = 0;
  if (noSizedActions) improvements.push({ text: "Add sized actions (+25)", points: 25, link: detail });
  else {
    scheduled = needed === 0 ? 25 : Math.min(scheduledPomodoros / needed, 1) * 25;
    const gain = Math.round(25 - scheduled);
    if (gain > 0) {
      improvements.push({
        text: `You need about ${needed} ${needed === 1 ? "pomodoro" : "pomodoros"} this week and ${scheduledPomodoros} ${scheduledPomodoros === 1 ? "is" : "are"} scheduled (+${gain})`,
        points: gain,
        link: "/plan",
      });
    }
  }

  // Follow-through (25)
  const windowStart = nowMs - 14 * DAY;
  let planned = 0;
  let kept = 0;
  for (const b of blocks) {
    if (b.status === "draft") continue;
    const end = Date.parse(b.ends_at);
    if (end > nowMs || end <= windowStart) continue;
    planned += b.planned_pomodoros;
    kept += Math.min(b.completed_pomodoros, b.planned_pomodoros);
  }
  const rate = planned === 0 ? null : kept / planned;
  const followThrough = rate === null ? NO_DATA_FOLLOW_THROUGH : rate * 25;
  if (rate !== null && rate < 1) {
    const gain = Math.round(25 - followThrough);
    if (gain > 0) {
      improvements.push({
        text: `Follow-through is ${Math.round(rate * 100)}% over two weeks. Try smaller blocks (+${gain})`,
        points: gain,
        link: "/plan",
      });
    }
  }

  const parts = [completeness, movesScore, Math.round(scheduled), Math.round(followThrough)];
  const total = parts.reduce((a, b) => a + b, 0);
  improvements.sort((a, b) => b.points - a.points);
  return {
    total,
    band: strengthBand(total),
    completeness,
    moves: movesScore,
    scheduled: Math.round(scheduled),
    followThrough: Math.round(followThrough),
    noFollowThroughData: rate === null,
    noSizedActions,
    remaining,
    needed,
    scheduledPomodoros,
    rate,
    improvements,
  };
}

function inSpan(instant: Instant, span: { start: number; end: number }): boolean {
  const t = Date.parse(instant);
  return t >= span.start && t < span.end;
}
