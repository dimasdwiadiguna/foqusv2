"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getStreaks, useAreas, useBlocksForDays, useCheckin, usePersonalBlocks, useRows, useSettings, useStreaks, useToday, useUnresolvedBlocks } from "@/data";
import { closingLine, dayNumbers, isCheckinEditable, NOTE_MAX } from "@/lib/checkin";
import { milestoneReached } from "@/lib/streaks";
import { addDays, formatDayHeader, toLocalDate, toLocalTime, weekdayOf } from "@/lib/time";
import { completeCheckin, saveCheckin } from "@/repo";
import type { DailyCheckin, Settings } from "@/types";
import { milestoneMoment, showMoment } from "@/components/celebration/Moments";
import { BlockCard } from "@/components/resolver/Resolver";
import { Button } from "@/components/ui/Button";
import { PomodoroDots } from "@/components/ui/PomodoroDots";

type Step = "resolve" | "rate" | "note" | "tomorrow" | "close";
const LABELS: Record<Step, string> = { resolve: "Resolve", rate: "Rate", note: "Note", tomorrow: "Tomorrow", close: "Close" };

/**
 * The daily check-in (§5.14, §6.7 flows): Resolve → Rate → Note → Tomorrow → Close. Ratings and
 * the note save as the owner goes, so leaving midway keeps them; reaching Close completes it.
 */
export function CheckinFlow({ date, startAt }: { date: string; startAt?: Step }) {
  const settings = useSettings();
  const today = useToday();
  const checkin = useCheckin(date);
  const unresolved = useUnresolvedBlocks();
  if (!settings || !today || checkin === undefined || !unresolved) return null;
  if (!isCheckinEditable(date, today)) return <Closed date={date} />;
  const dayUnresolved = unresolved.filter((b) => toLocalDate(b.starts_at, settings.timezone) === date);
  return <Flow date={date} settings={settings} checkin={checkin} hasUnresolved={dayUnresolved.length > 0} startAt={startAt} />;
}

function Closed({ date }: { date: string }) {
  return (
    <div className="p-4 pt-16 text-center">
      <p className="text-heading">The check-in for {formatDayHeader(date)} is closed.</p>
      <p className="mt-1 text-text-muted">A check-in can be changed until the end of the next day.</p>
      <Link href="/coach/checkins" className="mt-4 inline-flex min-h-11 items-center text-accent">
        See past check-ins
      </Link>
    </div>
  );
}

function Flow({
  date,
  settings,
  checkin,
  hasUnresolved,
  startAt,
}: {
  date: string;
  settings: Settings;
  checkin: DailyCheckin | null;
  hasUnresolved: boolean;
  startAt?: Step;
}) {
  const router = useRouter();
  // The steps are fixed when the flow opens: Resolve only when the day had unresolved blocks.
  const [steps] = useState<Step[]>(() => (hasUnresolved ? ["resolve", "rate", "note", "tomorrow", "close"] : ["rate", "note", "tomorrow", "close"]));
  const [step, setStep] = useState<Step>(() => (startAt && steps.includes(startAt) && startAt !== "close" ? startAt : steps[0]));
  const [energy, setEnergy] = useState<number | null>(checkin?.energy ?? null);
  const [focus, setFocus] = useState<number | null>(checkin?.focus ?? null);
  const [note, setNote] = useState(checkin?.note ?? "");
  const [result, setResult] = useState<{ first: boolean; before: number; after: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streaks = useStreaks();
  const unresolved = useUnresolvedBlocks();
  const left = (unresolved ?? []).filter((b) => toLocalDate(b.starts_at, settings.timezone) === date).length;
  const index = steps.indexOf(step);
  const exitHref = "/today";

  const save = async (input: Parameters<typeof saveCheckin>[1]) => {
    setError(null);
    try {
      await saveCheckin(date, input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    }
  };

  const finish = async () => {
    if (!streaks) return;
    setBusy(true);
    setError(null);
    try {
      const before = streaks.checkin.current;
      const first = await completeCheckin(date, { energy, focus, note });
      const after = (await getStreaks(toLocalDate(Date.now(), settings.timezone), settings.timezone)).checkin.current;
      setResult({ first, before, after });
      setStep("close");
      const m = first ? milestoneReached(before, after) : null;
      if (m) showMoment(milestoneMoment("check-in", m));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (step === "note") await save({ note });
    if (step === "tomorrow") return finish();
    setStep(steps[index + 1]);
  };

  const canNext = step === "rate" ? energy !== null && focus !== null : true;

  return (
    <>
      <header className="shrink-0 px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex min-h-11 items-center justify-between">
          {step === "close" ? (
            <span />
          ) : (
            <Link href={exitHref} className="-ml-2 flex min-h-11 items-center px-2 text-accent">
              Save and exit
            </Link>
          )}
          <span className="text-caption text-text-muted">
            {formatDayHeader(date)} · {LABELS[step]}
          </span>
        </div>
        <div
          className="mt-2 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          role="progressbar"
          aria-label="Check-in progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
        >
          {steps.map((s, i) => (
            <span key={s} className={`h-1 rounded-full ${i <= index ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-6">
        {step === "resolve" ? <ResolveStep date={date} settings={settings} /> : null}
        {step === "rate" ? (
          <section>
            <h1 className="mb-1 text-title">How was the day?</h1>
            <p className="mb-6 text-text-muted">One tap each.</p>
            <DotRating
              label="Energy"
              low="Drained"
              high="Full"
              value={energy}
              onChange={(v) => {
                setEnergy(v);
                void save({ energy: v });
              }}
            />
            <DotRating
              label="Focus"
              low="Scattered"
              high="Deep"
              value={focus}
              onChange={(v) => {
                setFocus(v);
                void save({ focus: v });
              }}
            />
          </section>
        ) : null}
        {step === "note" ? (
          <section>
            <h1 className="mb-4 text-title">
              <label htmlFor="checkin-note">Anything worth remembering about today?</label>
            </h1>
            <textarea
              id="checkin-note"
              rows={5}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => void save({ note })}
              placeholder="Optional"
              className="w-full resize-none rounded-block border border-border bg-surface-raised px-3 py-2.5 placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-right text-caption text-text-muted" aria-live="polite">
              {note.length} / {NOTE_MAX}
            </p>
          </section>
        ) : null}
        {step === "tomorrow" ? <TomorrowStep date={addDays(date, 1)} settings={settings} /> : null}
        {step === "close" && result ? <CloseStep date={date} settings={settings} energy={energy} focus={focus} result={result} /> : null}
        {error ? (
          <p role="alert" className="mt-3 text-caption text-danger">
            {error}
          </p>
        ) : null}
      </main>

      <footer className="flex shrink-0 gap-3 border-t border-border px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {step === "close" ? (
          <Button variant="primary" block onClick={() => router.push(exitHref)}>
            Done
          </Button>
        ) : (
          <>
            {index > 0 ? (
              <Button block disabled={busy} onClick={() => setStep(steps[index - 1])}>
                Back
              </Button>
            ) : null}
            <Button variant={step === "resolve" && left > 0 ? "secondary" : "primary"} block disabled={busy || !canNext} onClick={() => void next()}>
              {step === "tomorrow" ? "Finish" : step === "resolve" && left > 0 ? "Skip for now" : "Next"}
            </Button>
          </>
        )}
      </footer>
    </>
  );
}

/** Step 1: the day's unresolved blocks, one card at a time (the resolver, inline). */
function ResolveStep({ date, settings }: { date: string; settings: Settings }) {
  const unresolved = useUnresolvedBlocks();
  const left = (unresolved ?? []).filter((b) => toLocalDate(b.starts_at, settings.timezone) === date);
  if (!unresolved) return null;
  if (left.length === 0) {
    return (
      <section>
        <h1 className="mb-1 text-title">All blocks resolved</h1>
        <p className="text-text-muted">Every block of the day has an outcome.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col">
      <h1 className="mb-1 text-title">What happened?</h1>
      <p className="mb-4 text-text-muted">
        {left.length} {left.length === 1 ? "block has" : "blocks have"} no outcome yet.
      </p>
      <BlockCard key={left[0].id} block={left[0]} settings={settings} onResolved={() => {}} />
    </section>
  );
}

/** Five dots in a row, one tap to rate 1–5 (a radio group). */
function DotRating({ label, low, high, value, onChange }: { label: string; low: string; high: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <fieldset className="mb-6">
      <legend className="mb-2 text-heading">{label}</legend>
      <div className="flex justify-between gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${label} ${n} of 5`}
              onClick={() => onChange(n)}
              className="flex size-12 items-center justify-center"
            >
              <span className={`block size-8 rounded-full border-2 transition-colors ${on ? "border-accent bg-accent" : "border-border bg-surface"}`} />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-caption text-text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

/** Step 4: a read-only look at tomorrow (§5.14): its blocks and personal blocks. */
function TomorrowStep({ date, settings }: { date: string; settings: Settings }) {
  const blocks = useBlocksForDays(date, date, settings.timezone);
  const personal = usePersonalBlocks();
  const actions = useRows("actions");
  const goals = useRows("goals");
  const areas = useAreas(true);
  if (!blocks || !personal) return null;
  const tz = settings.timezone;
  const weekday = weekdayOf(date);
  const items = [
    ...blocks
      .filter((b) => b.status !== "missed")
      .map((b) => {
        const action = actions?.find((a) => a.id === b.action_id);
        const owner = action?.goal_id ? goals?.find((g) => g.id === action.goal_id)?.title : areas?.find((a) => a.id === action?.area_id)?.name;
        return {
          key: b.id,
          time: toLocalTime(b.starts_at, tz),
          end: toLocalTime(b.ends_at, tz),
          title: action?.title ?? "Deleted action",
          sub: owner ?? "",
          dots: b.planned_pomodoros,
          draft: b.status === "draft",
          personal: false,
        };
      }),
    ...personal
      .filter((p) => p.active && p.weekdays.includes(weekday))
      .map((p) => ({ key: p.id, time: p.start_time, end: p.end_time, title: p.label, sub: "Personal", dots: 0, draft: false, personal: true })),
  ].sort((a, b) => a.time.localeCompare(b.time));
  const pomodoros = blocks.filter((b) => b.status === "scheduled").reduce((n, b) => n + b.planned_pomodoros, 0);

  return (
    <section>
      <h1 className="mb-1 text-title">Tomorrow</h1>
      <p className="mb-4 text-text-muted">
        {formatDayHeader(date)} ·{" "}
        {pomodoros === 0 ? "nothing scheduled yet" : `${pomodoros} ${pomodoros === 1 ? "pomodoro" : "pomodoros"} planned`}
      </p>
      {items.length === 0 ? (
        <p className="rounded-card border border-border bg-surface px-3 py-3 text-text-muted">An open day. Plan it from the week when you are ready.</p>
      ) : (
        <ul className="overflow-hidden rounded-card border border-border bg-surface">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
              <span className="w-24 shrink-0 text-caption text-text-muted tabular-nums">
                {i.time}–{i.end}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${i.personal ? "text-text-muted" : ""}`}>
                  {i.title}
                  {i.draft ? <span className="ml-1 text-caption text-text-muted">(draft)</span> : null}
                </span>
                {i.sub ? <span className="block truncate text-caption text-text-muted">{i.sub}</span> : null}
              </span>
              {i.dots ? <PomodoroDots completed={0} total={i.dots} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Step 5: the streak rolls up, the day's numbers, one coach line. */
function CloseStep({
  date,
  settings,
  energy,
  focus,
  result,
}: {
  date: string;
  settings: Settings;
  energy: number | null;
  focus: number | null;
  result: { first: boolean; before: number; after: number };
}) {
  const blocks = useBlocksForDays(date, date, settings.timezone);
  const numbers = useMemo(() => dayNumbers(blocks ?? []), [blocks]);
  const [shown, setShown] = useState(result.first ? result.before : result.after);
  useEffect(() => {
    if (shown === result.after) return;
    const t = setTimeout(() => setShown(result.after), 350);
    return () => clearTimeout(t);
  }, [shown, result.after]);

  return (
    <section className="text-center">
      <p className="text-caption font-semibold tracking-wide text-accent uppercase">{result.first ? "Checked in" : "Check-in updated"}</p>
      <p className="mt-4 overflow-hidden text-[64px] leading-none font-bold text-accent tabular-nums" aria-live="polite">
        <span key={shown} className={`inline-block ${shown !== result.before ? "animate-roll" : ""}`}>
          {shown}
        </span>
      </p>
      <p className="mt-1 text-heading">{result.after === 1 ? "day" : "days"} in a row</p>
      <div className="mt-6 rounded-card border border-border bg-surface px-4 py-3 text-left">
        <p className="text-caption text-text-muted">Pomodoros</p>
        <p className="text-heading">
          {numbers.done} done of {numbers.planned} planned
        </p>
      </div>
      <p className="mt-4 text-left text-text-muted">{closingLine({ ...numbers, energy, focus })}</p>
    </section>
  );
}
