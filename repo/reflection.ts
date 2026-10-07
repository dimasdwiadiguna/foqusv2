/**
 * Compass, the weekly review (§5.15), plan-strength snapshots (§5.17), and coach messages (§5.18).
 */
import { getDb } from "@/db";
import { getCoachInput, getReviewGoals, getReviewHabits, getStrengths, getWeekStats } from "@/data/coach";
import { getSettings } from "@/data/queries";
import { dismissedUntil, evaluateRules, mergeInsights } from "@/lib/coach";
import { COMPASS_ID } from "@/lib/ids";
import { planWeekFor } from "@/lib/review";
import { getStreaks } from "@/data/queries";
import { todayIn } from "@/lib/time";
import type { Compass, DateString, TableName, WeeklyReview } from "@/types";
import { nowInstant } from "./clock";
import { generateOccurrences } from "./recurrence";
import { createRow, updateRow } from "./rows";
import { ALL_TABLES, writeTx } from "./tx";

// ---------------------------------------------------------------------------
// Compass

const MAX_VISION = 2000;
const MAX_VALUES = 10;

export async function saveCompass(input: { vision: string | null; values: string[] }): Promise<Compass> {
  const vision = input.vision?.trim() || null;
  if (vision && vision.length > MAX_VISION) throw new Error(`The vision is limited to ${MAX_VISION} characters.`);
  const values = [...new Set(input.values.map((v) => v.trim()).filter(Boolean))];
  if (values.length > MAX_VALUES) throw new Error(`Keep it to ${MAX_VALUES} values or fewer.`);
  return writeTx(["compass"], async () => {
    const current = await getDb().t("compass").get(COMPASS_ID);
    if (!current) return createRow("compass", { id: COMPASS_ID, vision, values });
    if (current.deleted_at) {
      const revived = { ...current, vision, values, deleted_at: null, updated_at: nowInstant(), _dirty: 1 as const };
      await getDb().t("compass").put(revived);
      return revived;
    }
    return updateRow("compass", COMPASS_ID, { vision, values });
  });
}

// ---------------------------------------------------------------------------
// Weekly review

export const REVIEW_STEPS = ["Compass", "Numbers", "Wins and lessons", "Pick actions", "Schedule"] as const;

async function reviewRow(week: DateString): Promise<WeeklyReview> {
  const t = getDb().t("weekly_reviews");
  const current = await t.get(week);
  if (current && !current.deleted_at) return current;
  if (current) {
    const revived = { ...current, deleted_at: null, step: 0, completed_at: null, stats: null, updated_at: nowInstant(), _dirty: 1 as const };
    await t.put(revived);
    return revived;
  }
  return createRow("weekly_reviews", { id: week, week_start: week, wins: null, lessons: null, change_next_week: null, stats: null, step: 0, completed_at: null });
}

/** Open (or resume) the review of `week`. */
export async function startReview(week: DateString): Promise<WeeklyReview> {
  return writeTx(["weekly_reviews"], () => reviewRow(week));
}

/** Remember the step reached, so the review resumes there. */
export async function setReviewStep(week: DateString, step: number): Promise<void> {
  await writeTx(["weekly_reviews"], async () => {
    const r = await reviewRow(week);
    if (!r.completed_at && r.step !== step) await updateRow("weekly_reviews", week, { step });
  });
}

export async function saveReviewNotes(week: DateString, notes: Partial<Pick<WeeklyReview, "wins" | "lessons" | "change_next_week">>): Promise<void> {
  const clean: Partial<WeeklyReview> = {};
  for (const [k, v] of Object.entries(notes) as [keyof typeof notes, string | null][]) {
    const t = v?.trim() ?? "";
    if (t.length > 2000) throw new Error("Keep each note under 2000 characters.");
    clean[k] = t || null;
  }
  await writeTx(["weekly_reviews"], async () => {
    await reviewRow(week);
    await updateRow("weekly_reviews", week, clean);
  });
}

/**
 * Step 3: make sure next week's recurring occurrences exist (pre-selected), so the pick list can
 * show them. Safe to call again.
 */
export async function prepareNextWeek(week: DateString): Promise<void> {
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  const next = planWeekFor(week);
  const today = todayIn(nowInstant(), settings.timezone);
  await generateOccurrences(next, today > next ? today : next);
}

/**
 * Step 3: the ticked actions form next week's list. Unticked actions that were on this week's or
 * next week's list go back to the backlog; unticked recurring occurrences of next week are dropped
 * (they are tied to their week).
 */
export async function applyWeekPicks(week: DateString, picked: readonly string[], candidates: readonly string[]): Promise<void> {
  const next = planWeekFor(week);
  const chosen = new Set(picked);
  await writeTx(ALL_TABLES, async () => {
    for (const id of candidates) {
      const a = await getDb().t("actions").get(id);
      if (!a || a.deleted_at || a.status !== "todo") continue;
      if (chosen.has(id)) {
        if (a.planned_week !== next && !a.occurrence_date) await updateRow("actions", id, { planned_week: next });
      } else if (a.occurrence_date) {
        if (a.planned_week === next) await updateRow("actions", id, { status: "dropped" });
      } else if (a.planned_week === week || a.planned_week === next) {
        await updateRow("actions", id, { planned_week: null });
      }
    }
  });
}

/**
 * Finish the review: store a snapshot of the numbers (so the week's review never changes later)
 * and mark it complete. The coach and snapshots refresh afterwards.
 */
export async function completeReview(week: DateString): Promise<WeeklyReview> {
  const now = Date.parse(nowInstant());
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  const stats = await getWeekStats(week, now);
  const goals = await getReviewGoals(now);
  const habits = await getReviewHabits(week, now);
  const streaks = await getStreaks(todayIn(now, settings.timezone), settings.timezone);
  const row = await writeTx(["weekly_reviews"], async () => {
    const r = await reviewRow(week);
    if (r.completed_at) return r;
    return updateRow("weekly_reviews", week, {
      stats: { ...stats, goals, habits, streaks: { checkin: streaks.checkin.current, focus: streaks.focus.current } },
      completed_at: nowInstant(),
      step: REVIEW_STEPS.length,
    });
  });
  await refreshCoach();
  return row;
}

// ---------------------------------------------------------------------------
// Plan-strength snapshots and the coach

const COACH_TABLES: TableName[] = ["coach_messages", "plan_strength_snapshots"];

/**
 * Recompute plan strength and the coach's insights (§5.17, §5.18): on app open and after each
 * check-in or review. This week's snapshot per goal is updated in place (one per week).
 */
export async function refreshCoach(nowMs = Date.parse(nowInstant())): Promise<void> {
  const settings = await getSettings();
  if (!settings) return;
  const strengths = await getStrengths(nowMs);
  const input = await getCoachInput(nowMs, strengths);
  if (!input) return;
  const insights = evaluateRules(input);
  const now = new Date(nowMs).toISOString();
  await writeTx(COACH_TABLES, async () => {
    for (const { plan, strength } of strengths) {
      const id = `${plan.id}:${input.weekStart}`;
      const row = { season_plan_id: plan.id, week_start: input.weekStart, total: strength.total, completeness: strength.completeness, moves: strength.moves, scheduled: strength.scheduled, follow_through: strength.followThrough };
      const current = await getDb().t("plan_strength_snapshots").get(id);
      if (!current) await createRow("plan_strength_snapshots", { id, ...row });
      else if (current.deleted_at) await getDb().t("plan_strength_snapshots").put({ ...current, ...row, deleted_at: null, updated_at: now, _dirty: 1 as const });
      else if (current.total !== row.total || current.completeness !== row.completeness || current.moves !== row.moves || current.scheduled !== row.scheduled || current.follow_through !== row.follow_through) {
        await updateRow("plan_strength_snapshots", id, row);
      }
    }
    const existing = await getDb().t("coach_messages").toArray();
    for (const w of mergeInsights(existing, insights, now)) {
      if (w.kind === "create") await createRow("coach_messages", { id: w.id, ...w.row });
      else {
        const m = existing.find((x) => x.id === w.id)!;
        if (m.deleted_at) await getDb().t("coach_messages").put({ ...m, ...w.patch, updated_at: now, _dirty: 1 as const });
        else await updateRow("coach_messages", w.id, w.patch);
      }
    }
  });
}

/** Dismiss an insight: it stays away for 7 days for the same trigger. */
export async function dismissInsight(id: string): Promise<void> {
  await updateRow("coach_messages", id, { status: "dismissed", valid_until: dismissedUntil(nowInstant()) });
}
