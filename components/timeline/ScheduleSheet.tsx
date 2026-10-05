"use client";

import { useState } from "react";
import { useBlocksForActions, useBlocksForDays, useDaySchedule, useNow, usePersonalBlocks, useSettings, useToday } from "@/data";
import { actionNumbers } from "@/lib/actions";
import { firstFreeStart, freeIntervals, TIME_OPTIONS } from "@/lib/availability";
import { toLocalTime, weekdayOf, zonedToInstant } from "@/lib/time";
import type { Action, Settings } from "@/types";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { PomodoroDots } from "@/components/ui/PomodoroDots";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { usePlacement } from "./PlacementProvider";

/**
 * Schedule one action (§6.8 swipe left, and the tap alternative to dragging from the tray):
 * a day, a start time on the 5-minute grid, and a size in pomodoros.
 */
export function ScheduleSheet({ action, initialDate, onClose }: { action: Action; initialDate?: string; onClose: () => void }) {
  const settings = useSettings();
  const today = useToday();
  const blocks = useBlocksForActions([action.id]);
  if (!settings || !today || !blocks) return null;
  return (
    <ScheduleForm
      action={action}
      settings={settings}
      date0={initialDate && initialDate >= today ? initialDate : today}
      blocks={blocks}
      onClose={onClose}
    />
  );
}

function ScheduleForm({
  action,
  settings,
  date0,
  blocks,
  onClose,
}: {
  action: Action;
  settings: Settings;
  date0: string;
  blocks: NonNullable<ReturnType<typeof useBlocksForActions>>;
  onClose: () => void;
}) {
  const now = useNow();
  const { place } = usePlacement();
  const tz = settings.timezone;
  const max = settings.max_pomodoros_per_block;
  const { remaining, unscheduled } = actionNumbers(action, blocks, new Date(now).toISOString());
  const [date, setDate] = useState(date0);
  const [pomodoros, setPomodoros] = useState(Math.min(Math.max(unscheduled, 1), max));
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const schedule = useDaySchedule(weekdayOf(date));
  const personal = usePersonalBlocks();
  const dayBlocks = useBlocksForDays(date, date, tz);

  // Until the owner picks a time, suggest the first free slot that day.
  let suggested = schedule?.availability?.start_time ?? "09:00";
  if (schedule && personal && dayBlocks) {
    const free = freeIntervals({
      date,
      timeZone: tz,
      availability: schedule.availability,
      personal,
      events: [],
      blocks: dayBlocks,
      now: new Date(now).toISOString(),
    });
    const first = firstFreeStart(free, pomodoros * 30, settings.default_buffer_minutes);
    if (first !== null) suggested = toLocalTime(first, tz);
  }
  const value = time ?? suggested;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Schedule"
      footer={
        <Button
          variant="primary"
          block
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await place(action, { start: Date.parse(zonedToInstant(date, value, tz)), pomodoros });
            setBusy(false);
            if (ok) onClose();
          }}
        >
          Schedule
        </Button>
      }
    >
      <p className="mb-1 text-heading">{action.title}</p>
      <p className="mb-4 flex items-center gap-2 text-caption text-text-muted">
        <PomodoroDots completed={action.estimate_pomodoros - remaining} total={action.estimate_pomodoros} className="text-accent" />
        {unscheduled > 0 ? `${unscheduled} still to schedule` : "Everything is scheduled"}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="schedule-date" className="mb-1 block text-caption text-text-muted">
            Day
          </label>
          <input
            id="schedule-date"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
              setTime(null);
            }}
            className={`${controlClass} min-h-11`}
          />
        </div>
        <div>
          <label htmlFor="schedule-time" className="mb-1 block text-caption text-text-muted">
            Start
          </label>
          <select id="schedule-time" value={value} onChange={(e) => setTime(e.target.value)} className={`${controlClass} min-h-11`}>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span>Pomodoros</span>
        <Stepper label="pomodoros" value={pomodoros} min={1} max={max} onChange={setPomodoros} />
      </div>
    </Sheet>
  );
}
