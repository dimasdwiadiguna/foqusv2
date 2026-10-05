"use client";

import { useState } from "react";
import { useRow, useSettings } from "@/data";
import { TIME_OPTIONS } from "@/lib/availability";
import { toLocalDate, toLocalTime, zonedToInstant } from "@/lib/time";
import { deleteBlock, markBlockDone } from "@/repo";
import type { Block, Settings } from "@/types";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { controlClass } from "@/components/ui/Field";
import { PomodoroDots } from "@/components/ui/PomodoroDots";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { usePlacement } from "./PlacementProvider";
import { useStartFocus } from "@/components/focus/useStartFocus";

/**
 * The block sheet (§6.7 Plan): title, goal or area, time, a pomodoro stepper, a buffer stepper,
 * then "Mark done" and "Delete". Day and start time make it the tap alternative to every drag.
 */
export function BlockSheet({ block, onClose }: { block: Block | null; onClose: () => void }) {
  const settings = useSettings();
  return (
    <Sheet open={block !== null} onClose={onClose} title="Block">
      {block && settings ? <BlockForm key={block.id + block.updated_at} block={block} settings={settings} onClose={onClose} /> : null}
    </Sheet>
  );
}

function BlockForm({ block, settings, onClose }: { block: Block; settings: Settings; onClose: () => void }) {
  const action = useRow("actions", block.action_id);
  const goal = useRow("goals", action?.goal_id ?? "");
  const area = useRow("areas", action?.area_id ?? "");
  const { place } = usePlacement();
  const focus = useStartFocus();
  const tz = settings.timezone;
  const [date, setDate] = useState(toLocalDate(block.starts_at, tz));
  const [time, setTime] = useState(toLocalTime(block.starts_at, tz));
  const [pomodoros, setPomodoros] = useState(block.planned_pomodoros);
  const [buffer, setBuffer] = useState(block.buffer_minutes);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const done = block.status === "done";
  const editable = block.status === "scheduled" || block.status === "draft";
  const changed =
    date !== toLocalDate(block.starts_at, tz) ||
    time !== toLocalTime(block.starts_at, tz) ||
    pomodoros !== block.planned_pomodoros ||
    buffer !== block.buffer_minutes;

  return (
    <>
      <p className="text-heading">{action?.title ?? "Deleted action"}</p>
      <p className="mb-1 flex flex-wrap items-center gap-x-2 text-caption text-text-muted">
        <span>{goal?.title ?? area?.name ?? ""}</span>
        <span>
          {toLocalTime(block.starts_at, tz)} – {toLocalTime(block.ends_at, tz)}
        </span>
        <PomodoroDots completed={block.completed_pomodoros} total={block.planned_pomodoros} className="text-accent" />
      </p>
      <p className="mb-4 flex flex-wrap gap-2 text-caption">
        {done ? <span className="text-success">✓ Done</span> : null}
        {block.off_peak ? <span className="rounded-full border border-border px-2 text-text-muted">off-peak</span> : null}
        {block.after_due ? <span className="rounded-full border border-warning/60 px-2 text-warning">after due date</span> : null}
      </p>

      {block.status === "scheduled" || block.status === "active" ? (
        <div className="mb-4">
          <Button
            variant="primary"
            block
            onClick={() => void focus.start({ blockId: block.id, pomodoros: block.planned_pomodoros })}
          >
            {block.status === "active" ? "Back to focus" : "Start focus"}
          </Button>
          {focus.dialog}
        </div>
      ) : null}
      {editable ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="block-date" className="mb-1 block text-caption text-text-muted">
                Day
              </label>
              <input id="block-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${controlClass} min-h-11`} />
            </div>
            <div>
              <label htmlFor="block-time" className="mb-1 block text-caption text-text-muted">
                Start
              </label>
              <select id="block-time" value={time} onChange={(e) => setTime(e.target.value)} className={`${controlClass} min-h-11`}>
                {(TIME_OPTIONS.includes(time) ? TIME_OPTIONS : [time, ...TIME_OPTIONS]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3 flex items-center justify-between">
            <span>Pomodoros</span>
            <Stepper label="pomodoros" value={pomodoros} min={1} max={settings.max_pomodoros_per_block} onChange={setPomodoros} />
          </div>
          <div className="mb-4 flex items-center justify-between">
            <span>Buffer after</span>
            <Stepper label="buffer" value={buffer} min={0} max={60} step={5} unit="min" onChange={setBuffer} />
          </div>
          {changed ? (
            <Button
              variant="primary"
              block
              disabled={busy || !action}
              className="mb-3"
              onClick={async () => {
                if (!action) return;
                setBusy(true);
                const ok = await place(action, { start: Date.parse(zonedToInstant(date, time, tz)), pomodoros, bufferMinutes: buffer }, block);
                setBusy(false);
                if (ok) onClose();
              }}
            >
              Save changes
            </Button>
          ) : null}
        </>
      ) : null}

      <div className="flex gap-2">
        {editable ? (
          <Button
            className="flex-1"
            onClick={async () => {
              await markBlockDone(block.id);
              onClose();
            }}
          >
            Mark done
          </Button>
        ) : null}
        <Button variant="danger" className="flex-1" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>
      <ConfirmSheet
        open={confirmDelete}
        title="Delete this block?"
        body="The time is freed. The action stays on your list."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteBlock(block.id);
          setConfirmDelete(false);
          onClose();
        }}
      />
    </>
  );
}
