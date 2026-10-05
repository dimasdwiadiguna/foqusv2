"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBlocksForActions, useRow } from "@/data";
import type { TimerView } from "@/lib/timer";
import { endSession } from "@/repo";
import type { FocusSession } from "@/types";
import { celebrate } from "@/components/celebration/celebrate";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";

/**
 * Ending a session (§5.9): the away check if it finished unseen, "Is this action done?", "Done, or
 * needs more time?" when the estimate is used up, a 1–5 focus rating, and an optional note.
 */
export function EndSheet({
  open,
  session,
  timer,
  awayCheck,
  onClose,
}: {
  open: boolean;
  session: FocusSession;
  timer: TimerView;
  awayCheck: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={timer.phase === "finished" ? "Session complete" : "End session"}>
      {open ? <EndForm session={session} timer={timer} awayCheck={awayCheck} /> : null}
    </Sheet>
  );
}

function EndForm({ session, timer, awayCheck }: { session: FocusSession; timer: TimerView; awayCheck: boolean }) {
  const router = useRouter();
  const action = useRow("actions", session.action_id);
  const blocks = useBlocksForActions([session.action_id]);
  const [completed, setCompleted] = useState(session.planned_pomodoros);
  const [done, setDone] = useState<boolean | null>(null);
  const [extra, setExtra] = useState(1);
  const [moreTime, setMoreTime] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thisSession = awayCheck ? completed : timer.completed;
  // Pomodoros already on the action's other blocks, plus this session's.
  const before = (blocks ?? []).filter((b) => b.id !== session.block_id).reduce((n, b) => n + b.completed_pomodoros, 0);
  const estimateUsed = action ? before + thisSession >= action.estimate_pomodoros : false;
  const askMoreTime = done === false && estimateUsed;

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const actionDone = done === true || (askMoreTime && !moreTime);
      await endSession(session.id, {
        completed: awayCheck ? completed : undefined,
        actionDone,
        extraPomodoros: askMoreTime && moreTime ? extra : undefined,
        focusRating: rating,
        note,
      });
      if (actionDone) void celebrate("action");
      router.push("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The session could not be ended.");
      setBusy(false);
    }
  };

  const choice = (on: boolean) => `flex-1 ${on ? "!border-accent !text-accent" : ""}`;

  return (
    <>
      {awayCheck ? (
        <section className="mb-5">
          <p className="mb-2">
            You planned {session.planned_pomodoros} {session.planned_pomodoros === 1 ? "pomodoro" : "pomodoros"}. How many did you complete?
          </p>
          <Stepper label="completed pomodoros" value={completed} min={0} max={session.planned_pomodoros} onChange={setCompleted} />
        </section>
      ) : (
        <p className="mb-4 text-text-muted">
          {timer.completed} of {session.planned_pomodoros} {session.planned_pomodoros === 1 ? "pomodoro" : "pomodoros"} completed.
        </p>
      )}

      <section className="mb-5">
        <p className="mb-2">Is this action done?</p>
        <div className="flex gap-2">
          <Button className={choice(done === true)} aria-pressed={done === true} onClick={() => setDone(true)}>
            Yes
          </Button>
          <Button className={choice(done === false)} aria-pressed={done === false} onClick={() => setDone(false)}>
            Not yet
          </Button>
        </div>
      </section>

      {askMoreTime ? (
        <section className="mb-5 rounded-card border border-border p-3">
          <p className="mb-2">You&apos;ve used the estimate. Done, or needs more time?</p>
          <div className="mb-3 flex gap-2">
            <Button className={choice(!moreTime)} aria-pressed={!moreTime} onClick={() => setMoreTime(false)}>
              Done
            </Button>
            <Button className={choice(moreTime)} aria-pressed={moreTime} onClick={() => setMoreTime(true)}>
              More time
            </Button>
          </div>
          {moreTime ? (
            <div className="flex items-center justify-between">
              <span>Add how many pomodoros?</span>
              <Stepper label="extra pomodoros" value={extra} min={1} max={20} onChange={setExtra} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mb-5">
        <p id="rating-label" className="mb-2">
          How was your focus?
        </p>
        <div role="radiogroup" aria-labelledby="rating-label" className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} of 5`}
              onClick={() => setRating(n)}
              className="flex size-11 items-center justify-center"
            >
              <span className={`size-6 rounded-full border-2 border-accent ${rating !== null && n <= rating ? "bg-accent" : ""}`} />
            </button>
          ))}
        </div>
      </section>

      <label htmlFor="session-note" className="mb-1 block">
        Note (optional)
      </label>
      <input id="session-note" value={note} onChange={(e) => setNote(e.target.value)} className={`${controlClass} mb-4 min-h-11`} />

      {error ? (
        <p role="alert" className="mb-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
      <Button variant="primary" block disabled={busy || done === null} onClick={() => void finish()}>
        Finish
      </Button>
    </>
  );
}
