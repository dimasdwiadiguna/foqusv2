"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useAreas, useBlocksForDays, useDaySchedule, useNow, usePersonalBlocks, useRows, useSettings } from "@/data";
import { goalColor } from "@/lib/areas";
import { blockSpan, daySpan, personalSpans, POMODORO_MINUTES, windowSpan } from "@/lib/availability";
import { MINUTE } from "@/lib/intervals";
import { overlappingBlock, snapMinutes } from "@/lib/placement";
import { formatDayHeader, todayIn, toLocalTime, weekdayOf } from "@/lib/time";
import type { Action } from "@/types";
import { BlockItem, type BlockView } from "./BlockItem";
import { DAY_MINUTES, EDGE_PX, GUTTER_PX, MINUTE_PX } from "./geometry";
import { usePlacement } from "./PlacementProvider";
import { scrollParent, type Point } from "./useDragGesture";
import { headerCover } from "@/components/ui/ScreenHeader";

export interface TimelineHandle {
  /** The start (epoch ms) a `pomodoros`-long block dropped at `p` would get, or null if `p` is off the timeline. */
  pointToStart: (p: Point, pomodoros: number) => number | null;
  /** An action from the tray is being dragged over `p`. */
  dragOver: (p: Point, pomodoros: number, title: string) => void;
  /** The tray drag ended or left. */
  dragClear: () => void;
}

type Preview = { blockId?: string; startMin: number; pomodoros: number; title: string };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * One day's timeline (§6.4, §6.8): hours, the dimmed time outside availability, the peak strip,
 * personal blocks, FOQUS blocks with buffers, and the now line. Blocks move by long-press drag and
 * resize by their bottom handle, both in 5-minute / whole-pomodoro steps; tapping empty time adds
 * a block there; a horizontal swipe changes the day.
 */
export function DayTimeline({
  date,
  onAddAt,
  onSwipeDay,
  handleRef,
}: {
  date: string;
  onAddAt?: (start: number) => void;
  onSwipeDay?: (delta: 1 | -1) => void;
  handleRef?: React.Ref<TimelineHandle>;
}) {
  const settings = useSettings();
  const tz = settings?.timezone;
  const now = useNow(30_000);
  const schedule = useDaySchedule(weekdayOf(date));
  const personal = usePersonalBlocks();
  const blocks = useBlocksForDays(date, date, tz);
  const actions = useRows("actions");
  const goals = useRows("goals");
  const areas = useAreas(true);
  const { place, openBlock } = usePlacement();
  const track = useRef<HTMLDivElement>(null);
  const [preview, setPreviewState] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const setPreview = (p: Preview | null) => {
    previewRef.current = p;
    setPreviewState(p);
  };
  const grab = useRef(0);
  const lastPoint = useRef<Point | null>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  /** Recomputes the preview from a pointer; re-run while auto-scrolling moves the timeline under it. */
  const recompute = useRef<(p: Point) => void>(() => {});
  const [trayDrag, setTrayDrag] = useState(false);

  const dayStart = tz ? daySpan(date, tz).start : 0;
  const toMin = (ms: number) => (ms - dayStart) / MINUTE;
  const pointerMinute = (p: Point) => (p.y - (track.current?.getBoundingClientRect().top ?? 0)) / MINUTE_PX;
  const isToday = tz ? todayIn(now, tz) === date : false;

  const startMinAt = (p: Point, pomodoros: number): number | null => {
    const r = track.current?.getBoundingClientRect();
    if (!r || p.x < r.left - GUTTER_PX || p.x > r.right || p.y < r.top || p.y > r.bottom) return null;
    const len = pomodoros * POMODORO_MINUTES;
    return clamp(snapMinutes(pointerMinute(p) - len / 2), 0, DAY_MINUTES - len);
  };

  useImperativeHandle(handleRef, () => ({
    pointToStart: (p, pomodoros) => {
      const m = startMinAt(p, pomodoros);
      return m === null ? null : dayStart + m * MINUTE;
    },
    dragOver: (p, pomodoros, title) => {
      lastPoint.current = p;
      recompute.current = (q) => {
        const m = startMinAt(q, pomodoros);
        setPreview(m === null ? null : { startMin: m, pomodoros, title });
      };
      recompute.current(p);
      setTrayDrag(true);
    },
    dragClear: () => {
      lastPoint.current = null;
      setPreview(null);
      setTrayDrag(false);
    },
  }));

  // Lookups for titles and colors.
  const views = useMemo<BlockView[]>(() => {
    if (!tz || !blocks) return [];
    const actionMap = new Map((actions ?? []).map((a) => [a.id, a]));
    const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));
    const areaMap = new Map((areas ?? []).map((a) => [a.id, a]));
    return blocks
      // Only this day's blocks: while a new day loads, the query can briefly return the previous day's.
      .filter((b) => b.status !== "missed" && toMin(Date.parse(b.starts_at)) >= 0 && toMin(Date.parse(b.starts_at)) < DAY_MINUTES)
      .map((block) => {
        const a = actionMap.get(block.action_id);
        const goal = a?.goal_id ? goalMap.get(a.goal_id) : undefined;
        const area = a?.area_id ? areaMap.get(a.area_id) : undefined;
        const span = blockSpan(block);
        return {
          block,
          title: a?.title ?? "Deleted action",
          owner: goal?.title ?? area?.name ?? "",
          color: goal ? goalColor(goal, areaMap) : (area?.color ?? "#9AA3B2"),
          isGoal: Boolean(a?.goal_id),
          startMin: toMin(span.start),
          endMin: toMin(span.end),
          timeLabel: `${toLocalTime(span.start, tz)} – ${toLocalTime(span.end, tz)}`,
          unresolved: block.status === "scheduled" && span.end < now,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dayStart follows date and tz
  }, [blocks, actions, goals, areas, tz, now, dayStart]);

  // Scroll to now (today) or to the start of the day's available hours, when the day changes.
  useEffect(() => {
    if (!tz || !schedule) return;
    const el = track.current;
    const container = scrollParent(el);
    if (!el || !container) return;
    const target = isToday ? toMin(now) - 60 : Math.min(toMin(windowSpan(date, schedule.availability, tz)?.start ?? dayStart + 8 * 60 * MINUTE), views[0]?.startMin ?? DAY_MINUTES) - 30;
    const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTop = Math.max(0, offset + Math.max(0, target) * MINUTE_PX - 16 - headerCover(container));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new day or once data arrives
  }, [date, tz, Boolean(schedule)]);

  // Auto-scroll near the edges while a block or a tray item is dragged.
  const dragging = preview !== null || trayDrag;
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const tick = () => {
      const p = lastPoint.current;
      const container = scrollParent(track.current);
      if (p && container) {
        const r = container.getBoundingClientRect();
        const top = r.top + headerCover(container);
        const speed = p.y < top + EDGE_PX ? -10 : p.y > r.bottom - EDGE_PX * 2 ? 10 : 0;
        if (speed) {
          container.scrollTop += speed;
          recompute.current(p);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging]);

  if (!settings || !tz || !schedule || !personal || !blocks) {
    return <div className="h-96 animate-pulse rounded-card bg-surface" aria-busy="true" />;
  }

  const max = settings.max_pomodoros_per_block;
  const avail = windowSpan(date, schedule.availability, tz);
  const peak = windowSpan(date, schedule.peak, tz);
  const personalOnDay = personalSpans(date, personal, tz);
  const actionMap = new Map((actions ?? []).map((a) => [a.id, a]));

  const gestureFor = (v: BlockView) => {
    const editable = v.block.status === "scheduled" || v.block.status === "draft";
    const action = actionMap.get(v.block.action_id) as Action | undefined;
    const finish = async (cancelled: boolean) => {
      const p = previewRef.current;
      setPreview(null);
      lastPoint.current = null;
      if (cancelled || !p || !action) return;
      if (p.startMin === v.startMin && p.pomodoros === v.block.planned_pomodoros) return;
      await place(action, { start: dayStart + p.startMin * MINUTE, pomodoros: p.pomodoros }, v.block);
    };
    return {
      move: {
        disabled: !editable || !action,
        onStart: (p: Point) => {
          grab.current = pointerMinute(p) - v.startMin;
          lastPoint.current = p;
          recompute.current = (q) => {
            const len = v.block.planned_pomodoros * POMODORO_MINUTES;
            const startMin = clamp(snapMinutes(pointerMinute(q) - grab.current), 0, DAY_MINUTES - len);
            setPreview({ blockId: v.block.id, startMin, pomodoros: v.block.planned_pomodoros, title: v.title });
          };
          recompute.current(p);
        },
        onMove: (p: Point) => {
          lastPoint.current = p;
          recompute.current(p);
        },
        onEnd: (_: Point, cancelled: boolean) => void finish(cancelled),
      },
      resize: {
        disabled: !editable || !action,
        onStart: (p: Point) => {
          lastPoint.current = p;
          recompute.current = (q) => {
            const pomodoros = clamp(Math.round((pointerMinute(q) - v.startMin) / POMODORO_MINUTES), 1, max);
            setPreview({ blockId: v.block.id, startMin: v.startMin, pomodoros, title: v.title });
          };
          recompute.current(p);
        },
        onMove: (p: Point) => {
          lastPoint.current = p;
          recompute.current(p);
        },
        onEnd: (_: Point, cancelled: boolean) => void finish(cancelled),
      },
    };
  };

  // The proposal being dragged: an existing block, or an action from the tray.
  const proposal = preview;
  const proposalClash =
    proposal &&
    overlappingBlock(
      { start: dayStart + proposal.startMin * MINUTE, end: dayStart + (proposal.startMin + proposal.pomodoros * POMODORO_MINUTES) * MINUTE },
      blocks,
      proposal.blockId,
    );

  return (
    <div className="relative select-none" style={{ height: DAY_MINUTES * MINUTE_PX }}>
      {/* Hour labels and lines */}
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} aria-hidden="true" className="absolute inset-x-0 border-t border-border/60" style={{ top: h * 60 * MINUTE_PX }}>
          <span className="absolute -top-2.5 left-0 w-10 bg-bg pr-1 text-right text-[12px] text-text-muted">{`${String(h).padStart(2, "0")}:00`}</span>
        </div>
      ))}

      <div
        ref={track}
        role="group"
        aria-label={`Timeline for ${formatDayHeader(date)}. Tap empty time to add a block.`}
        className="absolute inset-y-0 right-0 touch-pan-y"
        style={{ left: GUTTER_PX }}
        onClick={(e) => {
          if (!onAddAt || (e.target as HTMLElement).closest("button")) return;
          const min = clamp(snapMinutes(pointerMinute({ x: e.clientX, y: e.clientY })), 0, DAY_MINUTES - POMODORO_MINUTES);
          onAddAt(dayStart + min * MINUTE);
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || !onSwipeDay) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - s.t < 700) onSwipeDay(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (swipe.current = null)}
      >
        {/* Outside availability: dimmed */}
        {avail ? (
          <>
            <Dim fromMin={0} toMin={toMin(avail.start)} />
            <Dim fromMin={toMin(avail.end)} toMin={DAY_MINUTES} />
          </>
        ) : (
          <Dim fromMin={0} toMin={DAY_MINUTES} />
        )}

        {/* Peak window: a 3 px accent strip on the left edge */}
        {peak ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 w-[3px] rounded-full bg-accent"
            style={{ top: toMin(peak.start) * MINUTE_PX, height: (peak.end - peak.start) / MINUTE * MINUTE_PX }}
          />
        ) : null}

        {/* Personal blocks: hatched, labelled, not tappable */}
        {personalOnDay.map((p, i) => (
          <div
            key={i}
            className="pointer-events-none absolute right-1 left-2 flex items-start overflow-hidden rounded-block px-2 pt-1 text-caption text-text-muted"
            style={{
              top: toMin(p.start) * MINUTE_PX,
              height: (p.end - p.start) / MINUTE * MINUTE_PX,
              background: "repeating-linear-gradient(45deg, rgba(160,166,177,0.16) 0 3px, transparent 3px 9px)",
            }}
          >
            {p.label}
          </div>
        ))}

        {views.map((v) => (
          <BlockItem key={v.block.id} view={v} dragging={preview?.blockId === v.block.id} onTap={() => openBlock(v.block)} {...gestureFor(v)} />
        ))}

        {/* Drag preview with its target time; red when it would overlap another block */}
        {proposal ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute right-1 left-2 z-20 rounded-block border-2 ${
              proposalClash ? "border-danger bg-danger/25" : "border-accent bg-accent/20"
            }`}
            style={{ top: proposal.startMin * MINUTE_PX, height: proposal.pomodoros * POMODORO_MINUTES * MINUTE_PX }}
          >
            <span className="absolute -top-7 left-0 rounded-full bg-surface-raised px-2 py-0.5 text-caption shadow">
              {toLocalTime(dayStart + proposal.startMin * MINUTE, tz)} – {toLocalTime(dayStart + (proposal.startMin + proposal.pomodoros * POMODORO_MINUTES) * MINUTE, tz)}
              {proposalClash ? " · overlaps" : ""}
            </span>
          </div>
        ) : null}

        {/* Now */}
        {isToday ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10" style={{ top: toMin(now) * MINUTE_PX }}>
            <div className="h-0.5 bg-accent" />
            <div className="absolute -top-[5px] -left-[5px] size-3 rounded-full bg-accent" />
          </div>
        ) : null}
      </div>
    </div>
  );

}

function Dim({ fromMin, toMin }: { fromMin: number; toMin: number }) {
  if (toMin <= fromMin) return null;
  return (
    <div
      data-empty="true"
      aria-hidden="true"
      className="absolute inset-x-0 bg-black/45"
      style={{ top: Math.max(0, fromMin) * MINUTE_PX, height: (Math.min(DAY_MINUTES, toMin) - Math.max(0, fromMin)) * MINUTE_PX }}
    />
  );
}
