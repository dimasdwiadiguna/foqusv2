"use client";

import { useState } from "react";
import { usePersonalBlocks, useWindows } from "@/data";
import { TIME_OPTIONS } from "@/lib/availability";
import { WEEKDAY_LETTERS } from "@/lib/schedule";
import { weekdayShort } from "@/lib/time";
import { copyWindowToAllDays, createPersonalBlock, deletePersonalBlock, updatePersonalBlock, updateWindow } from "@/repo";
import type { PersonalBlock, Weekday } from "@/types";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { controlClass, TextField } from "@/components/ui/Field";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";

export const END_OPTIONS = [...TIME_OPTIONS.slice(1), "24:00"];
const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Settings → Schedule (§5.6, §6.7): availability and peak per weekday, and personal blocks. */
export function ScheduleSettings() {
  const availability = useWindows("availability");
  const peak = useWindows("peak");
  const [day, setDay] = useState<Weekday | null>(null);
  if (!availability || !peak) return null;

  return (
    <>
      <SettingsGroup title="Schedule">
        {DAYS.map((d) => {
          const a = availability.find((w) => w.weekday === d);
          const p = peak.find((w) => w.weekday === d);
          return (
            <button key={d} type="button" onClick={() => setDay(d)} className="flex min-h-11 w-full items-center gap-3 px-3 text-left">
              <span className="w-10 font-semibold">{weekdayShort(d)}</span>
              <span className="min-w-0 flex-1 truncate">
                {a?.start_time}–{a?.end_time}
                <span className="text-caption text-text-muted">
                  {" · peak "}
                  {p?.start_time}–{p?.end_time}
                </span>
              </span>
              <span aria-hidden="true" className="text-text-muted">
                ›
              </span>
            </button>
          );
        })}
      </SettingsGroup>

      <PersonalBlocksSettings />

      <Sheet open={day !== null} onClose={() => setDay(null)} title={day ? `${weekdayShort(day)} hours` : "Hours"}>
        {day ? (
          <DayForm
            key={day}
            day={day}
            availability={availability.find((w) => w.weekday === day)!}
            peak={peak.find((w) => w.weekday === day)!}
            onClose={() => setDay(null)}
          />
        ) : null}
      </Sheet>
    </>
  );
}

/** Settings → Personal blocks (§5.6); also a step of first-run setup. */
export function PersonalBlocksSettings() {
  const personal = usePersonalBlocks();
  const [editing, setEditing] = useState<PersonalBlock | "new" | null>(null);
  if (!personal) return null;
  return (
    <>
      <SettingsGroup title="Personal blocks">
        {personal.length === 0 ? <p className="px-3 py-2 text-text-muted">Meals, routines, and rest that FOQUS never schedules over.</p> : null}
        {personal.map((p) => (
          <button key={p.id} type="button" onClick={() => setEditing(p)} className="flex min-h-12 w-full items-center gap-3 px-3 py-1.5 text-left">
            <span className="min-w-0 flex-1">
              <span className={`block truncate ${p.active ? "" : "text-text-muted line-through"}`}>{p.label}</span>
              <span className="block text-caption text-text-muted">
                {p.start_time}–{p.end_time} · {formatDays(p.weekdays)}
                {p.active ? "" : " · paused"}
              </span>
            </span>
            <span aria-hidden="true" className="text-text-muted">
              ›
            </span>
          </button>
        ))}
        <div className="px-4 py-2">
          <Button block onClick={() => setEditing("new")}>
            Add a personal block
          </Button>
        </div>
      </SettingsGroup>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New personal block" : "Personal block"}>
        {editing ? <PersonalForm key={editing === "new" ? "new" : editing.id} block={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

function formatDays(days: Weekday[]): string {
  const key = days.join("");
  if (key === "1234567") return "every day";
  if (key === "12345") return "weekdays";
  if (key === "67") return "weekends";
  return days.map((d) => weekdayShort(d)).join(", ");
}

export function TimeSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-caption text-text-muted">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${controlClass} min-h-11`}>
        {(options.includes(value) ? options : [value, ...options]).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

function DayForm({
  day,
  availability,
  peak,
  onClose,
}: {
  day: Weekday;
  availability: { start_time: string; end_time: string };
  peak: { start_time: string; end_time: string };
  onClose: () => void;
}) {
  const [a, setA] = useState({ start: availability.start_time, end: availability.end_time });
  const [p, setP] = useState({ start: peak.start_time, end: peak.end_time });
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => async () => {
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    }
  };

  return (
    <>
      <fieldset className="mb-2">
        <legend className="mb-2 font-semibold">Available hours</legend>
        <div className="grid grid-cols-2 gap-3">
          <TimeSelect id="avail-start" label="From" value={a.start} options={TIME_OPTIONS} onChange={(v) => setA({ ...a, start: v })} />
          <TimeSelect id="avail-end" label="To" value={a.end} options={END_OPTIONS} onChange={(v) => setA({ ...a, end: v })} />
        </div>
        <Button variant="ghost" className="mt-1 px-0 text-accent" onClick={run(() => copyWindowToAllDays("availability", a.start, a.end))}>
          Copy to all days
        </Button>
      </fieldset>
      <fieldset className="mb-4">
        <legend className="mb-2 font-semibold">Peak window</legend>
        <p className="mb-2 text-caption text-text-muted">Goal work is scheduled here first.</p>
        <div className="grid grid-cols-2 gap-3">
          <TimeSelect id="peak-start" label="From" value={p.start} options={TIME_OPTIONS} onChange={(v) => setP({ ...p, start: v })} />
          <TimeSelect id="peak-end" label="To" value={p.end} options={END_OPTIONS} onChange={(v) => setP({ ...p, end: v })} />
        </div>
        <Button variant="ghost" className="mt-1 px-0 text-accent" onClick={run(() => copyWindowToAllDays("peak", p.start, p.end))}>
          Copy to all days
        </Button>
      </fieldset>
      {error ? (
        <p role="alert" className="mb-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
      <Button
        variant="primary"
        block
        onClick={run(async () => {
          await updateWindow("availability", day, a.start, a.end);
          await updateWindow("peak", day, p.start, p.end);
        })}
      >
        Save {weekdayShort(day)}
      </Button>
    </>
  );
}

function PersonalForm({ block, onClose }: { block: PersonalBlock | null; onClose: () => void }) {
  const [label, setLabel] = useState(block?.label ?? "");
  const [days, setDays] = useState<Weekday[]>(block?.weekdays ?? [1, 2, 3, 4, 5, 6, 7]);
  const [start, setStart] = useState(block?.start_time ?? "12:00");
  const [end, setEnd] = useState(block?.end_time ?? "13:00");
  const [active, setActive] = useState(block?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          const input = { label, weekdays: days, start_time: start, end_time: end, active };
          if (block) await updatePersonalBlock(block.id, input);
          else await createPersonalBlock(input);
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That could not be saved.");
        }
      }}
    >
      <TextField id="personal-label" label="Label" value={label} onChange={(e) => setLabel(e.target.value)} example="e.g. Lunch" />
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
      <div className="mb-4 grid grid-cols-2 gap-3">
        <TimeSelect id="personal-start" label="From" value={start} options={TIME_OPTIONS} onChange={setStart} />
        <TimeSelect id="personal-end" label="To" value={end} options={END_OPTIONS} onChange={setEnd} />
      </div>
      <div className="mb-4 flex min-h-11 items-center justify-between">
        <span>Active</span>
        <Switch label="Active" checked={active} onChange={setActive} />
      </div>
      {error ? (
        <p role="alert" className="mb-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" block>
        Save
      </Button>
      {block ? (
        <Button variant="danger" block className="mt-3" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      ) : null}
      <ConfirmSheet
        open={confirmDelete}
        title={`Delete ${block?.label ?? "this block"}?`}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (block) await deletePersonalBlock(block.id);
          setConfirmDelete(false);
          onClose();
        }}
      />
    </form>
  );
}
