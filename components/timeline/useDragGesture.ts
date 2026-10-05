"use client";

import { useEffect, useRef } from "react";

export interface Point {
  x: number;
  y: number;
}

/**
 * Long-press-then-drag on touch, press-and-move with a mouse (§6.8). Before a touch drag starts,
 * moving more than a few pixels hands the gesture back to the browser, so scrolling never starts
 * a drag. Once it starts, `touchmove` is cancelled so the page does not scroll under the finger.
 */
export function useDragGesture(opts: {
  /** Hold time before a touch drag starts. 0 starts immediately (resize handles). */
  touchDelay?: number;
  disabled?: boolean;
  onStart: (p: Point) => void;
  onMove: (p: Point) => void;
  onEnd: (p: Point, cancelled: boolean) => void;
}) {
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (latest.current.disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.stopPropagation();
    cleanup.current?.();
    const start = { x: e.clientX, y: e.clientY };
    const pointerId = e.pointerId;
    const touch = e.pointerType !== "mouse";
    const delay = latest.current.touchDelay ?? 300;
    let active = false;
    let last = start;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const activate = () => {
      active = true;
      latest.current.onStart(last);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      last = { x: ev.clientX, y: ev.clientY };
      const dist = Math.hypot(last.x - start.x, last.y - start.y);
      if (!active) {
        if (touch && delay > 0 && dist > 8) return stop(); // a scroll or a swipe, not a drag
        if (!touch && dist > 4) activate();
        else return;
      }
      latest.current.onMove(last);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const wasActive = active;
      stop();
      if (wasActive) {
        latest.current.onEnd({ x: ev.clientX, y: ev.clientY }, false);
        // Swallow the click that follows a drag.
        const swallow = (c: Event) => {
          c.stopPropagation();
          c.preventDefault();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 50);
      }
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const wasActive = active;
      stop();
      if (wasActive) latest.current.onEnd(last, true);
    };
    const blockScroll = (ev: TouchEvent) => {
      if (active && ev.cancelable) ev.preventDefault();
    };
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", blockScroll);
      cleanup.current = null;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", blockScroll, { passive: false });
    cleanup.current = stop;
    if (touch) {
      if (delay === 0) activate();
      else timer = setTimeout(activate, delay);
    }
  };

  return {
    onPointerDown,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

/** The nearest scrolling ancestor, for auto-scroll while dragging. */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if ((overflowY === "auto" || overflowY === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}
