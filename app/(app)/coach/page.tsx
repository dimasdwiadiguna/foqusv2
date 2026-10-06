"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCompass, useInsights, useReview, useReviewDue, useStrengths, useToday } from "@/data";
import { principleFor } from "@/lib/coach";
import { reviewWeekFor } from "@/lib/review";
import { weekdayOf } from "@/lib/time";
import { dismissInsight, refreshCoach } from "@/repo";
import { DailyBrief } from "@/components/coach/DailyBrief";
import { ScoreBar, StrengthBadge } from "@/components/coach/Strength";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { CloseIcon } from "@/components/shell/icons";
import { IconButton } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

/** Coach (§6.7): the daily brief, a principle, insights, plan strength, and the way to reviews, check-ins, and Compass. */
export default function CoachPage() {
  const today = useToday();
  const insights = useInsights();
  const strengths = useStrengths();
  const due = useReviewDue();
  const compass = useCompass();
  // The week whose review this week is about (done or not), for the entry row.
  const week = today ? (due ?? reviewWeekFor(today)) : undefined;
  const review = useReview(week);

  // Insights are re-evaluated on open (§5.18); opening Coach is a good moment too.
  useEffect(() => {
    void refreshCoach().catch(() => undefined);
  }, []);

  if (!today || !insights || !strengths) return <ScreenSkeleton />;
  const reviewLabel = due ? (review && review.step > 0 ? "Resume" : "Start") : review?.completed_at ? "Done" : weekdayOf(today) === 7 ? "Start" : "Opens Sunday";

  return (
    <>
      <ScreenHeader title="Coach" />
      <section aria-label="Daily brief" className="mb-3 rounded-card border border-border bg-surface px-3 py-2">
        <DailyBrief className="!text-text" />
      </section>
      <section aria-label="Principle" className="mb-4 rounded-card border-l-4 border-accent bg-surface px-3 py-2">
        <p className="italic">{principleFor(today)}</p>
      </section>

      <section aria-labelledby="insights" className="mb-5">
        <h2 id="insights" className="mb-1.5 px-1 text-caption tracking-wide text-text-muted uppercase">
          Insights
        </h2>
        {insights.length === 0 ? (
          <p className="rounded-card border border-border bg-surface px-3 py-3 text-text-muted">Nothing needs your attention. Keep going.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {insights.map((m) => (
              <li key={m.id} className={`rounded-card border bg-surface py-2 pr-1 pl-3 ${m.rule_code === "STRONG_WEEK" ? "border-success/60" : "border-border"}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.title}</p>
                    <p className="text-caption text-text-muted">{m.body}</p>
                  </div>
                  <IconButton label={`Dismiss: ${m.title}`} onClick={() => void dismissInsight(m.id)} className="-mt-1 text-text-muted">
                    <CloseIcon className="size-5" />
                  </IconButton>
                </div>
                {m.action_link ? (
                  <Link href={m.action_link} className="mt-1 inline-flex min-h-11 items-center rounded-full border border-border bg-surface-raised px-4">
                    {actionLabel(m.rule_code)}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {strengths.length ? (
        <section aria-labelledby="strengths" className="mb-5">
          <h2 id="strengths" className="mb-1.5 px-1 text-caption tracking-wide text-text-muted uppercase">
            Plan strength
          </h2>
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {strengths.map(({ goal, strength }) => (
              <li key={goal.id}>
                <Link href={`/goals/goal?id=${encodeURIComponent(goal.id)}`} className="flex min-h-12 items-center gap-3 px-3 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{goal.title}</span>
                    <ScoreBar value={strength.total} max={100} band={strength.band} />
                  </span>
                  <StrengthBadge goalId={goal.id} strength={strength} className="w-24 justify-end text-caption" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-label="Reflection" className="divide-y divide-border rounded-card border border-border bg-surface">
        <Row href={due ? `/review?week=${due}` : review?.completed_at ? `/review?week=${week}` : null} label="Weekly review" detail={reviewLabel} accent={Boolean(due)} />
        <Row href="/coach/reviews" label="Past reviews" />
        <Row href="/coach/checkins" label="Check-in history" />
        <Row href="/coach/compass" label="Compass" detail={compass?.vision ? undefined : "Write your vision"} />
      </nav>
    </>
  );
}

function Row({ href, label, detail, accent = false }: { href: string | null; label: string; detail?: string; accent?: boolean }) {
  const body = (
    <>
      <span className="flex-1">{label}</span>
      {detail ? <span className={`text-caption ${accent ? "font-semibold text-accent" : "text-text-muted"}`}>{detail}</span> : null}
      {href ? (
        <span aria-hidden="true" className="text-text-muted">
          ›
        </span>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className="flex min-h-12 items-center gap-3 px-3">
      {body}
    </Link>
  ) : (
    <div className="flex min-h-12 items-center gap-3 px-3">{body}</div>
  );
}

const LABELS: Record<string, string> = {
  REVIEW_DUE: "Start the review",
  MISSED_CHECKIN: "Check in",
  OVERBOOKED: "Open Plan",
  DEADLINE_RISK: "Open the goal",
  GOAL_STARVED: "Schedule a block",
  WEAK_PLAN: "Improve it",
  LOW_FOLLOW_THROUGH: "Open Plan",
  LOW_ENERGY: "Lighten tomorrow",
  PEAK_MISUSE: "Open Plan",
  LOW_GOAL_SHARE: "Open Plan",
  CHRONIC_RESCHEDULE: "Open the tray",
  TOO_MANY_GOALS: "Open Goals",
};
const actionLabel = (code: string | null) => (code && LABELS[code]) || "Open";
