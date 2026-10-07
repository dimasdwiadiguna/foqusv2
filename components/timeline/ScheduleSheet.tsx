"use client";

import { useEffect, useState } from "react";
import { getWeekContext, useBlocksForActions, useBlocksForDays, useDaySchedule, useNow, usePersonalBlocks, useSettings, useToday } from "@/data";
import type { DraftBlock } from "@/lib/draft";
import { defaultSplit, planSessions } from "@/lib/sessions";
import { placeBlock, updateAction } from "@/repo";
import { actionNumbers } from "@/lib/actions";
import { firstFreeStart, freeIntervals, TIME_OPTIONS } from "@/lib/availability";
import { addDays, endOfWeek, formatDayHeader, todayIn, toLocalDate, toLocalTime, weekdayOf, zonedToInstant } from "@/lib/time";
import type { Action, Settings } from "@/types";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { PomodoroDots } from "@/components/ui/PomodoroDots";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { usePlacement, type PlaceOptions } from "./PlacementProvider";
import { weekLimits } from "./BlockSheet";

/**
 * Schedule one action (§6.8 swipe left, and the tap alternative to dragging from the tray):
 * a day, a start time on the 5-minute grid, and a size in pomodoros.
 */
export function ScheduleSheet({
  action,
  initialDate,
  options,
  onClose,
}: {
  action: Action;
  initialDate?: string;
  /** `replaces`: rescheduling a missed block; `pomodoros`: the size to start from. */
  options?: PlaceOptions & { pomodoros?: number };
  onClose: () => void;
}) {
  const settings = useSettings();
  const today = useToday();
  const blocks = useBlocksForActions([action.id]);
  const [mode, setMode] = useState<"one" | "sessions">(action.session_pomodoros ? "sessions" : "one");
  if (!settings || !today || !blocks) return null;
  // Work that needs several sittings can be split into sessions (Stage 2 exit). Not for a missed
  // block being rescheduled, nor for a recurring occurrence (tied to its day).
  const { unscheduled } = actionNumbers(action, blocks, new Date().toISOString());
  const canSplit = !options?.replaces && !action.occurrence_date && unscheduled > 1;
  const toggle = canSplit ? <ModeToggle mode={mode} onChange={setMode} /> : null;
  if (canSplit && mode === "sessions") {
    return <SessionsForm action={action} settings={settings} today={today} unscheduled={unscheduled} toggle={toggle} onClose={onClose} />;
  }
  return (
    <ScheduleForm
      action={action}
      settings={settings}
      options={options}
      date0={initialDate && initialDate >= today ? initialDate : today}
      blocks={blocks}
      onClose={onClose}
      toggle={toggle}
    />
  );
}

function ModeToggle({ mode, onChange }: { mode: "one" | "sessions"; onChange: (m: "one" | "sessions") => void }) {
  return (
    <div role="radiogroup" aria-label="How to schedule" className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-surface-raised p-1">
      {(
        [
          ["one", "One block"],
          ["sessions", "Split into sessions"],
        ] as const
      ).map(([m, label]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => onChange(m)}
          className={`min-h-11 rounded-full text-caption font-semibold ${mode === m ? "bg-accent text-bg" : "text-text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Sessions (Stage 2 exit): N sessions of k pomodoros, placed on separate days by the same rules as
 * "Draft my week" (this week and next), previewed, then committed together. The session size is
 * remembered on the action, so the draft and the tray use it too.
 */
function SessionsForm({
  action,
  settings,
  today,
  unscheduled,
  toggle,
  onClose,
}: {
  action: Action;
  settings: Settings;
  today: string;
  unscheduled: number;
  toggle: React.ReactNode;
  onClose: () => void;
}) {
  const max = settings.max_pomodoros_per_block;
  const split0 = defaultSplit(unscheduled, action.session_pomodoros, max);
  const [count, setCount] = useState(split0.count);
  const [size, setSize] = useState(split0.size);
  const [plan, setPlan] = useState<{ key: string; blocks: DraftBlock[]; missing: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${count}x${size}`;
  const tz = settings.timezone;

  useEffect(() => {
    let live = true;
    const until = endOfWeek(addDays(today, 7));
    void getWeekContext(today, until).then((ctx) => {
      if (!live) return;
      const days: string[] = [];
      for (let d = today; d <= until; d = addDays(d, 1)) days.push(d);
      const r = planSessions({
        action,
        count,
        size,
        days,
        today,
        now: new Date().toISOString(),
        timeZone: tz,
        windows: ctx.windows,
        personal: ctx.personal,
        events: [],
        blocks: ctx.blocks,
        dailyCap: settings.daily_pomodoro_cap,
        bufferMinutes: settings.default_buffer_minutes,
      });
      setPlan({ key, ...r });
    });
    return () => {
      live = false;
    };
  }, [action, count, size, key, today, tz, settings.daily_pomodoro_cap, settings.default_buffer_minutes]);

  const ready = plan?.key === key ? plan : null;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Schedule"
      footer={
        <Button
          variant="primary"
          block
          disabled={busy || !ready || ready.blocks.length === 0}
          onClick={async () => {
            if (!ready) return;
            setBusy(true);
            setError(null);
            try {
              await updateAction(action.id, { session_pomodoros: size });
              for (const b of ready.blocks) await placeBlock(action.id, { start: b.start, pomodoros: b.pomodoros, bufferMinutes: b.bufferMinutes });
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "The sessions could not be scheduled.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {ready && ready.blocks.length ? `Schedule ${ready.blocks.length} ${ready.blocks.length === 1 ? "session" : "sessions"}` : "Schedule"}
        </Button>
      }
    >
      <p className="mb-1 text-heading">{action.title}</p>
      <p className="mb-4 text-caption text-text-muted">{unscheduled} pomodoros still to schedule</p>
      {toggle}
      <div className="mb-3 flex items-center justify-between">
        <span>Sessions</span>
        <Stepper label="sessions" value={count} min={1} max={8} onChange={setCount} />
      </div>
      <div className="mb-4 flex items-center justify-between">
        <span>Pomodoros each</span>
        <Stepper label="pomodoros each" value={size} min={1} max={max} onChange={setSize} />
      </div>
      <h3 className="mb-1 text-caption tracking-wide text-text-muted uppercase">Proposed</h3>
      {ready ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface" aria-label="Proposed sessions">
          {ready.blocks.map((b) => (
            <li key={b.start} className="flex items-center justify-between px-3 py-2">
              <span>
                {formatDayHeader(b.date)} {toLocalTime(b.start, tz)}–{toLocalTime(b.end, tz)}
                {b.offPeak ? <span className="ml-1 text-caption text-text-muted">off-peak</span> : null}
              </span>
              <PomodoroDots completed={0} total={b.pomodoros} className="text-accent" />
            </li>
          ))}
          {ready.missing ? (
            <li className="px-3 py-2 text-caption text-warning">
              {ready.missing} {ready.missing === 1 ? "session finds" : "sessions find"} no free slot this week or next.
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-caption text-text-muted">Finding free slots…</p>
      )}
      {count * size > unscheduled ? <p className="mt-2 text-caption text-text-muted">That is {count * size - unscheduled} more than the estimate still needs.</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}

function ScheduleForm({
  action,
  settings,
  options,
  date0,
  blocks,
  onClose,
  toggle,
}: {
  action: Action;
  settings: Settings;
  options?: PlaceOptions & { pomodoros?: number };
  date0: string;
  blocks: NonNullable<ReturnType<typeof useBlocksForActions>>;
  onClose: () => void;
  toggle?: React.ReactNode;
}) {
  const now = useNow();
  const { place } = usePlacement();
  const tz = settings.timezone;
  const max = settings.max_pomodoros_per_block;
  const { remaining, unscheduled } = actionNumbers(action, blocks, new Date(now).toISOString());
  // An occurrence starts on its own day while that is still ahead (§5.5).
  const today = todayIn(now, tz);
  const [date, setDate] = useState(action.occurrence_date && action.occurrence_date >= today ? action.occurrence_date : date0);
  const [pomodoros, setPomodoros] = useState(Math.min(Math.max(options?.pomodoros ?? unscheduled, 1), max));
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
    else if (date === todayIn(now, tz)) {
      // No free time left today: never suggest a time that has already passed.
      const next = toLocalTime(Math.ceil(now / (5 * 60_000)) * 5 * 60_000, tz);
      suggested = toLocalDate(Math.ceil(now / (5 * 60_000)) * 5 * 60_000, tz) === date ? next : "23:55";
    }
  }
  const value = time ?? suggested;

  return (
    <Sheet
      open
      onClose={onClose}
      title={options?.replaces ? "Reschedule" : "Schedule"}
      footer={
        <Button
          variant="primary"
          block
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await place(action, { start: Date.parse(zonedToInstant(date, value, tz)), pomodoros }, undefined, options);
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
      {toggle}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="schedule-date" className="mb-1 block text-caption text-text-muted">
            Day
          </label>
          <input
            id="schedule-date"
            type="date"
            {...weekLimits(action.occurrence_date)}
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
