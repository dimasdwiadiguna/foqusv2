"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readFirstRun, setFirstRun, useToday, useWindows } from "@/data";
import { TIME_OPTIONS } from "@/lib/availability";
import { REQUIRED_STEPS, SETUP_FLOW_STEPS } from "@/lib/first-run";
import { seasonOfDate } from "@/lib/time";
import { copyWindowToAllDays, updateWindow } from "@/repo";
import type { Weekday } from "@/types";
import { CompassView } from "@/components/coach/CompassView";
import { AreasSettings } from "@/components/settings/AreasSettings";
import { END_OPTIONS, PersonalBlocksSettings, TimeSelect } from "@/components/settings/ScheduleSettings";
import { Button } from "@/components/ui/Button";
import { markFirstRunDecided } from "./FirstRunGate";

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
const WEEKEND: Weekday[] = [6, 7];

/**
 * First-run setup (§6.7 flows): Availability → Peak → Personal blocks → Areas → Compass → First
 * goal. Each step saves as it goes; every step but availability can be skipped; the step reached
 * is remembered, so leaving and reopening the app resumes it.
 */
export function SetupFlow() {
  const router = useRouter();
  const today = useToday();
  const availability = useWindows("availability");
  const peak = useWindows("peak");
  const [step, setStepState] = useState(() => {
    const m = readFirstRun();
    return m && m !== "done" ? m.step : 0;
  });
  const [hours, setHours] = useState<{ wd: [string, string]; we: [string, string]; peak: [string, string] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (availability && peak && hours === null) {
    const a = (d: number) => availability.find((w) => w.weekday === d);
    const p = peak.find((w) => w.weekday === 1);
    setHours({
      wd: [a(1)?.start_time ?? "08:00", a(1)?.end_time ?? "18:00"],
      we: [a(6)?.start_time ?? "08:00", a(6)?.end_time ?? "18:00"],
      peak: [p?.start_time ?? "08:00", p?.end_time ?? "11:00"],
    });
  }
  if (!hours || !today) return null;

  const setStep = (n: number) => {
    setStepState(n);
    setFirstRun({ step: n });
  };
  const finish = (to: string) => {
    setFirstRun("done");
    markFirstRunDecided();
    router.replace(to);
  };
  const save = async () => {
    if (step === 0) {
      for (const d of WEEKDAYS) await updateWindow("availability", d, hours.wd[0], hours.wd[1]);
      for (const d of WEEKEND) await updateWindow("availability", d, hours.we[0], hours.we[1]);
    }
    if (step === 1) await copyWindowToAllDays("peak", hours.peak[0], hours.peak[1]);
  };
  const next = async () => {
    setError(null);
    setBusy(true);
    try {
      await save();
      if (step === SETUP_FLOW_STEPS.length - 1) finish(`/goal-setup?season=${seasonOfDate(today)}`);
      else setStep(step + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const skip = () => (step === SETUP_FLOW_STEPS.length - 1 ? finish("/today") : setStep(step + 1));
  const range = (id: string, label: string, v: [string, string], set: (v: [string, string]) => void) => (
    <fieldset className="mb-4">
      <legend className="mb-2 font-semibold">{label}</legend>
      <div className="grid grid-cols-2 gap-3">
        <TimeSelect id={`${id}-from`} label="From" value={v[0]} options={TIME_OPTIONS} onChange={(x) => set([x, v[1]])} />
        <TimeSelect id={`${id}-to`} label="To" value={v[1]} options={END_OPTIONS} onChange={(x) => set([v[0], x])} />
      </div>
    </fieldset>
  );

  return (
    <>
      <header className="shrink-0 px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex min-h-11 items-center justify-between">
          <span className="font-semibold">Set up FOQUS</span>
          <span className="text-caption text-text-muted">
            Step {step + 1} of {SETUP_FLOW_STEPS.length} · {SETUP_FLOW_STEPS[step]}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={SETUP_FLOW_STEPS.length} aria-valuenow={step + 1}>
          {SETUP_FLOW_STEPS.map((s, i) => (
            <span key={s} className={`h-1 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-6">
        {step === 0 ? (
          <>
            <h1 className="mb-1 text-title">When can you work?</h1>
            <p className="mb-4 text-text-muted">FOQUS only schedules inside these hours. You can set each day separately later in Settings → Schedule.</p>
            {range("avail-weekdays", "Weekdays", hours.wd, (v) => setHours({ ...hours, wd: v }))}
            {range("avail-weekend", "Weekend", hours.we, (v) => setHours({ ...hours, we: v }))}
          </>
        ) : null}
        {step === 1 ? (
          <>
            <h1 className="mb-1 text-title">Your peak hours</h1>
            <p className="mb-4 text-text-muted">When is your mind sharpest? Goal work is scheduled here first.</p>
            {range("peak", "Peak window, every day", hours.peak, (v) => setHours({ ...hours, peak: v }))}
          </>
        ) : null}
        {step === 2 ? (
          <>
            <h1 className="mb-1 text-title">Personal blocks</h1>
            <p className="mb-4 text-text-muted">Meals, routines, and rest that FOQUS never schedules over.</p>
            <PersonalBlocksSettings />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <h1 className="mb-1 text-title">Areas</h1>
            <p className="mb-4 text-text-muted">The ongoing parts of your life that are not goals: work, teaching, home. Tasks without a goal live here.</p>
            <AreasSettings />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <h1 className="mb-1 text-title">Your compass</h1>
            <p className="mb-4 text-text-muted">A long-term vision and a few values. Reviews start here.</p>
            <CompassView />
          </>
        ) : null}
        {step === 5 ? (
          <>
            <h1 className="mb-1 text-title">Your first goal</h1>
            <p className="text-text-muted">One clear goal for this quarter, with a plan. The goal wizard takes about five minutes.</p>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-caption text-danger">
            {error}
          </p>
        ) : null}
      </main>

      <footer className="flex shrink-0 gap-2 border-t border-border px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {step > 0 ? (
          <Button className="px-4" disabled={busy} onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}
        {!REQUIRED_STEPS.has(step) ? (
          <Button variant="ghost" className="px-4" disabled={busy} onClick={skip}>
            Skip
          </Button>
        ) : null}
        <Button variant="primary" block disabled={busy} onClick={() => void next()}>
          {step === SETUP_FLOW_STEPS.length - 1 ? "Set my first goal" : step <= 1 ? "Save and continue" : "Next"}
        </Button>
      </footer>
    </>
  );
}
