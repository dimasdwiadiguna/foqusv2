"use client";

import { useState } from "react";
import { useMovesForGoal, useSettings } from "@/data";
import { TIME_OPTIONS } from "@/lib/availability";
import { WEEKDAY_LETTERS } from "@/lib/schedule";
import { weekdayShort } from "@/lib/time";
import { createRule, deleteRule, updateRule } from "@/repo";
import type { RecurrenceRule, Weekday } from "@/types";
import { OwnerSelect, type Owner } from "@/components/actions/OwnerSelect";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { controlClass, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";

const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** The rule editor (§5.5): title, goal or area, weekdays, size, preferred time, dates, pause. */
export function RuleSheet({ rule, open, defaultOwner, onClose }: { rule: RecurrenceRule | null; open: boolean; defaultOwner: Owner; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={rule ? "Recurring action" : "New recurring action"}>
      {open ? <RuleForm rule={rule} defaultOwner={defaultOwner} onClose={onClose} /> : null}
    </Sheet>
  );
}

function RuleForm({ rule, defaultOwner, onClose }: { rule: RecurrenceRule | null; defaultOwner: Owner; onClose: () => void }) {
  const settings = useSettings();
  const [title, setTitle] = useState(rule?.title ?? "");
  const [owner, setOwner] = useState<Owner>(rule ? { goal_id: rule.goal_id, area_id: rule.area_id } : defaultOwner);
  const [moveId, setMoveId] = useState(rule?.major_move_id ?? "");
  const [days, setDays] = useState<Weekday[]>(rule?.weekdays ?? [1, 2, 3, 4, 5]);
  const [pomodoros, setPomodoros] = useState(rule?.pomodoros ?? 1);
  const [time, setTime] = useState(rule?.preferred_start ?? "");
  const [endsOn, setEndsOn] = useState(rule?.ends_on ?? "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const moves = useMovesForGoal(owner.goal_id) ?? [];
  const max = settings?.max_pomodoros_per_block ?? 4;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const fields = {
          title,
          weekdays: days,
          pomodoros,
          preferred_start: time || null,
          goal_id: owner.goal_id,
          area_id: owner.area_id,
          major_move_id: owner.goal_id ? moveId || null : null,
        };
        try {
          if (rule) await updateRule(rule.id, { ...fields, ends_on: endsOn || null, active });
          // A new rule's end date defaults to the goal's season plan end (open-ended for areas).
          else await createRule({ ...fields, ...(endsOn ? { ends_on: endsOn } : {}) });
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That could not be saved.");
        }
      }}
    >
      <TextField id="rule-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} example="e.g. Write 500 words" />
      <div className="mb-4">
        <label htmlFor="rule-owner" className="mb-1 block text-caption text-text-muted">
          Goal or area
        </label>
        <OwnerSelect id="rule-owner" value={owner} onChange={(o) => (setOwner(o), setMoveId(""))} />
      </div>
      {owner.goal_id && moves.length ? (
        <div className="mb-4">
          <label htmlFor="rule-move" className="mb-1 block text-caption text-text-muted">
            Major move
          </label>
          <select id="rule-move" value={moveId} onChange={(e) => setMoveId(e.target.value)} className={`${controlClass} min-h-11`}>
            <option value="">No major move</option>
            {moves.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
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
      <div className="mb-4 flex min-h-11 items-center justify-between">
        <span>Pomodoros each time</span>
        <Stepper label="pomodoros each time" value={pomodoros} min={1} max={max} onChange={setPomodoros} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="rule-time" className="mb-1 block text-caption text-text-muted">
            Preferred time
          </label>
          <select id="rule-time" value={time} onChange={(e) => setTime(e.target.value)} className={`${controlClass} min-h-11`}>
            <option value="">Any time</option>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rule-ends" className="mb-1 block text-caption text-text-muted">
            Ends {owner.goal_id && !rule ? "(default: plan end)" : "(optional)"}
          </label>
          <input id="rule-ends" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={`${controlClass} min-h-11`} />
        </div>
      </div>
      {rule ? (
        <div className="mb-4 flex min-h-11 items-center justify-between">
          <span>
            Active
            <span className="block text-caption text-text-muted">Paused rules stop adding new occurrences.</span>
          </span>
          <Switch label="Active" checked={active} onChange={setActive} />
        </div>
      ) : null}
      <p className="mb-3 text-caption text-text-muted">Changes apply from today on. Occurrences that already have a block stay as they are.</p>
      {error ? (
        <p role="alert" className="mb-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" block>
        Save
      </Button>
      {rule ? (
        <Button variant="danger" block className="mt-3" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      ) : null}
      <ConfirmSheet
        open={confirmDelete}
        title={`Delete "${rule?.title ?? ""}"?`}
        body="Past occurrences stay in your history. Upcoming ones without a block are removed."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (rule) await deleteRule(rule.id);
          setConfirmDelete(false);
          onClose();
        }}
      />
    </form>
  );
}
