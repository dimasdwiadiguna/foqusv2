"use client";

import { PomodoroDots } from "@/components/ui/PomodoroDots";
import type { Block } from "@/types";
import { MINUTE_PX } from "./geometry";
import { useDragGesture, type Point } from "./useDragGesture";

export interface BlockView {
  block: Block;
  title: string;
  owner: string;
  color: string;
  isGoal: boolean;
  /** Minutes from local midnight. */
  startMin: number;
  endMin: number;
  timeLabel: string;
  unresolved: boolean;
}

/**
 * One block on the timeline (§6.4). Goal blocks are filled; area blocks are outlined with a 2 px
 * left edge; drafts are dashed; done blocks are faded with a check; unresolved blocks get a
 * danger outline and a "?" badge. The buffer is a hatched tail. Shape and marks, not color alone,
 * carry the meaning (§6.12).
 */
export function BlockItem({
  view,
  dragging,
  onTap,
  move,
  resize,
  compact = false,
}: {
  /** Narrow multi-day columns: title only, no tags, tighter edges. */
  compact?: boolean;
  view: BlockView;
  dragging: boolean;
  onTap: () => void;
  move: { onStart: (p: Point) => void; onMove: (p: Point) => void; onEnd: (p: Point, cancelled: boolean) => void; disabled: boolean };
  resize: { onStart: (p: Point) => void; onMove: (p: Point) => void; onEnd: (p: Point, cancelled: boolean) => void; disabled: boolean };
}) {
  const { block, isGoal, color } = view;
  const moveGesture = useDragGesture({ ...move, touchDelay: 300 });
  const resizeGesture = useDragGesture({ ...resize, touchDelay: 0 });
  const height = (view.endMin - view.startMin) * MINUTE_PX;
  const done = block.status === "done";
  const draft = block.status === "draft";
  const tall = !compact && height >= 34;
  // Filled (dark text on the goal color) only for committed goal blocks.
  const filled = isGoal && !draft;

  // Drafts (§5.11): dashed and semi-transparent in the owner's color, so they read as proposals.
  const style: React.CSSProperties = draft
    ? { background: `color-mix(in srgb, ${color} ${isGoal ? 28 : 12}%, transparent)`, borderColor: color, borderWidth: 2 }
    : isGoal
      ? { background: color, color: "var(--color-bg)" }
      : { background: "var(--color-surface)", boxShadow: `inset 2px 0 0 ${color}`, borderColor: color };

  return (
    <div
      className={`absolute ${compact ? "right-0.5 left-0.5" : "right-1 left-2"}`}
      style={{ top: view.startMin * MINUTE_PX, height: height + block.buffer_minutes * MINUTE_PX, opacity: dragging ? 0.35 : 1 }}
    >
      <button
        type="button"
        {...moveGesture}
        onClick={(e) => {
          e.stopPropagation();
          onTap();
        }}
        aria-label={`${view.title}, ${view.timeLabel}${done ? ", done" : ""}${view.unresolved ? ", needs resolving" : ""}${block.off_peak ? ", off-peak" : ""}`}
        className={`relative block w-full touch-pan-y overflow-hidden rounded-block border text-left select-none [-webkit-touch-callout:none] ${
          isGoal && !draft ? "border-transparent" : ""
        } ${draft ? "border-dashed" : ""} ${done ? "opacity-50" : ""} ${view.unresolved ? "!border-2 !border-danger" : ""}`}
        style={{ ...style, height }}
      >
        <span className={`flex h-full flex-col ${compact ? "px-1 py-0.5" : "px-2"} ${tall ? "py-0.5" : compact ? "" : "justify-center"}`}>
          <span className={`flex min-w-0 gap-1 ${compact ? "items-start" : "items-center"}`}>
            {done ? <span aria-hidden="true" className="inline-block animate-[pop_400ms_ease-out]">✓</span> : null}
            <span className={compact ? "line-clamp-2 text-[12px] leading-[14px] font-semibold break-words" : "truncate text-[14px] leading-4 font-semibold"}>{view.title}</span>
          </span>
          {tall ? (
            <span className={`flex min-w-0 items-center gap-2 text-[12px] leading-4 ${filled ? "" : "text-text-muted"}`}>
              <span className="shrink-0">{view.timeLabel}</span>
              <PomodoroDots completed={block.completed_pomodoros} total={block.planned_pomodoros} decorative />
              <span className="truncate">{view.owner}</span>
            </span>
          ) : null}
        </span>
        <span className="absolute top-1 right-1 flex gap-1">
          {draft && !compact ? <Tag isGoal={filled}>draft</Tag> : null}
          {block.off_peak && !compact ? <Tag isGoal={filled}>off-peak</Tag> : null}
          {view.unresolved ? (
            <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-danger text-caption font-bold text-bg">
              ?
            </span>
          ) : null}
        </span>
      </button>
      {block.buffer_minutes > 0 ? (
        <div
          aria-hidden="true"
          className="mx-1 rounded-b-block"
          style={{
            height: block.buffer_minutes * MINUTE_PX,
            background: "repeating-linear-gradient(135deg, var(--color-border) 0 2px, transparent 2px 7px)",
          }}
        />
      ) : null}
      {!resize.disabled ? (
        <div
          {...resizeGesture}
          role="presentation"
          className="absolute inset-x-6 flex h-6 cursor-ns-resize touch-none items-center justify-center"
          style={{ top: height - 14 }}
        >
          <span className={`h-1 w-8 rounded-full ${isGoal ? "bg-bg/60" : "bg-text-muted"}`} />
        </div>
      ) : null}
    </div>
  );
}

function Tag({ isGoal, children }: { isGoal: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-1.5 text-[11px] leading-4 font-medium ${isGoal ? "bg-bg/25" : "border border-border text-text-muted"}`}>
      {children}
    </span>
  );
}
