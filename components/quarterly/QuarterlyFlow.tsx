"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActionsForGoal, useBlocksForActions, useGoalsInSeason, useNow, useSeason, useSeasonStats, useSettings } from "@/data";
import type { GoalWithPlan } from "@/data";
import { achievementNumbers, goalStats } from "@/lib/goals";
import { splitSeasonNote } from "@/lib/quarterly";
import { formatSeason, shiftSeason } from "@/lib/time";
import { achieveGoal, carryOverGoal, dropGoal, finishQuarterlyReview, saveSeasonNote } from "@/repo";
import { celebrate } from "@/components/celebration/celebrate";
import { showMoment } from "@/components/celebration/Moments";
import { CompassView } from "@/components/coach/CompassView";
import { Button } from "@/components/ui/Button";
import { controlClass, TextArea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";

/**
 * The quarterly review (§5.16): Compass (editable in place) → Season numbers → one screen per goal
 * (carry over, close, or drop) → Season note → Next season → Done. Every goal decision is saved as
 * it is made; the step is remembered on this device, so the review can be left and resumed. It
 * cannot finish until every active goal is resolved.
 */
type Step = { kind: "compass" } | { kind: "numbers" } | { kind: "goal"; goalId: string } | { kind: "note" } | { kind: "next" };

const stepKey = (season: string) => `foqus.quarterly.${season}`;

export function QuarterlyFlow({ season }: { season: string }) {
  const rows = useGoalsInSeason(season);
  const seasonRow = useSeason(season);
  const [goalIds, setGoalIds] = useState<string[] | null>(null);
  // The goal screens are fixed when the flow opens, so a goal stays on screen once resolved.
  if (rows && goalIds === null) setGoalIds(rows.map((r) => r.goal.id));
  if (!rows || !goalIds || seasonRow === undefined) return null;
  if (seasonRow?.reviewed_at) return <Done season={season} />;
  const steps: Step[] = [{ kind: "compass" }, { kind: "numbers" }, ...goalIds.map((goalId) => ({ kind: "goal" as const, goalId })), { kind: "note" }, { kind: "next" }];
  return <Flow season={season} steps={steps} rows={rows} note={seasonRow?.review_note ?? null} />;
}

function Flow({ season, steps, rows, note }: { season: string; steps: Step[]; rows: GoalWithPlan[]; note: string | null }) {
  const [index, setIndex] = useState(() => {
    try {
      return Math.min(Number(localStorage.getItem(stepKey(season)) ?? 0) || 0, steps.length - 1);
    } catch {
      return 0;
    }
  });
  const [notes, setNotes] = useState(() => splitSeasonNote(note));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const step = steps[index];
  const next = shiftSeason(season, 1);

  useEffect(() => {
    try {
      localStorage.setItem(stepKey(season), String(index));
    } catch {
      // Without storage the review restarts at the first screen; decisions are saved anyway.
    }
  }, [index, season]);

  const current = step.kind === "goal" ? rows.find((r) => r.goal.id === step.goalId) : undefined;
  const unresolved = (r: GoalWithPlan | undefined) => Boolean(r && r.goal.status === "active" && r.plan.resolution === null);
  const blocked = step.kind === "goal" && unresolved(current);

  const go = async (to: number) => {
    setError(null);
    setBusy(true);
    try {
      if (step.kind === "note") await saveSeasonNote(season, notes.worked, notes.change);
      if (to >= steps.length) {
        await finishQuarterlyReview(season);
        try {
          localStorage.removeItem(stepKey(season));
        } catch {
          // Nothing to clean up.
        }
        return;
      }
      setIndex(to);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const label = step.kind === "compass" ? "Compass" : step.kind === "numbers" ? "Season numbers" : step.kind === "goal" ? "Goals" : step.kind === "note" ? "Season note" : "Next season";
  return (
    <>
      <header className="shrink-0 px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex min-h-11 items-center justify-between">
          <Link href="/coach" className="-ml-2 flex min-h-11 items-center px-2 text-accent">
            Save and exit
          </Link>
          <span className="text-caption text-text-muted">
            {formatSeason(season)} · {index + 1} of {steps.length} · {label}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-label="Quarterly review progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>
          <div className="h-full bg-accent" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-6">
        {step.kind === "compass" ? (
          <>
            <h1 className="mb-1 text-title">Start from your compass</h1>
            <p className="mb-4 text-text-muted">Edit it in place if the quarter changed how you see it.</p>
            <CompassView />
          </>
        ) : null}
        {step.kind === "numbers" ? <SeasonNumbers season={season} /> : null}
        {step.kind === "goal" && current ? <GoalStep key={current.goal.id} row={current} season={season} /> : null}
        {step.kind === "goal" && !current ? <p className="text-text-muted">This goal no longer exists.</p> : null}
        {step.kind === "note" ? (
          <>
            <h1 className="mb-4 text-title">Season note</h1>
            <TextArea id="season-worked" label="What worked" value={notes.worked} onChange={(e) => setNotes({ ...notes, worked: e.target.value })} rows={4} />
            <TextArea id="season-change" label="What to change" value={notes.change} onChange={(e) => setNotes({ ...notes, change: e.target.value })} rows={4} />
          </>
        ) : null}
        {step.kind === "next" ? <NextSeason season={next} /> : null}
        {error ? (
          <p role="alert" className="mt-3 text-caption text-danger">
            {error}
          </p>
        ) : null}
      </main>

      <footer className="flex shrink-0 gap-3 border-t border-border px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {index > 0 ? (
          <Button block disabled={busy} onClick={() => void go(index - 1)}>
            Back
          </Button>
        ) : null}
        <Button variant="primary" block disabled={busy || blocked} onClick={() => void go(index + 1)}>
          {index === steps.length - 1 ? "Finish review" : blocked ? "Choose one above" : "Next"}
        </Button>
      </footer>
    </>
  );
}

function SeasonNumbers({ season }: { season: string }) {
  const s = useSeasonStats(season);
  if (!s) return null;
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
  return (
    <>
      <h1 className="mb-3 text-title">{formatSeason(season)} in numbers</h1>
      <dl className="grid grid-cols-2 gap-2">
        {[
          ["Pomodoros", String(s.completed)],
          ["Goal share", pct(s.goal_share)],
          ["Follow-through", pct(s.follow_through)],
          ["Goals achieved", `${s.achieved} of ${s.goals}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card border border-border bg-surface px-3 py-2">
            <dt className="text-caption text-text-muted">{k}</dt>
            <dd className="text-title tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {s.hours.length ? (
        <ul className="mt-3 flex flex-col gap-1.5 rounded-card border border-border bg-surface px-3 py-2">
          {s.hours.slice(0, 8).map((h) => (
            <li key={h.key} className="flex justify-between text-caption">
              <span className="truncate">{h.label}</span>
              <span className="tabular-nums">{h.hours} h</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** One goal: carry over, close (achieved, with the celebration), or drop. */
function GoalStep({ row, season }: { row: GoalWithPlan; season: string }) {
  const { goal, plan } = row;
  const actions = useActionsForGoal(goal.id) ?? [];
  const blocks = useBlocksForActions(actions.map((a) => a.id)) ?? [];
  const settings = useSettings();
  const now = useNow();
  const [dropping, setDropping] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const next = shiftSeason(season, 1);
  const stats = goalStats(blocks, new Date(now).toISOString(), settings?.focus_minutes);
  const open = actions.filter((a) => a.status === "todo").length;
  const resolution = goal.status === "achieved" ? "achieved" : goal.status === "dropped" ? "dropped" : plan.resolution;

  const run = (fn: () => Promise<unknown>) => async () => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    }
  };

  return (
    <>
      <p className="text-caption text-text-muted">Goal</p>
      <h1 className="mb-1 text-title">{goal.title}</h1>
      <p className="mb-3 text-text-muted">{plan.outcome}</p>
      <dl className="mb-4 grid grid-cols-3 gap-2">
        {[
          [plan.metric_label ?? "Metric", plan.metric_target !== null ? `${plan.metric_current ?? 0}/${plan.metric_target}` : "—"],
          ["Pomodoros", String(stats.pomodoros)],
          ["Open actions", String(open)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card border border-border bg-surface px-2 py-2">
            <dt className="truncate text-caption text-text-muted">{k}</dt>
            <dd className="text-heading tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {resolution ? (
        <div className="rounded-card border border-success/60 bg-surface px-3 py-3">
          <p className="font-semibold">
            {resolution === "carried" ? `Carried over to ${formatSeason(next)}` : resolution === "achieved" ? "Closed as achieved" : "Dropped"}
          </p>
          {resolution === "carried" ? (
            <Link href={`/goal-setup?goal=${encodeURIComponent(goal.id)}&season=${next}&step=3&mode=edit`} className="mt-1 inline-flex min-h-11 items-center text-accent">
              Review the {formatSeason(next)} plan ›
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button variant="primary" className="min-h-14 text-heading" onClick={run(() => carryOverGoal(goal.id, season))}>
            Carry over to {formatSeason(next)}
          </Button>
          <p className="-mt-2 text-caption text-text-muted">A new plan for next quarter, pre-filled; unfinished moves and open actions come along.</p>
          <Button
            className="min-h-14 text-heading"
            onClick={run(async () => {
              await achieveGoal(goal.id);
              showMoment({ eyebrow: "Goal achieved", headline: goal.title, numbers: achievementNumbers(plan, actions, stats), line: "You set it, planned it, and did it." });
            })}
          >
            Close as achieved
          </Button>
          <Button variant="danger" className="min-h-14 text-heading" onClick={() => setDropping(true)}>
            Drop
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
      <Sheet
        open={dropping}
        onClose={() => setDropping(false)}
        title={`Drop "${goal.title}"?`}
        footer={
          <div className="flex gap-3">
            <Button block onClick={() => setDropping(false)}>
              Keep it
            </Button>
            <Button
              block
              variant="danger"
              onClick={run(async () => {
                await dropGoal(goal.id, reason);
                setDropping(false);
              })}
            >
              Drop goal
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-text-muted">Its open actions are dropped and their future blocks removed. Done work stays in your history.</p>
        <label htmlFor="q-drop-reason" className="mb-1 block text-caption text-text-muted">
          Reason (optional)
        </label>
        <textarea id="q-drop-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${controlClass} resize-none`} />
      </Sheet>
    </>
  );
}

function NextSeason({ season }: { season: string }) {
  const rows = useGoalsInSeason(season) ?? [];
  return (
    <>
      <h1 className="mb-1 text-title">{formatSeason(season)}</h1>
      <p className="mb-4 text-text-muted">Carried goals are here already. Add new ones with the goal wizard.</p>
      {rows.length ? (
        <ul className="mb-4 divide-y divide-border rounded-card border border-border bg-surface">
          {rows.map((r) => (
            <li key={r.goal.id} className="px-3 py-2">
              {r.goal.title}
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={`/goal-setup?season=${season}`} className="flex min-h-11 items-center justify-center rounded-full border border-dashed border-border text-text-muted">
        Add a goal for {formatSeason(season)}
      </Link>
    </>
  );
}

function Done({ season }: { season: string }) {
  const router = useRouter();
  const seasonRow = useSeason(season);
  const [fresh] = useState(() => (seasonRow?.reviewed_at ? Date.now() - Date.parse(seasonRow.reviewed_at) < 60_000 : false));
  useEffect(() => {
    if (fresh) void celebrate("moment");
  }, [fresh]);
  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col justify-center px-4 text-center">
        <p className="text-caption font-semibold tracking-wide text-accent uppercase">Quarterly review</p>
        <h1 className="mt-2 text-title">{formatSeason(season)} is closed</h1>
        <p className="mt-2 text-text-muted">On to {formatSeason(shiftSeason(season, 1))}.</p>
      </main>
      <footer className="shrink-0 border-t border-border px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <Button variant="primary" block onClick={() => router.push(`/goals?season=${shiftSeason(season, 1)}`)}>
          See next season&apos;s goals
        </Button>
      </footer>
    </>
  );
}
