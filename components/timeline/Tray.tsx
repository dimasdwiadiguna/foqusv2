"use client";

import { useMemo } from "react";
import {
  useAreas,
  useBlocksForActions,
  useNow,
  useRows,
  useWeekList,
} from "@/data";
import { actionNumbers } from "@/lib/actions";
import { sessionProgress } from "@/lib/sessions";
import { goalColor } from "@/lib/areas";
import type { Action } from "@/types";
import { ChevronDownIcon, RepeatIcon } from "@/components/shell/icons";
import { formatShortDate } from "@/lib/time";
import { PomodoroDots } from "@/components/ui/PomodoroDots";
import { DraftBar, DraftButton, useDraftBlocks } from "./DraftBar";
import { usePlacement } from "./PlacementProvider";
import { useDragGesture, type Point } from "./useDragGesture";

export interface TrayItem {
  action: Action;
  unscheduled: number;
  owner: string;
  color: string;
  /** For an action split into sessions: how many have a block. */
  sessions?: { total: number; scheduled: number } | null;
}

/**
 * This week's list, filtered to todo actions with unscheduled pomodoros (§5.4). An action leaves
 * the tray once all its remaining pomodoros have a block.
 */
export function useTrayItems(
  weekStart: string | undefined,
): TrayItem[] | undefined {
  const list = useWeekList(weekStart);
  const blocks = useBlocksForActions((list ?? []).map((a) => a.id));
  const goals = useRows("goals");
  const areas = useAreas(true);
  const now = useNow(60_000);
  return useMemo(() => {
    if (!list || !blocks) return undefined;
    const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));
    const areaMap = new Map((areas ?? []).map((a) => [a.id, a]));
    const iso = new Date(now).toISOString();
    return list
      .map((action) => {
        const goal = action.goal_id ? goalMap.get(action.goal_id) : undefined;
        const area = action.area_id ? areaMap.get(action.area_id) : undefined;
        return {
          action,
          unscheduled: actionNumbers(action, blocks, iso).unscheduled,
          sessions: sessionProgress(action, blocks),
          owner: goal?.title ?? area?.name ?? "",
          color: goal ? goalColor(goal, areaMap) : (area?.color ?? "#9AA3B2"),
          rank: goal?.rank ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .filter((i) => i.unscheduled > 0)
      .sort(
        (a, b) => a.rank - b.rank || a.action.sort_order - b.action.sort_order,
      );
  }, [list, blocks, goals, areas, now]);
}

/**
 * The tray (§6.7 Today): a bar above the navigation that expands upward. Long-press an item and
 * drag it onto the timeline to create a block; tap it to schedule it with a sheet instead.
 */
export function Tray({
  weekStart,
  date,
  open,
  onOpenChange,
  drag,
  planning = false,
}: {
  weekStart: string | undefined;
  /** Plan on the current week: the bar offers "Draft my week", and a draft replaces the tray. */
  planning?: boolean;
  /** The day shown on the timeline; the schedule sheet starts there. */
  date: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drag: {
    onStart: (item: TrayItem, p: Point) => void;
    onMove: (p: Point) => void;
    onEnd: (p: Point, cancelled: boolean) => void;
  };
}) {
  const items = useTrayItems(weekStart);
  const list = useWeekList(weekStart);
  const drafts = useDraftBlocks(planning ? weekStart : undefined);
  if (!items) return null;
  const drafting = planning && weekStart && drafts && drafts.length > 0;
  if (drafting) {
    return (
      <div className="sticky -bottom-6 z-30 -mx-4 mt-3 lg:-mx-6">
        <DraftBar weekStart={weekStart} drafted={drafts.length} />
      </div>
    );
  }

  return (
    <div className="sticky -bottom-6 z-30 -mx-4 mt-3 lg:-mx-6">
      {/* Hidden rather than unmounted when closed: a drag that starts here closes the tray but must keep running. */}
      <div
        id="tray-panel"
        hidden={!open}
        className="max-h-[45dvh] overflow-y-auto overscroll-contain rounded-t-sheet border-t border-border bg-surface px-4 pt-3 pb-2 shadow-2xl"
      >
        {items.length === 0 ? (
          <p className="py-4 text-center text-success">
            {list && list.length > 0
              ? "Everything this week has a time."
              : "Nothing on this week's list yet. Turn on “This week” for an action, or add one with +."}
          </p>
        ) : (
          <>
            <p className="mb-2 text-caption text-text-muted">
              Hold and drag onto the timeline, or tap to pick a time.
            </p>
            <ul>
              {items.map((item) => (
                <TrayRow
                  key={item.action.id}
                  item={item}
                  date={date}
                  drag={drag}
                />
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="flex items-center border-t border-border bg-surface">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="tray-panel"
          onClick={() => onOpenChange(!open)}
          className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 px-4 text-left"
        >
          <span className="truncate">
            {planning ? "Tray" : "Unscheduled this week"}{" "}
            <span className="text-text-muted">({items.length})</span>
          </span>
          <ChevronDownIcon
            className={`size-5 shrink-0 text-text-muted transition-transform ${open ? "" : "rotate-180"}`}
          />
        </button>
        {planning && weekStart ? <DraftButton weekStart={weekStart} unscheduled={items.length} /> : null}
      </div>
    </div>
  );
}

export function TrayRow({
  item,
  date,
  drag,
}: {
  item: TrayItem;
  date: string;
  drag: Parameters<typeof Tray>[0]["drag"];
}) {
  const { schedule } = usePlacement();
  const gesture = useDragGesture({
    touchDelay: 300,
    onStart: (p) => drag.onStart(item, p),
    onMove: drag.onMove,
    onEnd: drag.onEnd,
  });
  return (
    <li className="mb-2">
      <button
        type="button"
        {...gesture}
        onClick={() => schedule(item.action, date)}
        className="flex min-h-12 w-full touch-pan-y items-center gap-3 rounded-card border border-border bg-surface-raised px-3 py-2 text-left select-none [-webkit-touch-callout:none]"
        style={{ borderLeft: `4px solid ${item.color}` }}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate">
            {item.action.recurrence_rule_id ? <RepeatIcon className="size-3.5 shrink-0 text-text-muted" /> : null}
            <span className="truncate">{item.action.title}</span>
          </span>
          <span className="block truncate text-caption text-text-muted">
            {item.action.occurrence_date ? `${formatShortDate(item.action.occurrence_date)} · ` : ""}
            {item.sessions ? `${item.sessions.scheduled} of ${item.sessions.total} sessions · ` : ""}
            {item.owner}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end text-caption text-text-muted">
          <PomodoroDots
            completed={item.unscheduled}
            total={item.unscheduled}
            decorative
            className="text-accent"
          />
          <span>{item.unscheduled} to schedule</span>
        </span>
      </button>
    </li>
  );
}

/** Max pomodoros for a block created from an item: its session size when it has one. */
export function chunkFor(
  item: Pick<TrayItem, "unscheduled"> & { action?: Pick<Action, "session_pomodoros"> },
  maxPerBlock: number,
): number {
  return Math.min(Math.max(item.unscheduled, 1), item.action?.session_pomodoros ?? maxPerBlock, maxPerBlock);
}
