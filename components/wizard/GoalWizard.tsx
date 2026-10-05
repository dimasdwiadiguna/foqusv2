"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { setSetupProgress, usePlansForGoal, useRow, useToday } from "@/data";
import { clampStep, SETUP_FINISH, SETUP_STEP_COUNT, SETUP_STEPS } from "@/lib/goal-setup";
import { seasonPlanId } from "@/lib/ids";
import { parseSeasonId, quarterBounds, seasonOfDate } from "@/lib/time";
import { Button } from "@/components/ui/Button";
import { FinishStep, GoalStep, PlanStep, RealityStep, SystemStep, WhyStep, type SaveFn } from "./steps";

/**
 * The GPS wizard (§6.7): five steps, one question group per screen, then a summary. The goal is
 * created when step 1 is saved; after that every step saves as the owner moves on, and the wizard
 * can be left ("Save and exit") and resumed from the Goals list.
 *
 * URL: /goal-setup?season=2026-Q4[&goal=<id>&step=<n>][&mode=edit]
 */
export function GoalWizard() {
  const params = useSearchParams();
  const router = useRouter();
  const today = useToday();
  const goalId = params.get("goal");
  const mode = params.get("mode") === "edit" ? "edit" : "new";
  const step = goalId ? clampStep(Number(params.get("step") ?? 1)) : 1;
  const goal = useRow("goals", goalId ?? "");
  const plans = usePlansForGoal(goalId ?? "");
  const saveRef = useRef<SaveFn | null>(null);
  const [busy, setBusy] = useState(false);

  if (!today) return null;
  const season = params.get("season") ?? seasonOfDate(today);
  const { startsOn, endsOn } = quarterBounds(parseSeasonId(season).year, parseSeasonId(season).quarter);
  const seasonBounds = { starts_on: startsOn, ends_on: endsOn };
  const plan = plans?.find((p) => p.id === (goalId ? seasonPlanId(goalId, season) : ""));
  const loading = goalId !== null && (goal === undefined || plans === undefined);

  const exitHref = goalId && mode === "edit" ? `/goals/goal?id=${encodeURIComponent(goalId)}&season=${season}` : `/goals?season=${season}`;
  const url = (id: string, n: number) =>
    `/goal-setup?season=${season}&goal=${encodeURIComponent(id)}&step=${n}${mode === "edit" ? "&mode=edit" : ""}`;

  /** Save the current screen. Returns the goal id, or null if it could not be saved. */
  const save = async (): Promise<string | null> => {
    if (!saveRef.current) return goalId;
    setBusy(true);
    try {
      return await saveRef.current();
    } finally {
      setBusy(false);
    }
  };

  const go = async (n: number) => {
    const id = await save();
    if (!id) return;
    if (mode === "new") setSetupProgress({ goalId: id, seasonId: season, step: n });
    router.replace(url(id, n));
    window.scrollTo(0, 0);
  };

  const saveAndExit = async () => {
    const id = await save();
    if (!id) return;
    if (mode === "new") setSetupProgress({ goalId: id, seasonId: season, step });
    router.push(mode === "new" ? `/goals?season=${season}` : exitHref);
  };

  const finish = () => {
    if (mode === "new") setSetupProgress(null);
    router.push(`/goals/goal?id=${encodeURIComponent(goalId ?? "")}&season=${season}`);
  };

  if (goalId && !loading && (!goal || !plan)) {
    return (
      <div className="p-4 pt-16 text-center">
        <p className="text-heading">This goal no longer exists.</p>
        <Link href="/goals" className="mt-4 inline-flex min-h-11 items-center text-accent" onClick={() => setSetupProgress(null)}>
          Back to goals
        </Link>
      </div>
    );
  }

  const stepProps = { register: (fn: SaveFn | null) => (saveRef.current = fn), seasonId: season, seasonBounds, today };

  return (
    <>
      <header className="shrink-0 px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex min-h-11 items-center justify-between">
          {goalId ? (
            <button type="button" onClick={() => void saveAndExit()} disabled={busy} className="-ml-2 min-h-11 px-2 text-accent">
              Save and exit
            </button>
          ) : (
            <Link href={exitHref} className="-ml-2 flex min-h-11 items-center px-2 text-text-muted">
              Cancel
            </Link>
          )}
          <span className="text-caption text-text-muted">
            {step <= SETUP_STEP_COUNT ? `Step ${step} of ${SETUP_STEP_COUNT} · ${SETUP_STEPS[step - 1]}` : "Your plan"}
          </span>
        </div>
        <div
          className="mt-2 grid grid-cols-5 gap-1"
          role="progressbar"
          aria-label="Goal setup progress"
          aria-valuemin={0}
          aria-valuemax={SETUP_STEP_COUNT}
          aria-valuenow={Math.min(step, SETUP_STEP_COUNT)}
        >
          {SETUP_STEPS.map((s, i) => (
            <span key={s} className={`h-1 rounded-full ${i < step ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-6 pb-6">
        {loading ? null : step === 1 ? (
          <GoalStep key={goalId ?? "new"} {...stepProps} goal={goal ?? null} plan={plan ?? null} />
        ) : step === 2 && goal ? (
          <WhyStep key={goal.id} {...stepProps} goal={goal} />
        ) : step === 3 && plan ? (
          <PlanStep key={plan.id} {...stepProps} plan={plan} />
        ) : step === 4 && plan ? (
          <RealityStep key={plan.id} {...stepProps} plan={plan} />
        ) : step === 5 && goal && plan ? (
          <SystemStep key={goal.id} {...stepProps} goal={goal} plan={plan} />
        ) : goal && plan ? (
          <FinishStep goal={goal} plan={plan} register={stepProps.register} />
        ) : null}
      </main>

      <footer className="flex shrink-0 gap-3 border-t border-border px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {step === SETUP_FINISH ? (
          <Button variant="primary" block onClick={finish}>
            Done
          </Button>
        ) : (
          <>
            {step > 1 ? (
              <Button block disabled={busy} onClick={() => void go(step - 1)}>
                Back
              </Button>
            ) : null}
            <Button variant="primary" block disabled={busy} onClick={() => void go(step + 1)}>
              {step === SETUP_STEP_COUNT ? "Finish" : "Next"}
            </Button>
          </>
        )}
      </footer>
    </>
  );
}
