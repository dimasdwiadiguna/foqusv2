"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useActiveGoals,
  useAreas,
  useBlocksForActions,
  useCapacity,
  useInsights,
  useNow,
  useReview,
  useReviewGoals,
  useRows,
  useStreaks,
  useWeekStats,
  type ReviewSnapshot,
} from "@/data";
import { actionNumbers } from "@/lib/actions";
import { CAPACITY_LABEL, capacityBand } from "@/lib/capacity";
import { planWeekFor } from "@/lib/review";
import { formatShortDate, formatWeekRange } from "@/lib/time";
import { applyWeekPicks, completeReview, prepareNextWeek, REVIEW_STEPS, saveReviewNotes, setReviewStep, startReview } from "@/repo";
import type { Action, WeeklyReview } from "@/types";
import { celebrate } from "@/components/celebration/celebrate";
import { CompassView } from "@/components/coach/CompassView";
import { RepeatIcon } from "@/components/shell/icons";
import { DraftBar, DraftButton, useDraftBlocks } from "@/components/timeline/DraftBar";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { PomodoroDots } from "@/components/ui/PomodoroDots";
import { Numbers } from "./Numbers";

/**
 * The weekly review (§5.15, §6.7 flows): Compass → Numbers → Wins and lessons → Pick actions →
 * Schedule → Done. The step is saved, so it can be left and resumed. Completing it stores a
 * snapshot of the numbers; a completed review always shows that snapshot.
 */
export function ReviewFlow({ week }: { week: string }) {
  const review = useReview(week);
  const started = useRef(false);
  useEffect(() => {
    if (review === null && !started.current) {
      started.current = true;
      void startReview(week);
    }
  }, [review, week]);
  if (!review) return null;
  if (review.completed_at) return <Completed review={review} />;
  return <Flow key={week} week={week} review={review} />;
}

function Flow({ week, review }: { week: string; review: WeeklyReview }) {
  const [step, setStep] = useState(Math.min(review.step, REVIEW_STEPS.length - 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notes = useRef<() => Promise<void>>(async () => {});
  const picks = useRef<() => Promise<void>>(async () => {});
  const next = planWeekFor(week);

  const go = async (to: number) => {
    setBusy(true);
    setError(null);
    try {
      if (step === 2) await notes.current();
      if (step === 3 && to > step) await picks.current();
      if (to >= REVIEW_STEPS.length) {
        await completeReview(week);
        return;
      }
      await setReviewStep(week, to);
      setStep(to);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="shrink-0 px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex min-h-11 items-center justify-between">
          <Link href="/coach" className="-ml-2 flex min-h-11 items-center px-2 text-accent" onClick={() => void notes.current()}>
            Save and exit
          </Link>
          <span className="text-caption text-text-muted">
            Step {step + 1} of {REVIEW_STEPS.length} · {REVIEW_STEPS[step]}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1" role="progressbar" aria-label="Review progress" aria-valuemin={1} aria-valuemax={REVIEW_STEPS.length} aria-valuenow={step + 1}>
          {REVIEW_STEPS.map((s, i) => (
            <span key={s} className={`h-1 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-6">
        <p className="mb-1 text-caption text-text-muted">Week of {formatWeekRange(week)}</p>
        {step === 0 ? (
          <>
            <h1 className="mb-3 text-title">Start from your compass</h1>
            <CompassView editable={false} />
          </>
        ) : null}
        {step === 1 ? <LiveNumbers week={week} /> : null}
        {step === 2 ? <NotesStep review={review} saveRef={notes} /> : null}
        {step === 3 ? <PickStep week={week} next={next} applyRef={picks} /> : null}
        {step === 4 ? <ScheduleStep next={next} /> : null}
        {error ? (
          <p role="alert" className="mt-3 text-caption text-danger">
            {error}
          </p>
        ) : null}
      </main>

      <footer className="flex shrink-0 gap-3 border-t border-border px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {step > 0 ? (
          <Button block disabled={busy} onClick={() => void go(step - 1)}>
            Back
          </Button>
        ) : null}
        <Button variant="primary" block disabled={busy} onClick={() => void go(step + 1)}>
          {step === REVIEW_STEPS.length - 1 ? "Finish review" : "Next"}
        </Button>
      </footer>
    </>
  );
}

function LiveNumbers({ week }: { week: string }) {
  const stats = useWeekStats(week);
  const goals = useReviewGoals();
  const streaks = useStreaks();
  if (!stats || !goals || !streaks) return null;
  return (
    <>
      <h1 className="mb-3 text-title">The numbers</h1>
      <Numbers s={{ ...stats, goals, streaks: { checkin: streaks.checkin.current, focus: streaks.focus.current } }} />
    </>
  );
}

function NotesStep({ review, saveRef }: { review: WeeklyReview; saveRef: React.RefObject<() => Promise<void>> }) {
  const [wins, setWins] = useState(review.wins ?? "");
  const [lessons, setLessons] = useState(review.lessons ?? "");
  const [change, setChange] = useState(review.change_next_week ?? "");
  const insights = (useInsights() ?? []).filter((m) => m.rule_code !== "REVIEW_DUE").slice(0, 3);
  const save = () => saveReviewNotes(review.week_start, { wins, lessons, change_next_week: change });
  useEffect(() => {
    saveRef.current = save;
  });
  const field = (id: string, label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
      </label>
      <textarea id={id} rows={3} value={value} onChange={(e) => set(e.target.value)} onBlur={() => void save()} placeholder={placeholder} className={`${controlClass} resize-none`} />
    </div>
  );
  return (
    <>
      <h1 className="mb-3 text-title">Wins and lessons</h1>
      {field("review-wins", "Wins", wins, setWins, "What went well?")}
      {field("review-lessons", "Lessons", lessons, setLessons, "What did the week teach you?")}
      {field("review-change", "One change for next week", change, setChange, "One thing you will do differently")}
      {insights.length ? (
        <section aria-labelledby="review-insights">
          <h2 id="review-insights" className="mb-1.5 text-caption tracking-wide text-text-muted uppercase">
            From the coach
          </h2>
          <ul className="flex flex-col gap-1.5">
            {insights.map((m) => (
              <li key={m.id} className="rounded-card border border-border bg-surface px-3 py-2">
                <p className="font-semibold">{m.title}</p>
                <p className="text-caption text-text-muted">{m.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/**
 * Step 3: tick next week's actions, per goal in rank order, then per area. Recurring occurrences
 * and unfinished actions from this week ("carried") start ticked. The capacity meter counts the
 * ticked actions' pomodoros on top of next week's blocks.
 */
function PickStep({ week, next, applyRef }: { week: string; next: string; applyRef: React.RefObject<() => Promise<void>> }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void prepareNextWeek(week).then(() => setReady(true));
  }, [week]);
  const actions = useRows("actions");
  const goals = useActiveGoals();
  const areas = useAreas();
  const blocks = useBlocksForActions((actions ?? []).map((a) => a.id));
  const capacity = useCapacity(next);
  const now = useNow(60_000);

  const candidates = useMemo(
    () =>
      (actions ?? []).filter(
        (a) => a.status === "todo" && (a.planned_week === null || a.planned_week === next || (a.planned_week === week && !a.occurrence_date) || (a.planned_week !== null && a.planned_week < week && !a.occurrence_date)),
      ),
    [actions, next, week],
  );
  const [picked, setPicked] = useState<Set<string> | null>(null);
  if (ready && actions && picked === null) {
    setPicked(new Set(candidates.filter((a) => a.planned_week !== null).map((a) => a.id)));
  }
  useEffect(() => {
    applyRef.current = async () => {
      if (picked) await applyWeekPicks(week, [...picked], candidates.map((a) => a.id));
    };
  });

  if (!ready || !actions || !goals || !areas || !blocks || !picked) return null;
  const iso = new Date(now).toISOString();
  const unscheduled = (a: Action) => actionNumbers(a, blocks, iso).unscheduled;
  const groups = [
    ...goals.map((g) => ({ key: g.id, title: g.title, items: candidates.filter((a) => a.goal_id === g.id) })),
    ...areas.map((ar) => ({ key: ar.id, title: ar.name, items: candidates.filter((a) => a.area_id === ar.id) })),
  ]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => Number(Boolean(b.planned_week)) - Number(Boolean(a.planned_week)) || (a.occurrence_date ?? "").localeCompare(b.occurrence_date ?? "") || a.sort_order - b.sort_order) }))
    .filter((g) => g.items.length);

  const extraHours = [...picked].reduce((n, id) => {
    const a = candidates.find((x) => x.id === id);
    return a ? n + unscheduled(a) * 0.5 : n;
  }, 0);
  const planned = (capacity?.plannedHours ?? 0) + extraHours;
  const free = capacity?.freeHours ?? 0;
  const load = free ? planned / free : planned > 0 ? Infinity : 0;
  const band = capacityBand(load);

  return (
    <>
      <h1 className="mb-1 text-title">Next week&apos;s actions</h1>
      <p className="mb-3 text-text-muted">Tick what goes on the list for {formatWeekRange(next)}. Unticked actions wait in the backlog.</p>
      {groups.map((g) => (
        <fieldset key={g.key} className="mb-4">
          <legend className="mb-1 text-caption tracking-wide text-text-muted uppercase">{g.title}</legend>
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {g.items.map((a) => {
              const on = picked.has(a.id);
              const carried = a.planned_week !== null && a.planned_week < next && !a.occurrence_date;
              return (
                <li key={a.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const s = new Set(picked);
                        if (on) s.delete(a.id);
                        else s.add(a.id);
                        setPicked(s);
                      }}
                      className="size-5 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {a.recurrence_rule_id ? <RepeatIcon className="size-3.5 shrink-0 text-text-muted" /> : null}
                        <span className="truncate">{a.title}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 text-caption text-text-muted">
                        <PomodoroDots completed={0} total={Math.max(unscheduled(a), 1)} decorative className="text-accent" />
                        {a.occurrence_date ? <span>{formatShortDate(a.occurrence_date)}</span> : null}
                        {carried ? <span className="rounded-full border border-border px-2">carried</span> : null}
                        {a.planned_week === null ? <span>backlog</span> : null}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      {groups.length === 0 ? <p className="text-text-muted">No open actions. Add some from Goals, or with + on Today.</p> : null}
      <div className="sticky -bottom-6 -mx-4 border-t border-border bg-surface px-4 py-2" role="status">
        <p className="flex justify-between text-caption">
          <span>
            {Math.round(planned * 10) / 10} h planned of {free} h free
          </span>
          <span className={`font-semibold ${band === "room" ? "text-success" : band === "full" ? "text-warning" : "text-danger"}`}>
            {Number.isFinite(load) ? `${Math.round(load * 100)}%` : "—"} · {CAPACITY_LABEL[band]}
          </span>
        </p>
      </div>
    </>
  );
}

/** Step 4: "Draft my week" or "I'll place them myself" (Finish review). */
function ScheduleStep({ next }: { next: string }) {
  const drafts = useDraftBlocks(next);
  const list = useRows("actions");
  const items = (list ?? []).filter((a) => a.planned_week === next && a.status === "todo").length;
  return (
    <>
      <h1 className="mb-1 text-title">Schedule next week</h1>
      <p className="mb-4 text-text-muted">
        Let FOQUS draft {formatWeekRange(next)} from the list, then adjust and commit. Or finish now and place the blocks yourself in Plan.
      </p>
      {drafts && drafts.length > 0 ? (
        <div className="overflow-hidden rounded-card border border-border">
          <DraftBar weekStart={next} drafted={drafts.length} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <DraftButton weekStart={next} unscheduled={items} />
          <p className="text-caption text-text-muted">“Finish review” below means you&apos;ll place them yourself.</p>
        </div>
      )}
    </>
  );
}

/** A completed review: the stored snapshot, notes, and (right after finishing) a summary card with confetti. */
function Completed({ review }: { review: WeeklyReview }) {
  const router = useRouter();
  const s = review.stats as ReviewSnapshot | null;
  // Just finished (within the last minute): the summary card with confetti.
  const [fresh] = useState(() => review.completed_at !== null && Date.now() - Date.parse(review.completed_at) < 60_000);
  useEffect(() => {
    if (fresh) void celebrate("day");
  }, [fresh]);
  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-[max(env(safe-area-inset-top),16px)] pb-6">
        <p className="text-caption text-text-muted">Week of {formatWeekRange(review.week_start)}</p>
        <h1 className="mb-3 text-title">{fresh ? "Review done" : "Weekly review"}</h1>
        {s ? (
          <section aria-label="Summary" className={`mb-4 rounded-card border border-success/60 bg-surface px-3 py-3 ${fresh ? "animate-moment" : ""}`}>
            <p className="text-heading">
              {s.follow_through === null ? "No blocks ended" : `${Math.round(s.follow_through * 100)}% follow-through`} · {s.completed} pomodoros
            </p>
            <p className="text-caption text-text-muted">
              Goal share {s.goal_share === null ? "—" : `${Math.round(s.goal_share * 100)}%`} · {s.streaks.checkin}-day check-in streak
            </p>
          </section>
        ) : null}
        {review.wins || review.lessons || review.change_next_week ? (
          <dl className="mb-4 flex flex-col gap-2">
            {[
              ["Wins", review.wins],
              ["Lessons", review.lessons],
              ["One change", review.change_next_week],
            ].map(([k, v]) =>
              v ? (
                <div key={k} className="rounded-card border border-border bg-surface px-3 py-2">
                  <dt className="text-caption text-text-muted">{k}</dt>
                  <dd className="whitespace-pre-wrap">{v}</dd>
                </div>
              ) : null,
            )}
          </dl>
        ) : null}
        {s ? <Numbers s={s} /> : null}
      </main>
      <footer className="shrink-0 border-t border-border px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <Button variant="primary" block onClick={() => router.push(fresh ? "/plan" : "/coach/reviews")}>
          {fresh ? "Done" : "Back"}
        </Button>
      </footer>
    </>
  );
}
