"use client";

import { useState } from "react";
import { useHabitLogs, useHabits, useToday } from "@/data";
import { formatWeekdays } from "@/lib/recurrence";
import { habitStreak, habitWeek, LEVEL_LABEL, type Level } from "@/lib/habits";
import { WEEKDAY_LETTERS } from "@/lib/schedule";
import { addDays, startOfWeek, weekDates, weekdayShort } from "@/lib/time";
import { archiveHabit, createHabit, deleteHabit, updateHabit } from "@/repo";
import type { Habit, HabitKind, Weekday } from "@/types";
import { OwnerSelect, type Owner } from "@/components/actions/OwnerSelect";
import { FlameIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { controlClass, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { LevelRing } from "./HabitStrip";

const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Habits on the Goals page (Stage 2 exit): every habit with its streak and this week, tap to edit,
 * and "Add a habit". With `goalId`, only that goal's habits (goal detail).
 */
export function HabitsSection({ goalId, title = "Habits" }: { goalId?: string; title?: string }) {
  const today = useToday();
  const habits = useHabits();
  const logs = useHabitLogs(today ? addDays(today, -400) : undefined, today);
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  if (!today || !habits || !logs) return null;
  const list = goalId ? habits.filter((h) => h.goal_id === goalId) : habits;
  const week = weekDates(startOfWeek(today));

  return (
    <section aria-labelledby={`habits-${goalId ?? "all"}`} className="mb-4">
      <h2 id={`habits-${goalId ?? "all"}`} className="mb-2 text-heading">
        {title}
      </h2>
      {list.length ? (
        <ul className="mb-2 divide-y divide-border rounded-card border border-border bg-surface">
          {list.map((h) => {
            const mine = logs.filter((l) => l.habit_id === h.id);
            const s = habitStreak(h.weekdays, mine, today);
            const w = habitWeek(h.weekdays, mine, week, today);
            return (
              <li key={h.id}>
                <button type="button" onClick={() => setEditing(h)} className="flex min-h-12 w-full items-center gap-3 px-3 py-1.5 text-left" aria-label={`Edit habit ${h.title}`}>
                  <LevelRing level={s.today as Level} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${h.active ? "" : "text-text-muted"}`}>{h.title}</span>
                    <span className="block truncate text-caption text-text-muted">
                      {formatWeekdays(h.weekdays)} · this week {w.hit}/{w.expected}
                      {w.elite ? ` · ${w.elite} Elite` : ""}
                      {h.active ? "" : " · paused"}
                    </span>
                  </span>
                  {s.current ? (
                    <span className="flex items-center gap-0.5 text-caption font-semibold text-accent">
                      <FlameIcon className="size-4" />
                      {s.current}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-2 text-caption text-text-muted">
          Small daily habits you track rather than schedule, like water or stretching. Each has three levels: Min on a hard day, Std normally, Elite on a great one. Any level keeps the streak.
        </p>
      )}
      <Button block onClick={() => setEditing("new")}>
        Add a habit
      </Button>
      <HabitSheet key={editing === null ? "closed" : editing === "new" ? "new" : editing.id} habit={editing === "new" ? null : editing} open={editing !== null} goalId={goalId} onClose={() => setEditing(null)} />
    </section>
  );
}

function HabitSheet({ habit, open, goalId, onClose }: { habit: Habit | null; open: boolean; goalId?: string; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={habit ? "Habit" : "New habit"}>
      {open ? <HabitForm habit={habit} goalId={goalId} onClose={onClose} /> : null}
    </Sheet>
  );
}

function HabitForm({ habit, goalId, onClose }: { habit: Habit | null; goalId?: string; onClose: () => void }) {
  const [title, setTitle] = useState(habit?.title ?? "");
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? "count");
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [levels, setLevels] = useState<{ min: string; std: string; elite: string }>({
    min: String(habit?.levels.min ?? ""),
    std: String(habit?.levels.std ?? ""),
    elite: String(habit?.levels.elite ?? ""),
  });
  const [days, setDays] = useState<Weekday[]>(habit?.weekdays ?? DAYS);
  const [linked, setLinked] = useState(Boolean(habit?.goal_id || habit?.area_id || goalId));
  const [owner, setOwner] = useState<Owner>(habit ? { goal_id: habit.goal_id, area_id: habit.area_id ?? (habit.goal_id ? null : "area-other") } : goalId ? { goal_id: goalId, area_id: null } : { goal_id: null, area_id: "area-other" });
  const [active, setActive] = useState(habit?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const examples = kind === "count" ? { min: "4", std: "6", elite: "8" } : { min: "1 stretch", std: "10 minutes", elite: "30 minutes" };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const input = {
          title,
          kind,
          unit: kind === "count" ? unit : null,
          levels: kind === "count" ? { min: Number(levels.min), std: Number(levels.std), elite: Number(levels.elite) } : levels,
          weekdays: days,
          goal_id: linked ? owner.goal_id : null,
          area_id: linked ? owner.area_id : null,
        };
        try {
          if (habit) await updateHabit(habit.id, { ...input, active });
          else await createHabit(input);
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That could not be saved.");
        }
      }}
    >
      <TextField id="habit-title" label="Habit" value={title} onChange={(e) => setTitle(e.target.value)} example="e.g. Drink water" />
      <div role="radiogroup" aria-label="How it is tracked" className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-surface-raised p-1">
        {(
          [
            ["count", "Count"],
            ["level", "Levels"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full text-caption font-semibold ${kind === k ? "bg-accent text-bg" : "text-text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      {kind === "count" ? <TextField id="habit-unit" label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} example="e.g. glasses" /> : null}
      <fieldset className="mb-4">
        <legend className="mb-1 text-caption text-text-muted">{kind === "count" ? "How many for each level" : "What each level means"}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["min", "std", "elite"] as const).map((k) => (
            <label key={k} className="text-caption text-text-muted">
              {k === "min" ? "Min" : k === "std" ? "Std" : "Elite"}
              <input
                id={`habit-${k}`}
                inputMode={kind === "count" ? "numeric" : "text"}
                value={levels[k]}
                placeholder={examples[k]}
                onChange={(e) => setLevels({ ...levels, [k]: e.target.value })}
                className={`${controlClass} mt-1 min-h-11`}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mb-4">
        <legend className="mb-2 text-caption text-text-muted">Days</legend>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={weekdayShort(d)}
                onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d].sort())}
                className={`flex min-h-11 items-center justify-center rounded-full border ${on ? "border-accent bg-accent font-semibold text-bg" : "border-border text-text-muted"}`}
              >
                {WEEKDAY_LETTERS[i]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mb-3 flex min-h-11 items-center justify-between">
        <span>Link to a goal or area</span>
        <Switch label="Link to a goal or area" checked={linked} onChange={setLinked} />
      </div>
      {linked ? (
        <div className="mb-4">
          <OwnerSelect aria-label="Goal or area" value={owner} onChange={setOwner} />
        </div>
      ) : null}
      {habit ? (
        <div className="mb-4 flex min-h-11 items-center justify-between">
          <span>Active</span>
          <Switch label="Active" checked={active} onChange={setActive} />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mb-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" block>
        Save
      </Button>
      {habit ? (
        <div className="mt-3 flex gap-3">
          <Button block onClick={() => void archiveHabit(habit.id).then(onClose)}>
            Archive
          </Button>
          <Button variant="danger" block onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      ) : null}
      <ConfirmSheet
        open={confirmDelete}
        title={`Delete "${habit?.title ?? ""}"?`}
        body="The habit and its history disappear. To keep the history, archive it instead."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (habit) await deleteHabit(habit.id);
          setConfirmDelete(false);
          onClose();
        }}
      />
    </form>
  );
}

/** "Min 1 · Std 2 · Elite 1" for a check-in's close screen. */
export function levelSummary(levels: Level[]): string {
  const n = (l: Level) => levels.filter((x) => x === l).length;
  return ([3, 2, 1] as Level[]).filter((l) => n(l)).map((l) => `${n(l)} ${LEVEL_LABEL[l]}`).join(" · ");
}
