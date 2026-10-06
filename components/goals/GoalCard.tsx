import Link from "next/link";
import { formatShortDate } from "@/lib/time";
import type { Goal, SeasonPlan } from "@/types";
import type { PlanStrength } from "@/lib/plan-strength";
import { StrengthBadge } from "@/components/coach/Strength";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { DragHandle, type SortableRenderProps } from "@/components/ui/Sortable";

/** A goal in the Goals list: rank, title, area color, plan strength, progress ring, end date (§6.7). */
export function GoalCard({
  goal,
  plan,
  color,
  progress,
  href,
  setupUnfinished,
  sortable,
  strength,
}: {
  strength?: PlanStrength;
  goal: Goal;
  plan: SeasonPlan;
  color: string;
  progress: number;
  href: string;
  setupUnfinished?: boolean;
  sortable?: SortableRenderProps;
}) {
  const closed = goal.status !== "active";
  return (
    <div
      className={`flex items-center gap-2 overflow-hidden rounded-card border border-border bg-surface pr-3 ${closed ? "opacity-70" : ""}`}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      {sortable ? <DragHandle label={`Change rank of ${goal.title}`} handleProps={sortable.handleProps} /> : <span className="w-2" />}
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 py-2" draggable={false}>
        {!closed ? (
          <span
            aria-label={`Rank ${goal.rank}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-caption"
          >
            {goal.rank}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-heading">{goal.title}</span>
          <span className="flex flex-wrap gap-x-2 text-caption text-text-muted">
            {goal.status === "achieved" ? <span className="text-success">Achieved</span> : null}
            {goal.status === "dropped" ? <span>Dropped</span> : null}
            {!closed && strength ? <StrengthBadge goalId={goal.id} strength={strength} /> : null}
            {!closed ? <span>ends {formatShortDate(plan.ends_on)}</span> : null}
            {setupUnfinished ? <span className="text-accent">Setup unfinished</span> : null}
          </span>
        </span>
        <ProgressRing value={progress} color={color} label="Progress" />
      </Link>
    </div>
  );
}
