/**
 * Numbers for the weekly review (§5.15) and the coach (§5.18). Pure: blocks, actions, and check-ins
 * come in; plain numbers come out.
 */
import type { Action, Block, DailyCheckin, DateString, Instant } from "@/types";
import { windowSpan, type DayWindow } from "./availability";
import { plannedBlocks } from "./checkin";
import { toLocalDate, weekdayOf } from "./time";
import type { Weekday } from "@/types";

type StatBlock = Pick<Block, "action_id" | "status" | "resolution" | "starts_at" | "ends_at" | "planned_pomodoros" | "completed_pomodoros" | "deleted_at">;

/** Σ min(completed, planned) ÷ Σ planned over non-draft blocks that ended in (from, to]; null with none. */
export function followThrough(blocks: readonly StatBlock[], from: number, to: number): number | null {
  let planned = 0;
  let kept = 0;
  for (const b of blocks) {
    if (b.deleted_at || b.status === "draft") continue;
    const end = Date.parse(b.ends_at);
    if (end <= from || end > to) continue;
    planned += b.planned_pomodoros;
    kept += Math.min(b.completed_pomodoros, b.planned_pomodoros);
  }
  return planned === 0 ? null : kept / planned;
}

export interface HoursRow {
  /** `goal:<id>` or `area:<id>`. */
  key: string;
  label: string;
  color: string;
  kind: "goal" | "area";
  hours: number;
}

export interface WeekStats {
  week_start: DateString;
  completed: number;
  planned: number;
  /** 0–1, or null when no block has ended. */
  follow_through: number | null;
  /** Goal pomodoros ÷ all completed, 0–1, or null when nothing was completed. */
  goal_share: number | null;
  hours: HoursRow[];
  avg_energy: number | null;
  avg_focus: number | null;
  rescheduled: number;
  dropped: number;
}

export const TARGET_GOAL_SHARE = 0.3;
export const TARGET_FOLLOW_THROUGH = 0.7;

export function weekStats(input: {
  weekStart: DateString;
  /** The week's local dates, Monday first. */
  days: readonly DateString[];
  timeZone: string;
  now: Instant;
  /** Blocks around the week; only those starting on its days count. */
  blocks: readonly StatBlock[];
  actions: readonly Pick<Action, "id" | "goal_id" | "area_id">[];
  owners: (key: string) => { label: string; color: string } | undefined;
  checkins: readonly Pick<DailyCheckin, "date" | "energy" | "focus" | "completed_at" | "deleted_at">[];
  focusMinutes: number;
}): WeekStats {
  const days = new Set(input.days);
  const blocks = input.blocks.filter((b) => !b.deleted_at && days.has(toLocalDate(b.starts_at, input.timeZone)));
  const byId = new Map(input.actions.map((a) => [a.id, a]));
  const plan = plannedBlocks(blocks);
  const completed = plan.reduce((n, b) => n + b.completed_pomodoros, 0);
  const planned = plan.reduce((n, b) => n + b.planned_pomodoros, 0);
  let goalDone = 0;
  const hours = new Map<string, number>();
  for (const b of plan) {
    if (b.completed_pomodoros === 0) continue;
    const a = byId.get(b.action_id);
    const key = a?.goal_id ? `goal:${a.goal_id}` : `area:${a?.area_id ?? "unknown"}`;
    if (a?.goal_id) goalDone += b.completed_pomodoros;
    hours.set(key, (hours.get(key) ?? 0) + b.completed_pomodoros);
  }
  const checkins = input.checkins.filter((c) => !c.deleted_at && c.completed_at && days.has(c.date));
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  return {
    week_start: input.weekStart,
    completed,
    planned,
    follow_through: followThrough(blocks, Number.MIN_SAFE_INTEGER, Date.parse(input.now)),
    goal_share: completed ? goalDone / completed : null,
    hours: [...hours.entries()]
      .map(([key, n]) => {
        const o = input.owners(key);
        return {
          key,
          label: o?.label ?? "Removed",
          color: o?.color ?? "#9AA3B2",
          kind: key.startsWith("goal:") ? ("goal" as const) : ("area" as const),
          hours: Math.round(((n * input.focusMinutes) / 60) * 10) / 10,
        };
      })
      .sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label)),
    avg_energy: avg(checkins.map((c) => c.energy)),
    avg_focus: avg(checkins.map((c) => c.focus)),
    rescheduled: blocks.filter((b) => b.status === "missed" && b.resolution === "rescheduled").length,
    dropped: blocks.filter((b) => b.status === "missed" && b.resolution === "dropped").length,
  };
}

/**
 * Pomodoros placed in the peak window this week, split into goal work and area tasks (for
 * `PEAK_MISUSE`). A block counts as peak when it starts inside the day's peak window.
 */
export function peakSplit(
  blocks: readonly StatBlock[],
  peak: (weekday: Weekday) => DayWindow | undefined,
  goalActionIds: ReadonlySet<string>,
  timeZone: string,
): { goal: number; area: number } {
  const out = { goal: 0, area: 0 };
  for (const b of blocks) {
    if (b.deleted_at || b.status === "draft" || b.status === "missed") continue;
    const date = toLocalDate(b.starts_at, timeZone);
    const span = windowSpan(date, peak(weekdayOf(date)), timeZone);
    const t = Date.parse(b.starts_at);
    if (!span || t < span.start || t >= span.end) continue;
    if (goalActionIds.has(b.action_id)) out.goal += b.planned_pomodoros;
    else out.area += b.planned_pomodoros;
  }
  return out;
}
