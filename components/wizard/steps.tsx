"use client";

import { useLayoutEffect, useState } from "react";
import { getActivePlanSpans, useActionsForGoal, useAreas, useMajorMoves } from "@/data";
import { cleanTitle } from "@/lib/actions";
import {
  CONCURRENT_WARNING,
  CONFIDENCE_HINT_BELOW,
  defaultPlanDates,
  MAX_MAJOR_MOVES,
  MAX_OBSTACLES,
  planDatesError,
  wouldExceedConcurrentGoals,
} from "@/lib/goals";
import { formatDateRange } from "@/lib/time";
import {
  addAction,
  createGoal,
  deleteAction,
  saveMajorMoves,
  updateGoalBasics,
  updateGoalWhy,
  updateRealityCheck,
  type GoalBasics,
} from "@/repo";
import type { Goal, MajorMove, Obstacle, SeasonPlan } from "@/types";
import { RuleList } from "@/components/recurrence/RuleList";
import { EstimateStepper } from "@/components/actions/EstimateStepper";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { controlClass, TextArea, TextField } from "@/components/ui/Field";
import { PomodoroDots } from "@/components/ui/PomodoroDots";
import { Switch } from "@/components/ui/Switch";

/** Saves the current screen; resolves to the goal id, or null when it could not save. */
export type SaveFn = () => Promise<string | null>;

interface StepBase {
  register: (fn: SaveFn | null) => void;
  seasonId: string;
  seasonBounds: { starts_on: string; ends_on: string };
  today: string;
}

/**
 * Hand the wizard this screen's latest save function. A layout effect, so a tap that follows a
 * keystroke immediately never runs a save function holding the previous text.
 */
function useRegister(register: StepBase["register"], fn: SaveFn | null) {
  useLayoutEffect(() => {
    register(fn);
    return () => register(null);
  });
}

function Prompt({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-title">{title}</h1>
      <p className="mt-1 text-text-muted">{body}</p>
    </div>
  );
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mb-4 rounded-block border border-danger/60 p-3 text-danger">
      {error}
    </p>
  ) : null;
}

const message = (e: unknown) => (e instanceof Error ? e.message : "That could not be saved.");

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconButton label={label} onClick={onClick} className="text-text-muted">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </IconButton>
  );
}

// ---------------------------------------------------------------------------
// 1. Goal

export function GoalStep({ register, seasonId, seasonBounds, today, goal, plan }: StepBase & { goal: Goal | null; plan: SeasonPlan | null }) {
  const areas = useAreas() ?? [];
  const defaults = defaultPlanDates(today, seasonBounds);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [areaId, setAreaId] = useState(goal?.area_id ?? "");
  const [outcome, setOutcome] = useState(plan?.outcome ?? "");
  const [hasMetric, setHasMetric] = useState(plan?.metric_target != null);
  const [metricLabel, setMetricLabel] = useState(plan?.metric_label ?? "");
  const [metricTarget, setMetricTarget] = useState(plan?.metric_target != null ? String(plan.metric_target) : "");
  const [metricCurrent, setMetricCurrent] = useState(plan?.metric_current != null ? String(plan.metric_current) : "0");
  const [startsOn, setStartsOn] = useState(plan?.starts_on ?? defaults.startsOn);
  const [endsOn, setEndsOn] = useState(plan?.ends_on ?? defaults.endsOn);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<((go: boolean) => void) | null>(null);

  useRegister(register, async () => {
    setError(null);
    try {
      cleanTitle(title);
      if (!outcome.trim()) throw new Error("Describe the outcome you want this season.");
      const datesError = planDatesError(startsOn, endsOn, seasonBounds);
      if (datesError) throw new Error(datesError);
      if (hasMetric && !(Number(metricTarget) > 0)) throw new Error("Give the metric a target above zero, or turn the metric off.");

      const datesChanged = !plan || plan.starts_on !== startsOn || plan.ends_on !== endsOn;
      if (datesChanged && (!goal || goal.status === "active")) {
        const spans = await getActivePlanSpans();
        const candidate = { goal_id: goal?.id ?? "__new__", starts_on: startsOn, ends_on: endsOn };
        if (wouldExceedConcurrentGoals(spans, candidate)) {
          const go = await new Promise<boolean>((resolve) => setWarning(() => resolve));
          setWarning(null);
          if (!go) return null;
        }
      }

      const basics: GoalBasics = {
        title,
        area_id: areaId || null,
        outcome,
        metric_label: hasMetric ? metricLabel : null,
        metric_target: hasMetric ? Number(metricTarget) : null,
        metric_current: hasMetric ? Number(metricCurrent) || 0 : null,
        starts_on: startsOn,
        ends_on: endsOn,
      };
      if (goal) {
        await updateGoalBasics(goal.id, seasonId, basics);
        return goal.id;
      }
      return (await createGoal(seasonId, basics)).goal.id;
    } catch (e) {
      setError(message(e));
      return null;
    }
  });

  return (
    <>
      <Prompt title="What do you want?" body="Name the goal and the outcome that would make this season a success." />
      <ErrorText error={error} />
      <TextField id="goal-title" label="Goal" value={title} onChange={(e) => setTitle(e.target.value)} example="e.g. Publish my research proposal" />
      <div className="mb-4">
        <label htmlFor="goal-area" className="mb-1 block text-caption text-text-muted">
          Area (optional)
        </label>
        <select id="goal-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} className={`${controlClass} min-h-11`}>
          <option value="">No area</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <TextArea
        id="goal-outcome"
        label="Outcome this season"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        example="e.g. A complete proposal submitted to the committee"
      />
      <div className="mb-4 flex min-h-11 items-center justify-between">
        <span>Measure it with a number</span>
        <Switch label="Measure it with a number" checked={hasMetric} onChange={setHasMetric} />
      </div>
      {hasMetric ? (
        <div className="mb-2 rounded-card border border-border p-3 pb-0">
          <TextField id="metric-label" label="What you count" value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)} example="e.g. Pages drafted" />
          <div className="grid grid-cols-2 gap-3">
            <TextField id="metric-current" label="Now" type="number" inputMode="decimal" value={metricCurrent} onChange={(e) => setMetricCurrent(e.target.value)} />
            <TextField id="metric-target" label="Target" type="number" inputMode="decimal" value={metricTarget} onChange={(e) => setMetricTarget(e.target.value)} example="e.g. 40" />
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <TextField id="goal-start" label="Start" type="date" min={seasonBounds.starts_on} max={seasonBounds.ends_on} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        <TextField id="goal-end" label="End" type="date" min={seasonBounds.starts_on} max={seasonBounds.ends_on} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
      </div>
      <p className="text-caption text-text-muted">Both dates sit inside the season, {formatDateRange(seasonBounds.starts_on, seasonBounds.ends_on)}.</p>

      <ConfirmSheet
        open={warning !== null}
        title="That's a lot at once"
        body={CONCURRENT_WARNING}
        confirmLabel="Save anyway"
        cancelLabel="Change dates"
        onConfirm={() => warning?.(true)}
        onClose={() => warning?.(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// 2. Why

export function WhyStep({ register, goal }: StepBase & { goal: Goal }) {
  const [why, setWhy] = useState(goal.why ?? "");
  const [anti, setAnti] = useState<string[]>(goal.anti_goals.length ? goal.anti_goals : [""]);
  const [error, setError] = useState<string | null>(null);

  useRegister(register, async () => {
    try {
      await updateGoalWhy(goal.id, why, anti);
      return goal.id;
    } catch (e) {
      setError(message(e));
      return null;
    }
  });

  return (
    <>
      <Prompt title="Why does it matter?" body="A clear why carries you through the weeks when it is hard. Anti-goals name what you will not trade for it." />
      <ErrorText error={error} />
      <TextArea id="goal-why" label="Why it matters" rows={4} value={why} onChange={(e) => setWhy(e.target.value)} example="e.g. It unlocks funding for the next two years of my work." />
      <fieldset className="mb-4">
        <legend className="mb-1 text-caption text-text-muted">Anti-goals</legend>
        {anti.map((a, i) => (
          <div key={i} className="mb-2 flex items-center gap-1">
            <label htmlFor={`anti-${i}`} className="sr-only">
              Anti-goal {i + 1}
            </label>
            <input
              id={`anti-${i}`}
              value={a}
              onChange={(e) => setAnti(anti.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${controlClass} min-h-11 flex-1`}
            />
            <RemoveButton label={`Remove anti-goal ${i + 1}`} onClick={() => setAnti(anti.filter((_, j) => j !== i))} />
          </div>
        ))}
        <p className="mb-2 text-caption text-text-muted italic">e.g. Not at the cost of weekend family time.</p>
        <Button onClick={() => setAnti([...anti, ""])}>Add an anti-goal</Button>
      </fieldset>
    </>
  );
}

// ---------------------------------------------------------------------------
// 3. Plan: major moves

export function PlanStep(props: StepBase & { plan: SeasonPlan }) {
  const moves = useMajorMoves(props.plan.id);
  if (!moves) return null;
  return <PlanForm {...props} initial={moves} />;
}

function PlanForm({ register, plan, initial }: StepBase & { plan: SeasonPlan; initial: MajorMove[] }) {
  const [items, setItems] = useState<{ id?: string; title: string }[]>(
    initial.length ? initial.map((m) => ({ id: m.id, title: m.title })) : [{ title: "" }, { title: "" }, { title: "" }],
  );
  const [error, setError] = useState<string | null>(null);

  useRegister(register, async () => {
    try {
      await saveMajorMoves(plan.id, items);
      return plan.goal_id;
    } catch (e) {
      setError(message(e));
      return null;
    }
  });

  return (
    <>
      <Prompt title="How will you get there?" body="Three to five major moves: the big steps that deliver the outcome." />
      <ErrorText error={error} />
      <ol>
        {items.map((m, i) => (
          <li key={m.id ?? `new-${i}`} className="mb-2 flex items-center gap-2">
            <span aria-hidden="true" className="w-5 text-center text-text-muted">
              {i + 1}
            </span>
            <label htmlFor={`move-${i}`} className="sr-only">
              Major move {i + 1}
            </label>
            <input
              id={`move-${i}`}
              value={m.title}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              className={`${controlClass} min-h-11 flex-1`}
            />
            <RemoveButton label={`Remove major move ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ol>
      <p className="mb-3 text-caption text-text-muted italic">e.g. 1 Review the literature · 2 Draft the methods · 3 Write and submit</p>
      {items.length < MAX_MAJOR_MOVES ? <Button onClick={() => setItems([...items, { title: "" }])}>Add a major move</Button> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// 4. Reality check

export function RealityStep({ register, plan }: StepBase & { plan: SeasonPlan }) {
  const [confidence, setConfidence] = useState(plan.confidence_pct ?? 70);
  const [obstacles, setObstacles] = useState<Obstacle[]>(plan.obstacles.length ? plan.obstacles : [{ obstacle: "", mitigation: "" }]);
  const [error, setError] = useState<string | null>(null);

  useRegister(register, async () => {
    try {
      await updateRealityCheck(plan.id, confidence, obstacles);
      return plan.goal_id;
    } catch (e) {
      setError(message(e));
      return null;
    }
  });

  const set = (i: number, patch: Partial<Obstacle>) => setObstacles(obstacles.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <>
      <Prompt title="Reality check" body="How sure are you that you'll hit the outcome by the end date? What could get in the way?" />
      <ErrorText error={error} />
      <div className="mb-6">
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="confidence" className="text-caption text-text-muted">
            Confidence
          </label>
          <span className="text-heading">{confidence}%</span>
        </div>
        <input
          id="confidence"
          type="range"
          min={0}
          max={100}
          step={5}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="h-11 w-full accent-accent"
        />
        {confidence < CONFIDENCE_HINT_BELOW ? (
          <p className="mt-1 rounded-block border border-warning/60 p-3 text-caption text-warning">
            Below {CONFIDENCE_HINT_BELOW}%, consider shrinking the outcome or moving the end date until you feel sure.
          </p>
        ) : null}
      </div>
      <fieldset>
        <legend className="mb-2 text-caption text-text-muted">Obstacles and how you&apos;ll handle them</legend>
        {obstacles.map((o, i) => (
          <div key={i} className="mb-3 rounded-card border border-border p-3 pb-0">
            <div className="flex items-start gap-1">
              <div className="flex-1">
                <TextField id={`obstacle-${i}`} label={`Obstacle ${i + 1}`} value={o.obstacle} onChange={(e) => set(i, { obstacle: e.target.value })} />
              </div>
              <RemoveButton label={`Remove obstacle ${i + 1}`} onClick={() => setObstacles(obstacles.filter((_, j) => j !== i))} />
            </div>
            <TextField id={`mitigation-${i}`} label="So I will" value={o.mitigation} onChange={(e) => set(i, { mitigation: e.target.value })} />
          </div>
        ))}
        <p className="mb-3 text-caption text-text-muted italic">e.g. Teaching weeks eat my mornings → Book two early blocks before classes.</p>
        {obstacles.length < MAX_OBSTACLES ? (
          <Button onClick={() => setObstacles([...obstacles, { obstacle: "", mitigation: "" }])}>Add an obstacle</Button>
        ) : null}
      </fieldset>
    </>
  );
}

// ---------------------------------------------------------------------------
// 5. System: first actions

export function SystemStep({ register, goal, plan }: StepBase & { goal: Goal; plan: SeasonPlan }) {
  const actions = (useActionsForGoal(goal.id) ?? []).filter((a) => a.status === "todo" && !a.recurrence_rule_id);
  const moves = useMajorMoves(plan.id) ?? [];
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState(1);
  const [moveId, setMoveId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = async (): Promise<boolean> => {
    setError(null);
    const submitted = title;
    try {
      await addAction({ title: submitted, goal_id: goal.id, major_move_id: moveId || null, estimate_pomodoros: estimate });
      // Clear only what was submitted: text typed while saving stays.
      setTitle((t) => (t === submitted ? "" : t));
      setEstimate(1);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    }
  };

  // A title typed but not added yet is added on Finish rather than lost.
  useRegister(register, async () => (title.trim() && !(await add()) ? null : goal.id));

  const moveName = new Map(moves.map((m) => [m.id, m.title]));

  return (
    <>
      <Prompt title="First actions" body="What are the first concrete steps? Size each in pomodoros of 25 minutes." />
      <ErrorText error={error} />
      {actions.length ? (
        <ul className="mb-4">
          {actions.map((a) => (
            <li key={a.id} className="mb-2 flex min-h-12 items-center gap-2 rounded-card border border-border bg-surface pl-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{a.title}</span>
                <span className="flex gap-2 text-caption text-text-muted">
                  <PomodoroDots completed={0} total={a.estimate_pomodoros} className="text-accent" />
                  {a.major_move_id && moveName.get(a.major_move_id) ? <span className="truncate">{moveName.get(a.major_move_id)}</span> : null}
                </span>
              </span>
              <RemoveButton label={`Remove ${a.title}`} onClick={() => void deleteAction(a.id)} />
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="rounded-card border border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <TextField id="first-action" label="Action" value={title} onChange={(e) => setTitle(e.target.value)} example="e.g. Outline section 2 · ●●" />
        {moves.length ? (
          <div className="mb-4">
            <label htmlFor="first-action-move" className="mb-1 block text-caption text-text-muted">
              Major move
            </label>
            <select id="first-action-move" value={moveId} onChange={(e) => setMoveId(e.target.value)} className={`${controlClass} min-h-11`}>
              <option value="">No major move</option>
              {moves.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-caption text-text-muted">Estimate</span>
          <EstimateStepper value={estimate} onChange={setEstimate} />
        </div>
        <Button type="submit" block disabled={!title.trim()}>
          Add action
        </Button>
      </form>
      <h3 className="mt-6 mb-1 text-heading">Recurring actions</h3>
      <RuleList goalId={goal.id} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Finish

export function FinishStep({ goal, plan, register }: { goal: Goal; plan: SeasonPlan; register: StepBase["register"] }) {
  const moves = useMajorMoves(plan.id) ?? [];
  const actions = (useActionsForGoal(goal.id) ?? []).filter((a) => a.status === "todo" && !a.recurrence_rule_id);
  useRegister(register, null);
  const pomodoros = actions.reduce((n, a) => n + a.estimate_pomodoros, 0);

  const row = (label: string, value: React.ReactNode) => (
    <div className="border-b border-border py-3">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <>
      <Prompt title={goal.title} body="Here is your plan. You can change any of it from the goal's page." />
      <dl>
        {row("Outcome", plan.outcome)}
        {plan.metric_target ? row("Metric", `${plan.metric_label ?? "Progress"}: ${plan.metric_current ?? 0} of ${plan.metric_target}`) : null}
        {row("Dates", formatDateRange(plan.starts_on, plan.ends_on))}
        {row("Why", goal.why ?? <span className="text-text-muted">Not written</span>)}
        {row("Anti-goals", goal.anti_goals.length ? goal.anti_goals.join(" · ") : <span className="text-text-muted">None</span>)}
        {row(
          "Major moves",
          moves.length ? (
            <ol className="list-decimal pl-5">
              {moves.map((m) => (
                <li key={m.id}>{m.title}</li>
              ))}
            </ol>
          ) : (
            <span className="text-text-muted">None yet</span>
          ),
        )}
        {row("Confidence", plan.confidence_pct === null ? <span className="text-text-muted">Not set</span> : `${plan.confidence_pct}%`)}
        {row(
          "Obstacles",
          plan.obstacles.length ? (
            <ul>
              {plan.obstacles.map((o, i) => (
                <li key={i}>
                  {o.obstacle} → {o.mitigation || <span className="text-text-muted">no plan yet</span>}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-text-muted">None listed</span>
          ),
        )}
        {row("First actions", actions.length ? `${actions.length} · ${pomodoros} ${pomodoros === 1 ? "pomodoro" : "pomodoros"}` : <span className="text-text-muted">None yet</span>)}
      </dl>
    </>
  );
}
