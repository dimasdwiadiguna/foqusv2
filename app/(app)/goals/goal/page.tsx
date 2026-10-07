"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  useActionsForGoal,
  useAreas,
  useBlocksForActions,
  useCompletedByAction,
  useMajorMoves,
  useNow,
  usePlansForGoal,
  useRow,
  useSettings,
  useToday,
  useStrengths,
} from "@/data";
import { goalColor } from "@/lib/areas";
import { achievementNumbers, goalProgress, goalStats, MAX_MAJOR_MOVES } from "@/lib/goals";
import { formatDateRange, formatSeason, seasonOfDate } from "@/lib/time";
import { achieveGoal, addMajorMove, deleteGoal, deleteMajorMove, dropGoal, setMajorMoveDone, updateMetricCurrent } from "@/repo";
import type { Action, Goal, MajorMove, SeasonPlan } from "@/types";
import { ActionList } from "@/components/actions/ActionList";
import { RuleList } from "@/components/recurrence/RuleList";
import { HabitsSection } from "@/components/habits/HabitsSection";
import { GoalsList } from "@/components/goals/GoalsList";
import { useIsDesktop } from "@/components/shell/useIsDesktop";
import { StrengthCard } from "@/components/coach/Strength";
import { useQuickAdd } from "@/components/actions/QuickAdd";
import { showMoment } from "@/components/celebration/Moments";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { MoreIcon } from "@/components/shell/icons";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { controlClass, TextArea } from "@/components/ui/Field";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Sheet } from "@/components/ui/Sheet";

export default function GoalPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <GoalDetail />
    </Suspense>
  );
}

function GoalDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const seasonParam = params.get("season");
  const goal = useRow("goals", id);
  const plans = usePlansForGoal(id);
  const today = useToday();
  const desktop = useIsDesktop();
  const router = useRouter();

  if (!today || plans === undefined) return <ScreenSkeleton />;
  if (!goal) {
    return (
      <>
        <ScreenHeader back={{ href: "/goals", label: "Goals" }} title="Goal" />
        <EmptyState title="Goal not found" body="It may have been deleted." />
      </>
    );
  }
  const current = seasonOfDate(today);
  const plan =
    plans.find((p) => p.season_id === seasonParam) ??
    plans.find((p) => p.season_id === current) ??
    plans[plans.length - 1];
  if (!plan) return <EmptyState title="No plan yet" body="This goal has no season plan." />;
  const body = <GoalBody goal={goal} plan={plan} readOnly={goal.status !== "active" || plan.season_id < current} />;
  if (!desktop) return body;
  // Desktop (§6.11): the season's goal list on the left, this goal on the right.
  return (
    <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-6">
      <div className="min-w-0">
        <GoalsList season={plan.season_id} current={current} header={false} onSeason={(id) => router.push(`/goals?season=${id}`)} />
      </div>
      <div className="min-w-0">{body}</div>
    </div>
  );
}

function GoalBody({ goal, plan, readOnly }: { goal: Goal; plan: SeasonPlan; readOnly: boolean }) {
  const router = useRouter();
  const areas = useAreas(true);
  const moves = useMajorMoves(plan.id) ?? [];
  const actions = useActionsForGoal(goal.id) ?? [];
  const completed = useCompletedByAction();
  const blocks = useBlocksForActions(actions.map((a) => a.id)) ?? [];
  const settings = useSettings();
  const now = useNow();
  const quickAdd = useQuickAdd();
  const strength = useStrengths()?.find((x) => x.plan.id === plan.id)?.strength;
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<"achieve" | "drop" | "delete" | null>(null);

  const areaMap = useMemo(() => new Map((areas ?? []).map((a) => [a.id, a])), [areas]);
  const area = goal.area_id ? areaMap.get(goal.area_id) : undefined;
  const color = goalColor(goal, areaMap);
  const progress = goalProgress(plan, actions, completed ?? new Map());
  const stats = goalStats(blocks, new Date(now).toISOString(), settings?.focus_minutes);
  const moveIds = new Set(moves.map((m) => m.id));
  // Recurring occurrences are listed under their rule (section 7), not one by one.
  const listed = actions.filter((a) => !a.recurrence_rule_id);
  const loose = listed.filter((a) => !a.major_move_id || !moveIds.has(a.major_move_id));
  const backHref = `/goals?season=${plan.season_id}`;
  const editHref = `/goal-setup?goal=${encodeURIComponent(goal.id)}&season=${plan.season_id}&step=1&mode=edit`;

  return (
    <>
      {/* 1. Header: compact and sticky; the full title, area, and dates follow it */}
      <ScreenHeader
        back={{ href: backHref, label: "Goals" }}
        title={goal.title}
        subtitle={formatSeason(plan.season_id)}
        actions={
          !readOnly ? (
            <IconButton label="More goal options" onClick={() => setMenu(true)}>
              <MoreIcon className="size-6" />
            </IconButton>
          ) : null
        }
      />
      <section aria-label="Goal" className="mb-3 flex items-start gap-3">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color }} />
            {area ? area.name : "No area"}
          </span>
          <span>{formatDateRange(plan.starts_on, plan.ends_on)}</span>
          {goal.status === "achieved" ? <span className="text-success">Achieved</span> : null}
          {goal.status === "dropped" ? <span>Dropped{goal.drop_reason ? ` · ${goal.drop_reason}` : ""}</span> : null}
        </p>
        {!readOnly ? (
          <Button variant="primary" className="shrink-0" onClick={() => setConfirm("achieve")}>
            Achieve
          </Button>
        ) : null}
      </section>

      {/* 2. Outcome and metric */}
      <section aria-labelledby="outcome" className="mb-3 rounded-card border border-border bg-surface p-3">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 id="outcome" className="text-caption uppercase tracking-wide text-text-muted">
              Outcome
            </h2>
            <p className="mt-1">{plan.outcome}</p>
          </div>
          <ProgressRing value={progress} color={color} size={64} label={plan.metric_target ? "Metric progress" : "Pomodoro progress"} />
        </div>
        {plan.metric_target ? <MetricUpdater plan={plan} readOnly={readOnly} /> : null}
      </section>

      {/* 3. Plan strength (active goals, current season plan) */}
      {strength ? <StrengthCard goalId={goal.id} planId={plan.id} strength={strength} /> : null}

      {/* 4. Why and anti-goals */}
      <details className="mb-3 rounded-card border border-border bg-surface px-4">
        <summary className="flex min-h-12 cursor-pointer items-center text-heading">Why and anti-goals</summary>
        <div className="pb-4">
          <h3 className="text-caption text-text-muted">Why it matters</h3>
          <p className="mb-3">{goal.why ?? <span className="text-text-muted">Not written yet.</span>}</p>
          <h3 className="text-caption text-text-muted">Anti-goals</h3>
          {goal.anti_goals.length ? (
            <ul className="list-disc pl-5">
              {goal.anti_goals.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted">None yet.</p>
          )}
          {!readOnly ? (
            <Link href={`${editHref.replace("step=1", "step=2")}`} className="mt-2 inline-flex min-h-11 items-center text-accent">
              Edit
            </Link>
          ) : null}
        </div>
      </details>

      {/* 5. Major moves */}
      <section aria-labelledby="moves" className="mb-4">
        <h2 id="moves" className="mb-2 text-heading">
          Major moves
        </h2>
        {moves.length === 0 ? <p className="mb-2 text-text-muted">No major moves yet. Aim for three to five.</p> : null}
        {moves.map((m) => (
          <MoveSection
            key={m.id}
            move={m}
            actions={listed.filter((a) => a.major_move_id === m.id)}
            readOnly={readOnly}
            onAdd={() => quickAdd({ goal_id: goal.id, major_move_id: m.id })}
          />
        ))}
        {!readOnly && moves.length < MAX_MAJOR_MOVES ? <AddMove planId={plan.id} /> : null}
      </section>

      {/* 6. Actions without a move */}
      <section aria-labelledby="loose" className="mb-4">
        <h2 id="loose" className="mb-2 text-heading">
          {moves.length ? "Other actions" : "Actions"}
        </h2>
        <ActionList actions={loose} readOnly={readOnly} emptyText="No actions here." />
        {!readOnly ? (
          <Button block onClick={() => quickAdd({ goal_id: goal.id })}>
            Add an action
          </Button>
        ) : null}
      </section>

      {/* 7. Recurring actions */}
      <section aria-labelledby="recurring" className="mb-4">
        <h2 id="recurring" className="mb-2 text-heading">
          Recurring actions
        </h2>
        <RuleList goalId={goal.id} readOnly={readOnly} />
      </section>

      {/* Habits that support this goal (Stage 2 exit) */}
      {!readOnly ? <HabitsSection goalId={goal.id} title="Habits" /> : null}

      {/* 8. Stats */}
      <section aria-labelledby="stats" className="mb-4">
        <h2 id="stats" className="mb-2 text-heading">
          Stats
        </h2>
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="Pomodoros" value={String(stats.pomodoros)} />
          <Stat label="Hours" value={String(stats.hours)} />
          <Stat
            label="Follow-through"
            value={stats.followThrough === null ? "—" : `${Math.round(stats.followThrough * 100)}%`}
            hint={stats.followThrough === null ? "No blocks yet" : undefined}
          />
        </dl>
      </section>

      <Sheet open={menu} onClose={() => setMenu(false)} title={goal.title}>
        <div className="flex flex-col gap-2">
          <Link href={editHref} className="flex min-h-11 items-center rounded-full bg-surface-raised px-5">
            Edit goal
          </Link>
          <Button
            onClick={() => {
              setMenu(false);
              setConfirm("drop");
            }}
          >
            Drop goal
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setMenu(false);
              setConfirm("delete");
            }}
          >
            Delete goal
          </Button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirm === "achieve"}
        title={`Mark "${goal.title}" achieved?`}
        body="This closes the goal and its season plan."
        confirmLabel="Achieved"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          await achieveGoal(goal.id);
          showMoment({ eyebrow: "Goal achieved", headline: goal.title, numbers: achievementNumbers(plan, actions, stats), line: "You set it, planned it, and did it." });
        }}
      />
      <DropSheet
        open={confirm === "drop"}
        goal={goal}
        onClose={() => setConfirm(null)}
        onDropped={() => router.replace(backHref)}
      />
      <ConfirmSheet
        open={confirm === "delete"}
        title="Delete this goal?"
        body="The goal, its plan, its major moves, and its actions disappear from every list. To keep the history, drop it instead."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          await deleteGoal(goal.id);
          router.replace(backHref);
        }}
      />
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="text-heading">{value}</dd>
      {hint ? <dd className="text-caption text-text-muted">{hint}</dd> : null}
    </div>
  );
}

function MetricUpdater({ plan, readOnly }: { plan: SeasonPlan; readOnly: boolean }) {
  const [value, setValue] = useState(String(plan.metric_current ?? 0));
  const changed = Number(value) !== (plan.metric_current ?? 0);
  return (
    <form
      className="mt-3 flex items-center gap-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() === "" || !Number.isFinite(Number(value))) return;
        void updateMetricCurrent(plan.id, Number(value));
      }}
    >
      <label htmlFor="metric-current" className="min-w-0 flex-1 truncate text-text-muted">
        {plan.metric_label ?? "Progress"}
      </label>
      <input
        id="metric-current"
        type="number"
        inputMode="decimal"
        step="any"
        disabled={readOnly}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`${controlClass.replace("w-full", "w-20")} min-h-11 shrink-0 text-right`}
      />
      <span className="shrink-0 whitespace-nowrap text-text-muted">/ {plan.metric_target}</span>
      {changed && !readOnly ? (
        <Button type="submit" variant="primary" className="px-4">
          Update
        </Button>
      ) : null}
    </form>
  );
}

function MoveSection({ move, actions, readOnly, onAdd }: { move: MajorMove; actions: Action[]; readOnly: boolean; onAdd: () => void }) {
  const open = actions.filter((a) => a.status === "todo").length;
  const done = move.status === "done";
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <details className="mb-2 rounded-card border border-border bg-surface px-3" open={!done}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2">
        <button
          type="button"
          disabled={readOnly}
          aria-pressed={done}
          aria-label={done ? `Reopen major move ${move.title}` : `Mark major move ${move.title} done`}
          onClick={(e) => {
            e.preventDefault();
            void setMajorMoveDone(move.id, !done);
          }}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <span className={`flex size-5 items-center justify-center rounded-block border-2 ${done ? "border-success bg-success text-bg" : "border-text-muted"}`}>
            {done ? "✓" : null}
          </span>
        </button>
        <span className={`min-w-0 flex-1 ${done ? "text-text-muted line-through" : ""}`}>{move.title}</span>
        <span className="text-caption text-text-muted">{open} open</span>
      </summary>
      <div className="pb-3">
        <ActionList actions={actions} readOnly={readOnly} emptyText="No actions under this move yet." />
        {!readOnly ? (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onAdd}>
              Add an action
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Remove move
            </Button>
          </div>
        ) : null}
      </div>
      <ConfirmSheet
        open={confirmDelete}
        title="Remove this major move?"
        body="Its actions stay on the goal, under Other actions."
        confirmLabel="Remove"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void deleteMajorMove(move.id);
        }}
      />
    </details>
  );
}

function AddMove({ planId }: { planId: string }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await addMajorMove(planId, title);
          setTitle("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "That could not be added.");
        }
      }}
    >
      <label htmlFor="new-move" className="sr-only">
        New major move
      </label>
      <input
        id="new-move"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a major move"
        className={`${controlClass} min-h-11 flex-1`}
      />
      <Button type="submit" disabled={!title.trim()}>
        Add
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function DropSheet({ open, goal, onClose, onDropped }: { open: boolean; goal: Goal; onClose: () => void; onDropped: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Drop "${goal.title}"?`}
      footer={
        <div className="flex gap-3">
          <Button block onClick={onClose}>
            Keep it
          </Button>
          <Button
            block
            variant="danger"
            onClick={async () => {
              await dropGoal(goal.id, reason);
              onClose();
              onDropped();
            }}
          >
            Drop goal
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-text-muted">Its open actions are dropped and their future blocks removed. Done work stays in your history.</p>
      <TextArea id="drop-reason" label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Sheet>
  );
}
