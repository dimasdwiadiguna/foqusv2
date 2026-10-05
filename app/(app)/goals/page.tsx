"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useAreas, useCompletedByAction, useGoalsInSeason, useRows, useSetupProgress, useToday } from "@/data";
import { goalColor } from "@/lib/areas";
import { goalProgress } from "@/lib/goals";
import { SETUP_STEPS } from "@/lib/goal-setup";
import { formatSeason, seasonOfDate } from "@/lib/time";
import { reorderGoals } from "@/repo";
import type { Action } from "@/types";
import { QuickAddButton } from "@/components/actions/QuickAddButton";
import { AreaChips } from "@/components/goals/AreaChips";
import { GoalCard } from "@/components/goals/GoalCard";
import { SeasonSelector } from "@/components/goals/SeasonSelector";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SortableItem, SortableList } from "@/components/ui/Sortable";

export default function GoalsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Goals />
    </Suspense>
  );
}

function Goals() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const current = today ? seasonOfDate(today) : null;
  const season = params.get("season") ?? current;
  if (!today || !current || !season) return <ScreenSkeleton />;
  return <GoalsForSeason season={season} current={current} onSeason={(id) => router.replace(`/goals?season=${id}`)} />;
}

function GoalsForSeason({ season, current, onSeason }: { season: string; current: string; onSeason: (id: string) => void }) {
  const rows = useGoalsInSeason(season);
  const areas = useAreas(true);
  const actions = useRows("actions");
  const completed = useCompletedByAction();
  const setup = useSetupProgress();
  const readOnly = season < current;

  const areaMap = useMemo(() => new Map((areas ?? []).map((a) => [a.id, a])), [areas]);
  const actionsByGoal = useMemo(() => {
    const m = new Map<string, Action[]>();
    for (const a of actions ?? []) if (a.goal_id) m.set(a.goal_id, [...(m.get(a.goal_id) ?? []), a]);
    return m;
  }, [actions]);

  if (!rows) return <ScreenSkeleton />;
  const active = rows.filter((r) => r.goal.status === "active");
  const closed = rows.filter((r) => r.goal.status !== "active");
  const resume = setup && rows.find((r) => r.goal.id === setup.goalId && r.goal.status === "active");

  const card = (r: (typeof rows)[number], sortable?: Parameters<typeof GoalCard>[0]["sortable"]) => (
    <GoalCard
      goal={r.goal}
      plan={r.plan}
      color={goalColor(r.goal, areaMap)}
      progress={goalProgress(r.plan, actionsByGoal.get(r.goal.id) ?? [], completed ?? new Map())}
      href={`/goals/goal?id=${encodeURIComponent(r.goal.id)}&season=${season}`}
      setupUnfinished={setup?.goalId === r.goal.id}
      sortable={sortable}
    />
  );

  return (
    <>
      <ScreenHeader
        title="Goals"
        actions={
          <>
            <SeasonSelector value={season} current={current} onChange={onSeason} />
            <QuickAddButton />
          </>
        }
      />

      {resume && setup ? (
        <Link
          href={`/goal-setup?goal=${encodeURIComponent(setup.goalId)}&season=${setup.seasonId}&step=${setup.step}`}
          className="mb-3 block rounded-card border border-accent/60 bg-surface px-3 py-2"
        >
          <span className="block text-caption text-accent">Continue setting up</span>
          <span className="block text-heading">{resume.goal.title}</span>
          <span className="text-caption text-text-muted">
            {setup.step <= SETUP_STEPS.length ? `Step ${setup.step} of ${SETUP_STEPS.length} · ${SETUP_STEPS[setup.step - 1]}` : "Ready to finish"}
          </span>
        </Link>
      ) : null}

      {active.length === 0 ? (
        <section className="rounded-card border border-border bg-surface px-4 py-5 text-center">
          <div aria-hidden="true" className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full border-2 border-accent">
            <span className="size-5 rounded-full border-2 border-accent" />
          </div>
          <h2 className="text-heading">{readOnly ? `No goals in ${formatSeason(season)}` : "Set your first goal"}</h2>
          <p className="mx-auto mt-1 max-w-72 text-text-muted">
            {readOnly
              ? "This season has passed."
              : "One clear goal with a plan beats a long wish list. It takes about five minutes."}
          </p>
          {!readOnly ? (
            <Link
              href={`/goal-setup?season=${season}`}
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-bg"
            >
              Set a goal
            </Link>
          ) : null}
        </section>
      ) : (
        <>
          <SortableList
            ids={active.map((r) => r.goal.id)}
            onReorder={(ids) => void reorderGoals(ids)}
            disabled={readOnly}
          >
            {active.map((r) =>
              readOnly ? (
                <li key={r.goal.id} className="mb-2">
                  {card(r)}
                </li>
              ) : (
                <SortableItem key={r.goal.id} id={r.goal.id} className="mb-2">
                  {(s) => card(r, s)}
                </SortableItem>
              ),
            )}
          </SortableList>
          {!readOnly ? (
            <Link
              href={`/goal-setup?season=${season}`}
              className="mt-1 flex min-h-11 items-center justify-center rounded-full border border-dashed border-border text-text-muted"
            >
              New goal
            </Link>
          ) : null}
          {!readOnly && active.length > 1 ? (
            <p className="mt-2 text-center text-caption text-text-muted">Press and hold a goal to change its rank.</p>
          ) : null}
        </>
      )}

      {closed.length > 0 ? (
        <details className="mt-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-caption uppercase tracking-wide text-text-muted">
            Closed ({closed.length})
          </summary>
          <ul>
            {closed.map((r) => (
              <li key={r.goal.id} className="mb-2">
                {card(r)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <AreaChips />
    </>
  );
}
