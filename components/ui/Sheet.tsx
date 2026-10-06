"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A bottom sheet (§6.1): rises from the bottom, traps focus, closes on Escape, backdrop tap, or a
 * swipe down on its grab area (§6.8). Follows the iOS keyboard via the visual viewport.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Element to focus on open; defaults to the first focusable element. */
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [dragY, setDragY] = useState(0);
  const start = useRef<number | null>(null);
  const [bottom, setBottom] = useState(0);
  // While the sheet moves with the keyboard, taps inside it are ignored, so a finger aimed at
  // where a control was cannot land on the one that slid under it.
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The latest onClose, so Escape never calls a stale one from when the sheet opened.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Focus management and Escape.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    (initialFocus?.current ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === "Tab" && node) {
        const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on open/close only
  }, [open]);

  // Keep the sheet above the on-screen keyboard.
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const next = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setBottom((prev) => {
        if (Math.abs(prev - next) > 40) {
          setSettling(true);
          clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => setSettling(false), 350);
        }
        return next;
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const grab = {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current !== null) setDragY(Math.max(0, e.clientY - start.current));
    },
    onPointerUp: () => {
      if (dragY > 80) onClose();
      start.current = null;
      setDragY(0);
    },
    onPointerCancel: () => {
      start.current = null;
      setDragY(0);
    },
  };

  return createPortal(
    <div className="fixed inset-0 z-50" style={{ bottom }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[90%] max-w-[480px] flex-col rounded-t-sheet border-t border-border bg-surface outline-none lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:max-h-[85vh] lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-sheet lg:border"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, pointerEvents: settling ? "none" : undefined }}
        onPointerDownCapture={keepTyping}
        onMouseDownCapture={keepTyping}
      >
        <div className="shrink-0 touch-none px-4 pt-2 pb-1" {...grab}>
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border lg:hidden" aria-hidden="true" />
          <h2 id={titleId} className="mt-3 text-heading">
            {title}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-border px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">{footer}</div>
        ) : (
          <div className="pb-[env(safe-area-inset-bottom)]" />
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Tapping a button inside a sheet while typing (a chip, a stepper) keeps the keyboard up: the
 * button does not take focus from the text field, so the sheet does not jump under the next tap.
 */
function keepTyping(e: React.PointerEvent | React.MouseEvent) {
  const active = document.activeElement as HTMLElement | null;
  const typing =
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && ["text", "search", "number", "email", "url", "tel", ""].includes(active.type));
  if (!typing || !e.currentTarget.contains(active)) return;
  const target = e.target as HTMLElement;
  if (target.closest("button") && !target.closest("input, select, textarea, label")) e.preventDefault();
}
