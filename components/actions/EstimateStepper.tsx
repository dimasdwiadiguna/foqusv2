"use client";

import { MAX_ESTIMATE, MIN_ESTIMATE } from "@/lib/actions";
import { PomodoroDots } from "@/components/ui/PomodoroDots";

/** − ●● + for an estimate in pomodoros (1–40). */
export function EstimateStepper({ value, onChange, compact = false }: { value: number; onChange: (n: number) => void; compact?: boolean }) {
  const btn = `flex ${compact ? "size-9" : "size-11"} items-center justify-center rounded-full bg-surface-raised text-heading disabled:opacity-40`;
  return (
    <div role="group" aria-label="Estimate in pomodoros" className="inline-flex items-center gap-1">
      <button type="button" className={btn} aria-label="Fewer pomodoros" disabled={value <= MIN_ESTIMATE} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="flex min-w-12 justify-center text-accent">
        <PomodoroDots completed={value} total={value} decorative />
        <span className="sr-only" aria-live="polite">
          {value} {value === 1 ? "pomodoro" : "pomodoros"}
        </span>
      </span>
      <button type="button" className={btn} aria-label="More pomodoros" disabled={value >= MAX_ESTIMATE} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
