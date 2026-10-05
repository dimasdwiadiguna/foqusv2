"use client";

import { useRef, useState } from "react";

const THRESHOLD = 88;

/**
 * Swipe right for `onSwipeRight` (mark done) and left for `onSwipeLeft` (schedule) (§6.8).
 * Vertical scrolling stays native (`touch-action: pan-y`), and a drag in progress cancels the swipe.
 */
export function SwipeRow({
  onSwipeRight,
  onSwipeLeft,
  label,
  leftLabel = "Schedule",
  disabled = false,
  cancel = false,
  children,
}: {
  onSwipeRight: () => void;
  onSwipeLeft?: () => void;
  /** What the area revealed by a right swipe says, e.g. "Done". */
  label: string;
  /** What the area revealed by a left swipe says. */
  leftLabel?: string;
  disabled?: boolean;
  /** True while something else (a reorder drag) owns the gesture. */
  cancel?: boolean;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef(false);
  const offset = cancel ? 0 : dx;

  const reset = () => {
    start.current = null;
    horizontal.current = false;
    setDx(0);
  };

  return (
    <div className="relative overflow-hidden rounded-card">
      {offset > 0 ? (
        <div aria-hidden="true" className="absolute inset-0 flex items-center gap-2 bg-success pl-4 font-semibold text-bg" style={{ opacity: Math.min(offset / THRESHOLD, 1) }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
          {label}
        </div>
      ) : null}
      {offset < 0 ? (
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-end gap-2 bg-accent pr-4 font-semibold text-bg" style={{ opacity: Math.min(-offset / THRESHOLD, 1) }}>
          {leftLabel}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </div>
      ) : null}
      <div
        className="relative touch-pan-y"
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: offset ? "none" : "transform 150ms" }}
        onPointerDown={(e) => {
          if (disabled || e.pointerType === "mouse") return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || cancel || s.id !== e.pointerId) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (!horizontal.current) {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) return reset();
            if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) && (mx > 0 || onSwipeLeft)) horizontal.current = true;
            else return;
          }
          setDx(onSwipeLeft ? mx : Math.max(0, mx));
        }}
        onPointerUp={() => {
          const fire = horizontal.current && !cancel ? (dx >= THRESHOLD ? onSwipeRight : dx <= -THRESHOLD ? onSwipeLeft : undefined) : undefined;
          reset();
          fire?.();
        }}
        onPointerCancel={reset}
        onClickCapture={(e) => {
          // A swipe that moved is not a tap.
          if (horizontal.current) e.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
}
