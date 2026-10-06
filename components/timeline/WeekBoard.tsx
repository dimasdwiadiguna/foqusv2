"use client";

import { useRef, useState } from "react";
import { useBlocksForDays, useSettings, useWeekList } from "@/data";
import { parseDate, toLocalDate, weekDates, weekdayOf, weekdayShort } from "@/lib/time";
import { DayTimeline, type TimelineHandle } from "./DayTimeline";
import { DraftBar, DraftButton, useDraftBlocks } from "./DraftBar";
import { DAY_MINUTES, GUTTER_PX, MINUTE_PX } from "./geometry";
import { usePlacement } from "./PlacementProvider";
import { AddBlockSheet } from "./TimelineBoard";
import { chunkFor, TrayRow, useTrayItems, type TrayItem } from "./Tray";
import type { Point } from "./useDragGesture";

/**
 * Plan on desktop (§6.11): the week's seven days as columns sharing one hour gutter, with the tray
 * as a right-hand panel ("Draft my week" and the draft bar at its top). Drag a tray item onto any
 * column to create a block; everything else works as on the phone (tap a block, long-press to
 * move, the bottom handle to resize, tap empty time to add).
 */
export function WeekBoard({ date, today, weekStart, planning }: { date: string; today: string; weekStart: string; planning: boolean }) {
  const settings = useSettings();
  const { place } = usePlacement();
  const days = weekDates(date);
  const handles = useRef<(TimelineHandle | null)[]>([]);
  const columns = useRef<(HTMLDivElement | null)[]>([]);
  const dragging = useRef<TrayItem | null>(null);
  const [ghost, setGhost] = useState<{ title: string; point: Point } | null>(null);
  const [addAt, setAddAt] = useState<number | null>(null);
  const max = settings?.max_pomodoros_per_block ?? 4;
  // The page scrolls to now in today's column, or to the start of the first day.
  const scrollIndex = Math.max(0, days.indexOf(today));

  const columnAt = (p: Point) =>
    columns.current.findIndex((el) => {
      const r = el?.getBoundingClientRect();
      return r ? p.x >= r.left && p.x <= r.right : false;
    });
  const over = (p: Point) => {
    const item = dragging.current;
    if (!item) return;
    setGhost({ title: item.action.title, point: p });
    const i = columnAt(p);
    handles.current.forEach((h, j) => (j === i ? h?.dragOver(p, chunkFor(item, max), item.action.title) : h?.dragClear()));
  };
  const drag = {
    onStart: (item: TrayItem, p: Point) => {
      dragging.current = item;
      over(p);
    },
    onMove: over,
    onEnd: (p: Point, cancelled: boolean) => {
      const item = dragging.current;
      dragging.current = null;
      setGhost(null);
      const i = columnAt(p);
      const start = item && i >= 0 ? handles.current[i]?.pointToStart(p, chunkFor(item, max)) : null;
      handles.current.forEach((h) => h?.dragClear());
      if (!item || cancelled || start === null || start === undefined) return;
      void place(item.action, { start, pomodoros: chunkFor(item, max) });
    },
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-5">
      <div className="min-w-0">
        <div className="grid" style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(7, minmax(0, 1fr))` }}>
          <div aria-hidden="true" className="relative" style={{ height: DAY_MINUTES * MINUTE_PX }}>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="absolute right-1 -translate-y-2.5 text-[12px] text-text-muted" style={{ top: h * 60 * MINUTE_PX }}>
                {`${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>
          {days.map((d, i) => (
            <div
              key={d}
              ref={(el) => {
                columns.current[i] = el;
              }}
              className={`min-w-0 border-l border-border/60 ${d === today ? "bg-surface/40" : ""}`}
            >
              <DayTimeline
                date={d}
                gutter={false}
                autoScroll={i === scrollIndex}
                onAddAt={setAddAt}
                handleRef={(h) => {
                  handles.current[i] = h;
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <aside aria-label="Tray" className="sticky top-24 flex max-h-[calc(100dvh-8rem)] flex-col self-start overflow-hidden rounded-card border border-border bg-surface">
        <TrayPanel weekStart={weekStart} date={date} planning={planning} drag={drag} />
      </aside>
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
    </div>
  );
}

function TrayPanel({ weekStart, date, planning, drag }: { weekStart: string; date: string; planning: boolean; drag: Parameters<typeof TrayRow>[0]["drag"] }) {
  const items = useTrayItems(weekStart);
  const list = useWeekList(weekStart);
  const drafts = useDraftBlocks(planning ? weekStart : undefined);
  if (!items) return null;
  return (
    <>
      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-border py-1 pr-1 pl-3">
        <h2 className="font-semibold">
          Tray <span className="text-text-muted">({items.length})</span>
        </h2>
        {planning && !(drafts && drafts.length) ? <DraftButton weekStart={weekStart} unscheduled={items.length} /> : null}
      </div>
      {planning && drafts && drafts.length ? <DraftBar weekStart={weekStart} drafted={drafts.length} /> : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-success">{list && list.length > 0 ? "Everything this week has a time." : "Nothing on this week's list yet."}</p>
        ) : (
          <>
            <p className="mb-2 text-caption text-text-muted">Drag onto a day, or click to pick a time.</p>
            <ul>
              {items.map((item) => (
                <TrayRow key={item.action.id} item={item} date={date} drag={drag} />
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

/** Column headings for the desktop week: day, date, and planned pomodoros (over the cap in red). */
export function WeekHeadings({ date, today }: { date: string; today: string }) {
  const settings = useSettings();
  const days = weekDates(date);
  const blocks = useBlocksForDays(days[0], days[6], settings?.timezone);
  return (
    // Lined up with the columns below: the tray panel (300 px + the 20 px gap) sits to their right.
    <div className="grid pb-1" style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(7, minmax(0, 1fr))`, paddingRight: 320 }}>
      <span />
      {days.map((d) => {
        const n = (blocks ?? [])
          .filter((b) => b.status !== "missed" && settings && toLocalDate(b.starts_at, settings.timezone) === d)
          .reduce((x, b) => x + b.planned_pomodoros, 0);
        const over = settings ? n > settings.daily_pomodoro_cap : false;
        return (
          <div key={d} className={`px-2 text-center ${d === today ? "text-accent" : ""}`}>
            <span className="block text-caption font-semibold">
              {weekdayShort(weekdayOf(d))} {parseDate(d).day}
            </span>
            <span className={`text-[12px] ${over ? "font-bold text-danger" : "text-text-muted"}`}>
              {n} {over ? "!" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
