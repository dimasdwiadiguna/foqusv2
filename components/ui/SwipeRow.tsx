"use client";

import { useRef, useState } from "react";

const THRESHOLD = 88;

/**
 * Swipe right to trigger `onSwipeRight` (§6.8, mark done). Vertical scrolling stays native
 * (`touch-action: pan-y`), and a drag in progress cancels the swipe.
 */
export function SwipeRow({
  onSwipeRight,
  label,
  disabled = false,
  cancel = false,
  children,
}: {
  onSwipeRight: () => void;
  /** What the revealed area says, e.g. "Done". */
  label: string;
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
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center gap-2 bg-success pl-4 font-semibold text-bg"
        style={{ opacity: Math.min(offset / THRESHOLD, 1) }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
        {label}
      </div>
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
            if (mx > 10 && mx > Math.abs(my)) horizontal.current = true;
            else return;
          }
          setDx(Math.max(0, mx));
        }}
        onPointerUp={() => {
          const fire = horizontal.current && !cancel && dx >= THRESHOLD;
          reset();
          if (fire) onSwipeRight();
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
