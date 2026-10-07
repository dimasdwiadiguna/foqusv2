"use client";

import { useRef, useState } from "react";
import { useHabitLogs, useHabits } from "@/data";
import { habitDue, habitStreak, LEVEL_LABEL, levelText, type Level } from "@/lib/habits";
import { addDays } from "@/lib/time";
import { logHabit } from "@/repo";
import type { Habit, HabitLog } from "@/types";
import { celebrate } from "@/components/celebration/celebrate";
import { FlameIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";

/** Three arcs that fill to the level reached: Min, Std, Elite. */
export function LevelRing({ level, size = 28 }: { level: Level; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const seg = c / 3;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0 -rotate-90">
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          strokeLinecap="butt"
          stroke={i < level ? (level === 3 ? "var(--color-success)" : "var(--color-accent)") : "var(--color-border)"}
          strokeDasharray={`${seg - 3} ${c - seg + 3}`}
          strokeDashoffset={-i * seg}
        />
      ))}
    </svg>
  );
}

/**
 * Today's habits (Stage 2 exit): one chip per habit due today, in one scrolling row. A count habit
 * counts up with a tap (long-press to adjust); a level habit opens Min / Std / Elite.
 */
export function HabitStrip({ date }: { date: string }) {
  const habits = useHabits();
  const logs = useHabitLogs(addDays(date, -400), date);
  const [open, setOpen] = useState<Habit | null>(null);
  if (!habits || !logs) return null;
  const due = habits.filter((h) => habitDue(h, date));
  if (due.length === 0) return null;
  return (
    <div className="mt-1.5 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="list" aria-label="Today's habits">
      {due.map((h) => {
        const mine = logs.filter((l) => l.habit_id === h.id);
        return <HabitChip key={h.id} habit={h} date={date} logs={mine} onOpen={() => setOpen(h)} />;
      })}
      {open ? <HabitLogSheet habit={open} date={date} log={logs.find((l) => l.habit_id === open.id && l.date === date) ?? null} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function HabitChip({ habit, date, logs, onOpen }: { habit: Habit; date: string; logs: HabitLog[]; onOpen: () => void }) {
  const today = logs.find((l) => l.date === date) ?? null;
  const level = (today?.level ?? 0) as Level;
  const streak = habitStreak(habit.weekdays, logs, date).current;
  const ref = useRef<HTMLButtonElement>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; long: boolean } | null>(null);
  const count = today?.count ?? 0;
  const sub = habit.kind === "count" ? `${count}/${habit.levels.elite}${habit.unit ? ` ${habit.unit}` : ""}` : level ? LEVEL_LABEL[level] : "Tap to mark";

  const tap = async () => {
    if (habit.kind !== "count") return onOpen();
    const log = await logHabit(habit.id, date, { count: count + 1 });
    if (log.level === 3 && level < 3) void celebrate("action", ref.current);
  };
  return (
    <button
      ref={ref}
      type="button"
      role="listitem"
      aria-label={`${habit.title}: ${level ? LEVEL_LABEL[level] : "not yet"}${habit.kind === "count" ? `, ${count} ${habit.unit ?? ""}` : ""}${streak ? `, ${streak}-day streak` : ""}. ${habit.kind === "count" ? "Tap to add one, hold to adjust." : "Tap to mark a level."}`}
      onPointerDown={() => {
        if (habit.kind !== "count") return;
        press.current = { long: false, timer: setTimeout(() => {
          if (press.current) press.current.long = true;
          // The release after a long-press sends a click, which would land on the new sheet's
          // backdrop and close it: swallow that one click.
          const swallow = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            window.removeEventListener("click", swallow, true);
          };
          window.addEventListener("click", swallow, true);
          setTimeout(() => window.removeEventListener("click", swallow, true), 1000);
          onOpen();
        }, 500) };
      }}
      onPointerUp={() => press.current && clearTimeout(press.current.timer)}
      onPointerLeave={() => press.current && clearTimeout(press.current.timer)}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        const long = press.current?.long;
        press.current = null;
        if (!long) void tap();
      }}
      className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface py-1 pr-3 pl-1.5 text-left select-none [-webkit-touch-callout:none]"
    >
      <LevelRing level={level} />
      <span className="min-w-0">
        <span className="block max-w-28 truncate text-[13px] leading-4 font-semibold">{habit.title}</span>
        <span className="flex items-center gap-1 text-[11px] leading-3 text-text-muted">
          {sub}
          {streak ? (
            <>
              <FlameIcon className="size-3 text-accent" />
              {streak}
            </>
          ) : null}
        </span>
      </span>
    </button>
  );
}

/** Log one habit for one day: a count, or a level. */
export function HabitLogSheet({ habit, date, log, onClose }: { habit: Habit; date: string; log: HabitLog | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const run = async (v: { count: number } | { level: Level }) => {
    setError(null);
    try {
      const before = (log?.level ?? 0) as Level;
      const saved = await logHabit(habit.id, date, v);
      if (saved.level === 3 && before < 3) void celebrate("action");
      if (!("count" in v)) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    }
  };
  return (
    <Sheet open onClose={onClose} title={habit.title}>
      <HabitLogControls habit={habit} log={log} onLog={run} />
      {error ? (
        <p role="alert" className="mt-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}

/** The controls for one habit's day, shared by the sheet and the check-in. */
export function HabitLogControls({ habit, log, onLog }: { habit: Habit; log: HabitLog | null; onLog: (v: { count: number } | { level: Level }) => void }) {
  const level = (log?.level ?? 0) as Level;
  if (habit.kind === "count") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <LevelRing level={level} size={32} />
          <span>
            <span className="block font-semibold">{LEVEL_LABEL[level]}</span>
            <span className="block text-caption text-text-muted">
              Min {habit.levels.min} · Std {habit.levels.std} · Elite {habit.levels.elite}
              {habit.unit ? ` ${habit.unit}` : ""}
            </span>
          </span>
        </span>
        <Stepper label={`${habit.title} count`} value={log?.count ?? 0} min={0} max={1000} onChange={(n) => onLog({ count: n })} />
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label={habit.title} className="grid grid-cols-2 gap-2">
      {([1, 2, 3, 0] as Level[]).map((l) => (
        <Button
          key={l}
          role="radio"
          aria-checked={level === l}
          variant={level === l ? "primary" : "secondary"}
          className="min-h-12 flex-col !gap-0 py-1"
          onClick={() => onLog({ level: l })}
        >
          <span className="font-semibold">{LEVEL_LABEL[l]}</span>
          {l ? <span className="text-[12px] leading-4 opacity-80">{levelText(habit, l as 1 | 2 | 3)}</span> : null}
        </Button>
      ))}
    </div>
  );
}
