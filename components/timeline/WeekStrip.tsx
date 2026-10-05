"use client";

import { useBlocksForDays, useSettings } from "@/data";
import { occupies } from "@/lib/availability";
import { WEEKDAY_LETTERS } from "@/lib/schedule";
import { formatDayHeader, parseDate, toLocalDate, weekDates } from "@/lib/time";

/**
 * Plan's week strip (§6.7): seven days with their planned pomodoros. A day over the daily cap shows
 * "!" in the danger color. The selected day is underlined.
 */
export function WeekStrip({ date, today, onSelect }: { date: string; today: string; onSelect: (d: string) => void }) {
  const settings = useSettings();
  const days = weekDates(date);
  const blocks = useBlocksForDays(days[0], days[6], settings?.timezone);
  const load = new Map<string, number>();
  if (settings) {
    for (const b of blocks ?? []) {
      if (!occupies(b)) continue;
      const d = toLocalDate(b.starts_at, settings.timezone);
      load.set(d, (load.get(d) ?? 0) + b.planned_pomodoros);
    }
  }
  const cap = settings?.daily_pomodoro_cap ?? Infinity;

  return (
    <div role="tablist" aria-label="Days of the week" className="mb-3 grid grid-cols-7 gap-1">
      {days.map((d, i) => {
        const n = load.get(d) ?? 0;
        const over = n > cap;
        const selected = d === date;
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={`${formatDayHeader(d)}, ${n} pomodoros${over ? `, over your cap of ${cap}` : ""}`}
            onClick={() => onSelect(d)}
            className={`flex min-h-12 flex-col items-center justify-center rounded-block border-b-2 ${
              selected ? "border-accent bg-surface-raised" : "border-transparent"
            }`}
          >
            <span className={`text-[12px] leading-4 ${d === today ? "font-semibold text-accent" : "text-text-muted"}`}>
              {WEEKDAY_LETTERS[i]} {parseDate(d).day}
            </span>
            <span className={`text-body leading-5 font-semibold ${over ? "text-danger" : ""}`}>
              {n}
              {over ? "!" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
