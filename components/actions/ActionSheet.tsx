"use client";

import { useState } from "react";
import { useWeekStart } from "@/data";
import { deleteAction, dropAction, reopenAction, updateAction } from "@/repo";
import type { Action } from "@/types";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { controlClass, TextArea, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { EstimateStepper } from "./EstimateStepper";
import { Stepper } from "@/components/ui/Stepper";
import { markDone } from "./ActionRow";
import { MoveSelect, OwnerSelect, type Owner } from "./OwnerSelect";

/** Edit an action: title, notes, goal or area, move, estimate, due date, this week; done, drop, delete. */
export function ActionSheet({ action, readOnly = false, onClose }: { action: Action | null; readOnly?: boolean; onClose: () => void }) {
  return (
    <Sheet open={action !== null} onClose={onClose} title={readOnly ? "Action" : "Edit action"}>
      {action ? <ActionForm key={action.id} action={action} readOnly={readOnly} onClose={onClose} /> : null}
    </Sheet>
  );
}

function ActionForm({ action, readOnly, onClose }: { action: Action; readOnly: boolean; onClose: () => void }) {
  const weekStart = useWeekStart();
  const [title, setTitle] = useState(action.title);
  const [notes, setNotes] = useState(action.notes ?? "");
  const [owner, setOwner] = useState<Owner>({ goal_id: action.goal_id, area_id: action.area_id });
  const [moveId, setMoveId] = useState(action.major_move_id);
  const [estimate, setEstimate] = useState(action.estimate_pomodoros);
  const [session, setSession] = useState<number | null>(action.session_pomodoros ?? null);
  const [due, setDue] = useState(action.due_on ?? "");
  const [thisWeek, setThisWeek] = useState(action.planned_week !== null && action.planned_week === weekStart);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isTodo = action.status === "todo";

  const run = (fn: () => Promise<unknown>) => async () => {
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    }
  };

  const save = run(async () => {
    // Leave a week from another list alone unless the toggle changed it.
    const wasThisWeek = action.planned_week !== null && action.planned_week === weekStart;
    await updateAction(action.id, {
      title,
      notes,
      goal_id: owner.goal_id,
      area_id: owner.area_id,
      major_move_id: owner.goal_id ? moveId : null,
      estimate_pomodoros: estimate,
      session_pomodoros: session,
      due_on: due || null,
      ...(thisWeek !== wasThisWeek ? { planned_week: thisWeek ? (weekStart ?? null) : null } : {}),
    });
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={readOnly}>
        <TextField id="action-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <TextArea id="action-notes" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mb-4">
          <label htmlFor="action-owner" className="mb-1 block text-caption text-text-muted">
            Goal or area
          </label>
          <OwnerSelect
            id="action-owner"
            value={owner}
            onChange={(o) => {
              setOwner(o);
              setMoveId(null);
            }}
          />
        </div>
        <MoveSelect id="action-move" goalId={owner.goal_id} value={moveId} onChange={setMoveId} />
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-caption text-text-muted">Estimate</span>
          <EstimateStepper value={estimate} onChange={setEstimate} />
        </div>
        {/* Work that needs several sittings (Stage 2 exit): scheduled as sessions of this size. */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-caption text-text-muted">
            In sessions
            <span className="block text-[12px]">{session ? `${Math.ceil(estimate / session)} sessions of ${session}` : "One sitting"}</span>
          </span>
          <div className="flex items-center gap-2">
            {session ? (
              <Stepper label="pomodoros per session" value={session} min={1} max={8} onChange={setSession} />
            ) : null}
            <Switch label="Split into sessions" checked={session !== null} onChange={(on) => setSession(on ? Math.max(1, Math.min(2, estimate)) : null)} />
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="action-due" className="mb-1 block text-caption text-text-muted">
            Due date
          </label>
          <div className="flex gap-2">
            <input id="action-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${controlClass} min-h-11`} />
            {due ? (
              <Button variant="ghost" onClick={() => setDue("")}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        {isTodo ? (
          <div className="mb-4 flex min-h-11 items-center justify-between">
            <span>This week</span>
            <Switch label="On this week's list" checked={thisWeek} onChange={setThisWeek} />
          </div>
        ) : null}
      </fieldset>

      {error ? (
        <p role="alert" className="mb-3 text-caption text-danger">
          {error}
        </p>
      ) : null}

      {readOnly ? null : (
        <>
          <Button type="submit" variant="primary" block>
            Save
          </Button>
          <div className="mt-3 flex flex-wrap gap-2">
            {isTodo ? (
              <>
                <Button className="flex-1" onClick={run(() => markDone(action))}>
                  Mark done
                </Button>
                <Button className="flex-1" onClick={run(() => dropAction(action.id))}>
                  Drop
                </Button>
              </>
            ) : (
              <Button className="flex-1" onClick={run(() => reopenAction(action.id))}>
                Reopen
              </Button>
            )}
            <Button variant="danger" className="flex-1" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </>
      )}
      <ConfirmSheet
        open={confirmDelete}
        title="Delete this action?"
        body="It disappears from every list. Drop it instead if you want to keep it in your history."
        confirmLabel="Delete"
        danger
        onConfirm={run(() => deleteAction(action.id))}
        onClose={() => setConfirmDelete(false)}
      />
    </form>
  );
}
