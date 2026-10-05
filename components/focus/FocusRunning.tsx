"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getBlocksForDays, getRow, useNow, useRow, useSettings } from "@/data";
import { blockSpan, occupies } from "@/lib/availability";
import { MINUTE, overlaps } from "@/lib/intervals";
import { formatClock, timerAt, type TimerConfig, type TimerView } from "@/lib/timer";
import { addDays, toLocalDate, toLocalTime } from "@/lib/time";
import { addAction, addSessionPomodoro, saveScratchpad, sessionStep } from "@/repo";
import type { FocusSession, Settings } from "@/types";
import { prefersReducedMotion } from "@/components/celebration/celebrate";
import { ChevronDownIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { EndSheet } from "./EndSheet";
import { useWakeLock } from "./useWakeLock";

/** The running session (§5.9, §6.7 Focus). Everything shown is computed from the stored anchor and now. */
export function FocusRunning({ session }: { session: FocusSession }) {
  const settings = useSettings();
  if (!settings) return null;
  return <Running session={session} settings={settings} />;
}

function Running({ session, settings }: { session: FocusSession; settings: Settings }) {
  const router = useRouter();
  const now = useNow(1000);
  const action = useRow("actions", session.action_id);
  const goal = useRow("goals", action?.goal_id ?? "");
  const area = useRow("areas", action?.area_id ?? "");
  const cfg: TimerConfig = { focusMinutes: settings.focus_minutes, breakMinutes: settings.break_minutes, autoStart: settings.auto_start_next_phase };
  const t = timerAt(session, now, cfg);
  const wake = useWakeLock(t.phase !== "finished");
  const [sheet, setSheet] = useState<"notes" | "capture" | "end" | null>(null);
  const [clash, setClash] = useState<Clash | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Phase transitions, tracked during render (React's "adjust state when a value changes").
  // Away check: a session that finished while nobody was watching asks how many were completed.
  const [prevPhase, setPrevPhase] = useState<TimerView["phase"]>(t.phase);
  const [observedFinish, setObservedFinish] = useState(false);
  const [burst, setBurst] = useState<number | null>(null);
  if (prevPhase !== t.phase) {
    setPrevPhase(t.phase);
    // Seen live only if the screen noticed within a few seconds; after a lock or backgrounding the
    // first render comes long after the finish, and that is an away return.
    if (t.phase === "finished" && now - t.finishedAt < 5000) setObservedFinish(true);
    if (prevPhase === "focus") setBurst(t.completed - 1);
  }
  // Phase change: a soft flash (§6.7).
  const flash = useRef<HTMLDivElement>(null);
  const firstPhase = useRef(true);
  useEffect(() => {
    if (firstPhase.current) {
      firstPhase.current = false;
      return;
    }
    flash.current?.animate([{ opacity: 0 }, { opacity: 0.18 }, { opacity: 0 }], { duration: prefersReducedMotion() ? 300 : 700 });
  }, [t.phase]);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const add = async (opts: { pushBlockId?: string; trayBlockId?: string } = {}) => {
    setClash(null);
    try {
      await addSessionPomodoro(session.id, opts);
    } catch (e) {
      say(e instanceof Error ? e.message : "That could not be added.");
    }
  };
  const onAdd = async () => {
    const hit = await findAddClash(session, settings.timezone);
    if (hit) setClash(hit);
    else await add();
  };

  const label = t.phase === "break" || (t.phase === "paused" && t.pausedPhase === "break") ? "BREAK" : t.phase === "paused" ? "PAUSED" : t.phase === "waiting" ? (t.nextPhase === "break" ? "BREAK NEXT" : "FOCUS NEXT") : t.phase === "finished" ? "DONE" : "FOCUS";
  const isBreak = t.phase === "break" || (t.phase === "paused" && t.pausedPhase === "break");
  const color = isBreak ? "var(--color-success)" : "var(--color-accent)";
  const fraction = t.phaseSeconds > 0 ? t.secondsRemaining / t.phaseSeconds : 0;

  return (
    <>
      <div ref={flash} aria-hidden="true" className="pointer-events-none fixed inset-0 z-20 bg-white opacity-0" />
      <header className="flex items-center justify-between px-2 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" aria-label="Minimise" onClick={() => router.push("/today")} className="flex size-11 items-center justify-center text-text-muted">
          <ChevronDownIcon className="size-7" />
        </button>
        <Dots completed={t.completed} planned={t.planned} burst={burst} />
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-caption tracking-[0.2em]" style={{ color }}>
          {label}
        </p>
        <div className="relative my-4 flex size-80 max-w-full items-center justify-center">
          <Ring fraction={fraction} color={color} />
          <span role="timer" aria-live="off" className="text-timer tabular-nums" style={{ color: isBreak ? color : undefined }}>
            {formatClock(t.secondsRemaining)}
          </span>
        </div>
        <h1 className="text-heading">{action?.title ?? "Focus"}</h1>
        <p className="text-text-muted">{goal?.title ?? area?.name ?? ""}</p>
        {wake === "unsupported" ? (
          <p className="mt-3 text-caption text-text-muted">To keep the screen on, set Auto-Lock to Never in Settings → Display &amp; Brightness.</p>
        ) : null}
      </main>

      <div className="px-6">
        <div className="mb-4 flex justify-center gap-3">
          <Button onClick={() => setSheet("notes")}>Notes</Button>
          <Button onClick={() => setSheet("capture")}>Capture</Button>
        </div>
        <div className="mb-[max(env(safe-area-inset-bottom),16px)] grid grid-cols-3 gap-2">
          {t.phase === "waiting" ? (
            <Button variant="primary" onClick={() => void sessionStep(session.id, "startNext")}>
              Start {t.nextPhase}
            </Button>
          ) : isBreak ? (
            <Button variant="primary" onClick={() => void sessionStep(session.id, "skipBreak")}>
              Skip break
            </Button>
          ) : t.phase === "paused" ? (
            <Button variant="primary" onClick={() => void sessionStep(session.id, "resume")}>
              Resume
            </Button>
          ) : (
            <Button onClick={() => void sessionStep(session.id, "pause")} disabled={t.phase === "finished"}>
              Pause
            </Button>
          )}
          <Button onClick={() => void onAdd()} aria-label="Add a pomodoro">
            +1 ●
          </Button>
          <Button variant="danger" onClick={() => setSheet("end")}>
            End
          </Button>
        </div>
      </div>

      <NotesSheet open={sheet === "notes"} session={session} onClose={() => setSheet(null)} />
      <CaptureSheet
        open={sheet === "capture"}
        onClose={() => setSheet(null)}
        onAdded={(title) => {
          setSheet(null);
          say(`“${title}” added to Other.`);
        }}
      />
      <AddClashSheet clash={clash} onPick={(opts) => void add(opts)} onClose={() => setClash(null)} />
      <EndSheet
        open={sheet === "end" || t.phase === "finished"}
        session={session}
        timer={t}
        awayCheck={t.phase === "finished" && !observedFinish}
        onClose={() => setSheet(null)}
      />
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[70] flex justify-center px-4">
        {toast ? <p className="rounded-card border border-border bg-surface-raised px-4 py-3 shadow-lg">{toast}</p> : null}
      </div>
    </>
  );
}

function Ring({ fraction, color }: { fraction: number; color: string }) {
  const r = 156;
  const c = 2 * Math.PI * r;
  return (
    <svg aria-hidden="true" viewBox="0 0 320 320" className="absolute inset-0 -rotate-90">
      <circle cx="160" cy="160" r={r} fill="none" stroke="var(--color-surface-raised)" strokeWidth="3" />
      <circle
        cx="160"
        cy="160"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

/** Pomodoro dots; the one just completed fills with a small burst. */
function Dots({ completed, planned, burst }: { completed: number; planned: number; burst: number | null }) {
  return (
    <span role="img" aria-label={`${completed} of ${planned} pomodoros done`} className="flex items-center gap-1.5 pr-3 text-accent">
      {Array.from({ length: Math.max(planned, completed) }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`size-2.5 rounded-full border border-current ${i < completed ? "bg-current" : ""} ${i === burst ? "animate-[pop_500ms_ease-out]" : ""}`}
        />
      ))}
    </span>
  );
}

function NotesSheet({ open, session, onClose }: { open: boolean; session: FocusSession; onClose: () => void }) {
  const [text, setText] = useState(session.scratchpad ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const save = (v: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveScratchpad(session.id, v), 400);
  };
  return (
    <Sheet
      open={open}
      onClose={() => {
        clearTimeout(timer.current);
        void saveScratchpad(session.id, text);
        onClose();
      }}
      title="Notes"
    >
      <label htmlFor="scratchpad" className="sr-only">
        Scratchpad
      </label>
      <textarea
        id="scratchpad"
        rows={8}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          save(e.target.value);
        }}
        placeholder="Thoughts, links, what to do next…"
        className={`${controlClass} resize-none`}
      />
      <p className="mt-1 text-caption text-text-muted">Saved with this session as you type.</p>
    </Sheet>
  );
}

function CaptureSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (title: string) => void }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Capture">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            const a = await addAction({ title });
            setTitle("");
            onAdded(a.title);
          } catch (err) {
            setError(err instanceof Error ? err.message : "That could not be added.");
          }
        }}
      >
        <label htmlFor="capture" className="sr-only">
          Something to do later
        </label>
        <input id="capture" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Something for later" className={`${controlClass} min-h-11 flex-1`} />
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          Add
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-caption text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-caption text-text-muted">It goes to “Other”, so you can stay in the session.</p>
      )}
    </Sheet>
  );
}

interface Clash {
  id: string;
  title: string;
  at: string;
}

/** Would one more pomodoro run the session's block into another block? */
async function findAddClash(session: FocusSession, tz: string): Promise<Clash | null> {
  const block = session.block_id ? await getRow("blocks", session.block_id) : undefined;
  if (!block) return null;
  const span = blockSpan(block);
  const longer = { start: span.start, end: span.end + 30 * MINUTE };
  const day = toLocalDate(span.start, tz);
  const near = await getBlocksForDays(addDays(day, -1), addDays(day, 1), tz);
  const hit = near.find((b) => b.id !== block.id && occupies(b) && overlaps(longer, blockSpan(b)));
  if (!hit) return null;
  return { id: hit.id, title: (await getRow("actions", hit.action_id))?.title ?? "another block", at: toLocalTime(hit.starts_at, tz) };
}

/** +1 pomodoro (§5.9) when it runs into the next block: push that block later, or move it to the tray. */
function AddClashSheet({ clash, onPick, onClose }: { clash: Clash | null; onPick: (opts: { pushBlockId?: string; trayBlockId?: string }) => void; onClose: () => void }) {
  return (
    <Sheet open={clash !== null} onClose={onClose} title="Add a pomodoro?">
      {clash ? (
        <>
          <p className="mb-4 text-text-muted">
            This runs into {clash.title} at {clash.at}.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => onPick({ pushBlockId: clash.id })}>
              Push {clash.title} later
            </Button>
            <Button onClick={() => onPick({ trayBlockId: clash.id })}>Move it back to the tray</Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </>
      ) : null}
    </Sheet>
  );
}
