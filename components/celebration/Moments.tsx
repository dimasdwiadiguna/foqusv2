"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { celebrate } from "./celebrate";

/**
 * Full-screen celebration moments (§5.19): goal achieved (with the goal's numbers) and streak
 * milestones. One at a time, above everything. A tap anywhere dismisses it, so it never holds up
 * input; it also leaves by itself after a few seconds. With reduce-motion on it is a short fade.
 */
export interface Moment {
  /** Small line above the headline, e.g. "Goal achieved". */
  eyebrow: string;
  headline: string;
  /** Large number or symbol in the middle. */
  hero?: string;
  numbers?: { label: string; value: string }[];
  line?: string;
}

const AUTO_DISMISS_MS = 6000;

let queue: Moment[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Show a moment (queued behind any moment already showing). */
export function showMoment(m: Moment): void {
  queue = [...queue, m];
  emit();
}

function dismiss() {
  queue = queue.slice(1);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function MomentLayer() {
  const current = useSyncExternalStore(
    subscribe,
    () => queue[0] ?? null,
    () => null,
  );
  const shown = useRef<Moment | null>(null);

  useEffect(() => {
    if (!current || shown.current === current) return;
    shown.current = current;
    void celebrate("moment");
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="moment-headline"
      onClick={dismiss}
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-bg/90 px-6 backdrop-blur-sm"
    >
      <div className="animate-moment w-full max-w-[360px] text-center">
        <p className="text-caption font-semibold tracking-wide text-accent uppercase">{current.eyebrow}</p>
        {current.hero ? <p className="mt-3 text-[64px] leading-none font-bold text-accent tabular-nums">{current.hero}</p> : null}
        <h2 id="moment-headline" className="mt-3 text-title break-words">
          {current.headline}
        </h2>
        {current.numbers?.length ? (
          <dl className="mt-5 grid grid-cols-2 gap-2">
            {current.numbers.map((n) => (
              <div key={n.label} className="rounded-card bg-surface px-3 py-2">
                <dt className="text-caption text-text-muted">{n.label}</dt>
                <dd className="text-heading tabular-nums">{n.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {current.line ? <p className="mt-4 text-text-muted">{current.line}</p> : null}
        <p className="mt-6 text-caption text-text-muted">Tap anywhere to continue</p>
      </div>
    </div>
  );
}

/** The streak-milestone moment (7, 30, 100 days). */
export function milestoneMoment(kind: "check-in" | "focus", days: number): Moment {
  return {
    eyebrow: kind === "check-in" ? "Check-in streak" : "Focus streak",
    hero: String(days),
    headline: `${days} days in a row`,
    line:
      kind === "check-in"
        ? "Every evening, a look back. That habit is the whole system working."
        : "Goal work, every single day. This is how quarters are won.",
  };
}
