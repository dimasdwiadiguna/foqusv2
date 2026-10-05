"use client";

import { useCapacity } from "@/data";
import { CAPACITY_LABEL } from "@/lib/capacity";

const BAR: Record<string, string> = { room: "bg-success", full: "bg-warning", over: "bg-danger" };
const TEXT: Record<string, string> = { room: "text-success", full: "text-warning", over: "text-danger" };

/**
 * The capacity meter (§5.12) under Plan's week strip: planned hours against free hours for the
 * week's remaining days, its band, and the goal/area split of planned pomodoros. Kept to two short
 * lines so it can stick with the header (owner feedback: compact).
 */
export function CapacityMeter({ weekStart }: { weekStart: string }) {
  const c = useCapacity(weekStart);
  if (!c) return null;
  const pct = Number.isFinite(c.load) ? Math.round(c.load * 100) : null;
  const total = c.goalPomodoros + c.areaPomodoros;
  const goalPct = total ? Math.round((c.goalPomodoros / total) * 100) : 0;
  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-2">
        <div
          role="meter"
          aria-label="Week capacity"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? 100}
          aria-valuetext={`${c.plannedHours} hours planned of ${c.freeHours} free, ${CAPACITY_LABEL[c.band]}`}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
        >
          <div className={`h-full ${BAR[c.band]}`} style={{ width: `${Math.min(pct ?? 100, 100)}%` }} />
        </div>
        <span className={`shrink-0 text-caption font-semibold ${TEXT[c.band]}`}>
          {pct === null ? "—" : `${pct}%`} · {CAPACITY_LABEL[c.band]}
        </span>
      </div>
      <p className="text-[12px] leading-4 text-text-muted">
        {c.plannedHours} h planned of {c.freeHours} h free
        {total ? ` · Goals ${goalPct}% · Areas ${100 - goalPct}%` : ""}
      </p>
    </div>
  );
}
