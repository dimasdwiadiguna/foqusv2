"use client";

import { useRef } from "react";
import { completeAction, reopenAction } from "@/repo";
import { formatShortDate } from "@/lib/time";
import type { Action } from "@/types";
import { celebrate } from "@/components/celebration/celebrate";
import { PomodoroDots } from "@/components/ui/PomodoroDots";
import { RepeatIcon } from "@/components/shell/icons";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { DragHandle, type SortableRenderProps } from "@/components/ui/Sortable";
import { usePlacement } from "@/components/timeline/PlacementProvider";

/** Mark done with confetti from the row (§5.4, §5.19). */
export async function markDone(action: Pick<Action, "id">, origin?: Element | null) {
  await completeAction(action.id);
  void celebrate("action", origin);
}

/**
 * One action: a check circle (tap to mark done), the title, and its dots, due date, and week tag.
 * Swipe right marks it done; swipe left schedules it (§6.8). Tap opens the edit sheet.
 */
export function ActionRow({
  action,
  completed,
  weekStart,
  subtitle,
  onOpen,
  sortable,
  readOnly = false,
}: {
  action: Action;
  completed: number;
  weekStart: string | undefined;
  /** Extra context, e.g. the goal or area name. */
  subtitle?: string;
  onOpen: (action: Action) => void;
  sortable?: SortableRenderProps;
  readOnly?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const { schedule } = usePlacement();
  const done = action.status === "done";
  const dropped = action.status === "dropped";
  const open = action.status === "todo";

  const body = (
    <div ref={row} className="flex min-h-12 items-center gap-1 bg-surface pr-2 pl-1">
      {sortable && !readOnly ? <DragHandle label={`Reorder ${action.title}`} handleProps={sortable.handleProps} /> : <span className="w-2" />}
      <button
        type="button"
        disabled={readOnly || dropped}
        aria-label={done ? `Reopen ${action.title}` : `Mark ${action.title} done`}
        aria-pressed={done}
        onClick={() => (done ? reopenAction(action.id) : markDone(action, row.current))}
        className="flex size-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex size-6 items-center justify-center rounded-full border-2 ${
            done ? "border-success bg-success text-bg" : "border-text-muted"
          }`}
        >
          {done ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
          ) : null}
        </span>
      </button>
      <button type="button" onClick={() => onOpen(action)} className="min-w-0 flex-1 py-1.5 text-left">
        <span className={`block truncate ${open ? "" : "text-text-muted line-through"}`}>{action.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-text-muted">
          <PomodoroDots completed={completed} total={action.estimate_pomodoros} className="text-accent" />
          {action.recurrence_rule_id ? (
            <span className="inline-flex items-center gap-0.5">
              <RepeatIcon className="size-3.5" />
              <span className="sr-only">Recurring,</span>
              {action.occurrence_date ? formatShortDate(action.occurrence_date) : null}
            </span>
          ) : null}
          {dropped ? <span>Dropped</span> : null}
          {action.due_on ? <span>Due {formatShortDate(action.due_on)}</span> : null}
          {open && action.planned_week && action.planned_week === weekStart ? (
            <span className="rounded-full border border-border px-2">This week</span>
          ) : null}
          {open && action.planned_week && weekStart && action.planned_week !== weekStart ? (
            <span>Week of {formatShortDate(action.planned_week)}</span>
          ) : null}
          {subtitle ? <span className="truncate">{subtitle}</span> : null}
        </span>
      </button>
    </div>
  );

  if (!open || readOnly) return <div className="overflow-hidden rounded-card">{body}</div>;
  return (
    <SwipeRow
      label="Done"
      onSwipeRight={() => markDone(action, row.current)}
      onSwipeLeft={() => schedule(action)}
      cancel={sortable?.isDragging}
    >
      {body}
    </SwipeRow>
  );
}
