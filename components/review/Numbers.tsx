"use client";

import type { ReviewSnapshot } from "@/data";
import { TARGET_FOLLOW_THROUGH, TARGET_GOAL_SHARE } from "@/lib/stats";
import { CheckCircleIcon, FlameIcon } from "@/components/shell/icons";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

/**
 * The review's numbers (§5.15, §6.7): a large follow-through percentage, pomodoros done vs planned,
 * goal share as a two-part bar, hours per goal and area as horizontal bars, average energy and
 * focus, rescheduled and dropped blocks, per-goal plan strength and metric, and streaks. Health
 * targets sit beside the two rates.
 */
export function Numbers({ s }: { s: ReviewSnapshot }) {
  const ftOk = s.follow_through !== null && s.follow_through >= TARGET_FOLLOW_THROUGH;
  const shareOk = s.goal_share !== null && s.goal_share >= TARGET_GOAL_SHARE;
  const maxHours = Math.max(...s.hours.map((h) => h.hours), 0.1);
  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Follow-through" className="rounded-card border border-border bg-surface px-3 py-3 text-center">
        <p className={`text-[56px] leading-none font-bold tabular-nums ${s.follow_through === null ? "text-text-muted" : ftOk ? "text-success" : "text-warning"}`}>{pct(s.follow_through)}</p>
        <p className="mt-1">follow-through</p>
        <p className="text-caption text-text-muted">Target 70% or more · {s.completed} of {s.planned} pomodoros done</p>
      </section>

      <section aria-label="Goal share" className="rounded-card border border-border bg-surface px-3 py-2">
        <p className="flex justify-between">
          <span>Goal share</span>
          <span className={`font-semibold ${s.goal_share === null ? "text-text-muted" : shareOk ? "text-success" : "text-warning"}`}>{pct(s.goal_share)}</span>
        </p>
        <div aria-hidden="true" className="mt-1 flex h-2 overflow-hidden rounded-full bg-border">
          <span className="block h-full bg-accent" style={{ width: `${(s.goal_share ?? 0) * 100}%` }} />
          <span className="block h-full bg-text-muted/50" style={{ width: `${s.goal_share === null ? 0 : (1 - s.goal_share) * 100}%` }} />
        </div>
        <p className="mt-1 flex justify-between text-caption text-text-muted">
          <span>Goals</span>
          <span>Target 30% or more</span>
          <span>Areas</span>
        </p>
      </section>

      {s.hours.length ? (
        <section aria-labelledby="hours" className="rounded-card border border-border bg-surface px-3 py-2">
          <h3 id="hours" className="mb-1">
            Hours
          </h3>
          <ul className="flex flex-col gap-1.5">
            {s.hours.map((h) => (
              <li key={h.key} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-caption">
                <span className="truncate">{h.label}</span>
                <span aria-hidden="true" className="block h-2 rounded-full" style={{ width: `${(h.hours / maxHours) * 100}%`, background: h.color, opacity: h.kind === "goal" ? 1 : 0.6 }} />
                <span className="tabular-nums">{h.hours} h</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Avg energy" value={s.avg_energy === null ? "—" : `${s.avg_energy} / 5`} />
        <Stat label="Avg focus" value={s.avg_focus === null ? "—" : `${s.avg_focus} / 5`} />
        <Stat label="Rescheduled" value={String(s.rescheduled)} />
        <Stat label="Dropped" value={String(s.dropped)} />
      </dl>

      {s.goals.length ? (
        <section aria-labelledby="per-goal" className="rounded-card border border-border bg-surface px-3 py-2">
          <h3 id="per-goal" className="mb-1">
            Goals
          </h3>
          <ul className="divide-y divide-border">
            {s.goals.map((g) => (
              <li key={g.goal_id} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate">{g.title}</span>
                {g.metric_target !== null ? (
                  <span className="text-caption text-text-muted">
                    {g.metric_current ?? 0}/{g.metric_target} {g.metric_label ?? ""}
                  </span>
                ) : null}
                <span className="text-caption tabular-nums">
                  {g.strength}
                  {g.strength_change !== null && g.strength_change !== 0 ? (
                    <span className={g.strength_change > 0 ? "text-success" : "text-danger"}> {g.strength_change > 0 ? `+${g.strength_change}` : g.strength_change}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {s.habits?.length ? (
        <section aria-labelledby="review-habits" className="rounded-card border border-border bg-surface px-3 py-2">
          <h3 id="review-habits" className="mb-1">
            Habits
          </h3>
          <ul className="divide-y divide-border">
            {s.habits.map((h) => (
              <li key={h.habit_id} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate">{h.title}</span>
                <span className="text-caption tabular-nums">
                  {h.hit}/{h.expected} days
                  {h.hit ? <span className="text-text-muted"> · {[h.elite ? `${h.elite} Elite` : "", h.std ? `${h.std} Std` : "", h.min ? `${h.min} Min` : ""].filter(Boolean).join(" · ")}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="flex items-center gap-4 px-1 text-caption">
        <span className="flex items-center gap-1 text-success">
          <CheckCircleIcon className="size-4" /> {s.streaks.checkin}-day check-in streak
        </span>
        <span className="flex items-center gap-1 text-accent">
          <FlameIcon className="size-4" /> {s.streaks.focus}-day focus streak
        </span>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="text-heading tabular-nums">{value}</dd>
    </div>
  );
}
