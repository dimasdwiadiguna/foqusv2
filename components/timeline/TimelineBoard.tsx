"use client";

import { useRef, useState } from "react";
import { useBlocksForActions, useNow, useRows, useSettings } from "@/data";
import { actionNumbers } from "@/lib/actions";
import { toLocalTime } from "@/lib/time";
import type { Action } from "@/types";
import { Sheet } from "@/components/ui/Sheet";
import { DayTimeline, type TimelineHandle } from "./DayTimeline";
import { usePlacement } from "./PlacementProvider";
import { chunkFor, Tray, useTrayItems, type TrayItem } from "./Tray";
import type { Point } from "./useDragGesture";

/**
 * A day timeline with this week's tray under it. Owns the tray-to-timeline drag (§6.8: drag an
 * action from the tray onto the timeline to create a block) and the "Add block here" picker.
 */
export function TimelineBoard({
  date,
  weekStart,
  trayOpen,
  onTrayOpenChange,
  onSwipeDay,
}: {
  date: string;
  weekStart: string | undefined;
  trayOpen: boolean;
  onTrayOpenChange: (open: boolean) => void;
  onSwipeDay?: (delta: 1 | -1) => void;
}) {
  const settings = useSettings();
  const { place } = usePlacement();
  const timeline = useRef<TimelineHandle>(null);
  const dragging = useRef<TrayItem | null>(null);
  const [ghost, setGhost] = useState<{ title: string; point: Point } | null>(null);
  const [addAt, setAddAt] = useState<number | null>(null);
  const max = settings?.max_pomodoros_per_block ?? 4;

  const drag = {
    onStart: (item: TrayItem, p: Point) => {
      dragging.current = item;
      onTrayOpenChange(false);
      setGhost({ title: item.action.title, point: p });
      timeline.current?.dragOver(p, chunkFor(item, max), item.action.title);
    },
    onMove: (p: Point) => {
      const item = dragging.current;
      if (!item) return;
      setGhost({ title: item.action.title, point: p });
      timeline.current?.dragOver(p, chunkFor(item, max), item.action.title);
    },
    onEnd: (p: Point, cancelled: boolean) => {
      const item = dragging.current;
      dragging.current = null;
      setGhost(null);
      const start = item ? timeline.current?.pointToStart(p, chunkFor(item, max)) : null;
      timeline.current?.dragClear();
      if (!item || cancelled || start === null || start === undefined) return;
      void place(item.action, { start, pomodoros: chunkFor(item, max) });
    },
  };

  return (
    <>
      <DayTimeline date={date} handleRef={timeline} onSwipeDay={onSwipeDay} onAddAt={setAddAt} />
      <Tray weekStart={weekStart} date={date} open={trayOpen} onOpenChange={onTrayOpenChange} drag={drag} />
      {ghost ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 max-w-60 -translate-x-1/2 -translate-y-[130%] truncate rounded-full bg-accent px-3 py-1.5 text-caption font-semibold text-bg shadow-xl"
          style={{ left: ghost.point.x, top: ghost.point.y }}
        >
          {ghost.title}
        </div>
      ) : null}
      <AddBlockSheet
        start={addAt}
        weekStart={weekStart}
        onClose={() => setAddAt(null)}
        onPick={async (action, unscheduled) => {
          const start = addAt;
          setAddAt(null);
          if (start !== null) await place(action, { start, pomodoros: chunkFor({ unscheduled }, max) });
        }}
      />
    </>
  );
}

/** "Add block here" (§6.8): pick an action for the tapped time. This week's tray first, then other open actions. */
function AddBlockSheet({
  start,
  weekStart,
  onClose,
  onPick,
}: {
  start: number | null;
  weekStart: string | undefined;
  onClose: () => void;
  onPick: (action: Action, unscheduled: number) => void;
}) {
  const settings = useSettings();
  const tray = useTrayItems(weekStart) ?? [];
  const all = useRows("actions");
  const now = useNow(60_000);
  const others = (all ?? []).filter((a) => a.status === "todo" && !tray.some((t) => t.action.id === a.id));
  const blocks = useBlocksForActions(others.map((a) => a.id)) ?? [];
  const title = start !== null && settings ? `Add block at ${toLocalTime(start, settings.timezone)}` : "Add block";
  const row = (action: Action, unscheduled: number, sub: string) => (
    <li key={action.id}>
      <button type="button" onClick={() => onPick(action, unscheduled)} className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border text-left">
        <span className="min-w-0 truncate">{action.title}</span>
        <span className="shrink-0 text-caption text-text-muted">{sub}</span>
      </button>
    </li>
  );
  return (
    <Sheet open={start !== null} onClose={onClose} title={title}>
      {tray.length ? (
        <>
          <h3 className="text-caption uppercase tracking-wide text-text-muted">This week</h3>
          <ul className="mb-4">{tray.map((t) => row(t.action, t.unscheduled, `${t.unscheduled} to schedule`))}</ul>
        </>
      ) : null}
      {others.length ? (
        <details open={tray.length === 0}>
          <summary className="flex min-h-11 cursor-pointer items-center text-caption uppercase tracking-wide text-text-muted">Other open actions ({others.length})</summary>
          <ul>
            {others.map((a) => {
              const n = actionNumbers(a, blocks, new Date(now).toISOString()).unscheduled;
              return row(a, n, n > 0 ? `${n} to schedule` : "all scheduled");
            })}
          </ul>
        </details>
      ) : null}
      {tray.length === 0 && others.length === 0 ? <p className="text-text-muted">No open actions. Add one with + first.</p> : null}
    </Sheet>
  );
}
