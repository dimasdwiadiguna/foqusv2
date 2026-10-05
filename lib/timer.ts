/**
 * The focus timer (§5.9). Pure: the state of a session is computed from its stored anchor
 * (`state`, `completed_pomodoros`, `focus_seconds`) and "now", walking forward through focus and
 * break phases. Nothing ticks in storage, so the timer is right after backgrounding, locking, or a
 * reload. User actions (pause, resume, skip break, add a pomodoro, start the next phase, end) are
 * pure functions that return the new anchor to store.
 *
 * Anchor semantics: `focus_seconds` counts focus time up to `state.phase_started_at`;
 * `completed_pomodoros` counts pomodoros completed before the phase in progress.
 */
import type { FocusPomodoro, FocusSession, FocusSessionState } from "@/types";

export interface TimerConfig {
  focusMinutes: number;
  breakMinutes: number;
  /** Start the next phase automatically (§4.2 `auto_start_next_phase`). */
  autoStart: boolean;
}

export type TimerSession = Pick<
  FocusSession,
  "planned_pomodoros" | "completed_pomodoros" | "focus_seconds" | "pause_seconds" | "state" | "pomodoros"
>;

type Running = "focus" | "break";

export type TimerView =
  | (Common & { phase: Running })
  | (Common & { phase: "paused"; pausedPhase: Running })
  | (Common & { phase: "waiting"; nextPhase: Running; since: number })
  | (Common & { phase: "finished"; finishedAt: number })
  | (Common & { phase: "ended" });

interface Common {
  /** Seconds left in the current phase (0 when waiting, finished, or ended). */
  secondsRemaining: number;
  /** Length of the current (or paused) phase in seconds. */
  phaseSeconds: number;
  completed: number;
  planned: number;
  /** Focus time so far, including the running part of the current focus phase. */
  focusSeconds: number;
  /** Pomodoros completed since the stored anchor, with their times. */
  newPomodoros: FocusPomodoro[];
}

const iso = (ms: number) => new Date(ms).toISOString();
const phaseLength = (p: Running, c: TimerConfig) => (p === "focus" ? c.focusMinutes : c.breakMinutes) * 60;

/** Where the session is at `now` (epoch ms). */
export function timerAt(session: TimerSession, now: number, cfg: TimerConfig): TimerView {
  const st = session.state;
  const planned = session.planned_pomodoros;
  const base = { planned, newPomodoros: [] as FocusPomodoro[] };

  if (st.phase === "ended") {
    return { ...base, phase: "ended", secondsRemaining: 0, phaseSeconds: 0, completed: session.completed_pomodoros, focusSeconds: session.focus_seconds };
  }
  if (st.phase === "paused") {
    const pausedPhase = st.resume_phase ?? "focus";
    return {
      ...base,
      phase: "paused",
      pausedPhase,
      secondsRemaining: st.resume_seconds_remaining ?? phaseLength(pausedPhase, cfg),
      phaseSeconds: phaseLength(pausedPhase, cfg),
      completed: session.completed_pomodoros,
      focusSeconds: session.focus_seconds,
    };
  }

  let phase: Running = st.phase;
  let segStart = Date.parse(st.phase_started_at);
  let before = st.phase_elapsed_before ?? 0;
  let completed = session.completed_pomodoros;
  let focus = session.focus_seconds;
  const newPomodoros: FocusPomodoro[] = [];

  // Each pass handles one phase; a session has at most 2 × planned phases.
  for (let guard = 0; guard < planned * 2 + 2; guard++) {
    const len = phaseLength(phase, cfg);
    const phaseStart = segStart - before * 1000;
    const end = phaseStart + len * 1000;
    if (now < end) {
      return {
        ...base,
        newPomodoros,
        phase,
        secondsRemaining: (end - now) / 1000,
        phaseSeconds: len,
        completed,
        focusSeconds: focus + (phase === "focus" ? Math.max(0, now - segStart) / 1000 : 0),
      };
    }
    if (phase === "focus") {
      focus += len - before;
      newPomodoros.push({ index: completed, started_at: iso(phaseStart), ended_at: iso(end), completed: true });
      completed += 1;
      // No break after the last pomodoro.
      if (completed >= planned) {
        return { ...base, newPomodoros, phase: "finished", finishedAt: end, secondsRemaining: 0, phaseSeconds: len, completed, focusSeconds: focus };
      }
    }
    const next: Running = phase === "focus" ? "break" : "focus";
    if (!cfg.autoStart) {
      return { ...base, newPomodoros, phase: "waiting", nextPhase: next, since: end, secondsRemaining: 0, phaseSeconds: len, completed, focusSeconds: focus };
    }
    phase = next;
    segStart = end;
    before = 0;
  }
  return { ...base, newPomodoros, phase: "finished", finishedAt: now, secondsRemaining: 0, phaseSeconds: 0, completed, focusSeconds: focus };
}

/** The fields of a session an action changes. */
export type SessionPatch = Pick<TimerSession, "state" | "completed_pomodoros" | "focus_seconds" | "pomodoros"> &
  Partial<Pick<TimerSession, "planned_pomodoros" | "pause_seconds">>;

function carried(session: TimerSession, t: TimerView) {
  return {
    completed_pomodoros: t.completed,
    focus_seconds: Math.round(t.focusSeconds),
    pomodoros: [...session.pomodoros, ...t.newPomodoros],
  };
}

function runFrom(phase: Running, now: number, elapsedBefore = 0): FocusSessionState {
  return { phase, phase_started_at: iso(now), phase_elapsed_before: elapsedBefore };
}

/** Pause the running phase. Paused time does not count. */
export function pause(session: TimerSession, now: number, cfg: TimerConfig): SessionPatch | null {
  const t = timerAt(session, now, cfg);
  if (t.phase !== "focus" && t.phase !== "break") return null;
  return {
    ...carried(session, t),
    state: { phase: "paused", phase_started_at: iso(now), resume_phase: t.phase, resume_seconds_remaining: t.secondsRemaining },
  };
}

/** Resume a paused phase where it stopped; the pause is added to `pause_seconds`. */
export function resume(session: TimerSession, now: number, cfg: TimerConfig): SessionPatch | null {
  const st = session.state;
  if (st.phase !== "paused") return null;
  const phase = st.resume_phase ?? "focus";
  const remaining = st.resume_seconds_remaining ?? phaseLength(phase, cfg);
  return {
    completed_pomodoros: session.completed_pomodoros,
    focus_seconds: session.focus_seconds,
    pomodoros: session.pomodoros,
    pause_seconds: Math.round(session.pause_seconds + Math.max(0, now - Date.parse(st.phase_started_at)) / 1000),
    state: runFrom(phase, now, phaseLength(phase, cfg) - remaining),
  };
}

/** Skip the break (running or paused): the next focus starts now. */
export function skipBreak(session: TimerSession, now: number, cfg: TimerConfig): SessionPatch | null {
  const t = timerAt(session, now, cfg);
  const inBreak = t.phase === "break" || (t.phase === "paused" && t.pausedPhase === "break") || (t.phase === "waiting" && t.nextPhase === "break");
  if (!inBreak) return null;
  const pausePatch = t.phase === "paused" ? { pause_seconds: Math.round(session.pause_seconds + (now - Date.parse(session.state.phase_started_at)) / 1000) } : {};
  return { ...carried(session, t), ...pausePatch, state: runFrom("focus", now) };
}

/** With auto-start off: start the phase that is waiting. */
export function startNext(session: TimerSession, now: number, cfg: TimerConfig): SessionPatch | null {
  const t = timerAt(session, now, cfg);
  if (t.phase !== "waiting") return null;
  return { ...carried(session, t), state: runFrom(t.nextPhase, now) };
}

/**
 * Add a pomodoro to the plan. A finished session continues straight into a new focus phase;
 * otherwise the running plan just gets longer.
 */
export function addPomodoro(session: TimerSession, now: number, cfg: TimerConfig): SessionPatch {
  const t = timerAt(session, now, cfg);
  const planned = session.planned_pomodoros + 1;
  if (t.phase === "finished") return { ...carried(session, t), planned_pomodoros: planned, state: runFrom("focus", now) };
  return {
    completed_pomodoros: session.completed_pomodoros,
    focus_seconds: session.focus_seconds,
    pomodoros: session.pomodoros,
    planned_pomodoros: planned,
    state: session.state,
  };
}

/**
 * End the session at `now`. A focus phase in progress is discarded as a pomodoro, but its minutes
 * are kept in `focus_seconds` (§5.9).
 */
export function end(session: TimerSession, now: number, cfg: TimerConfig): SessionPatch & { pause_seconds: number } {
  const t = timerAt(session, now, cfg);
  const pomodoros = [...session.pomodoros, ...t.newPomodoros];
  const inFocus = t.phase === "focus" || (t.phase === "paused" && t.pausedPhase === "focus");
  if (inFocus && t.secondsRemaining < t.phaseSeconds) {
    const elapsed = t.phaseSeconds - t.secondsRemaining;
    pomodoros.push({ index: t.completed, started_at: iso(now - elapsed * 1000), ended_at: iso(now), completed: false });
  }
  const pauseNow = session.state.phase === "paused" ? (now - Date.parse(session.state.phase_started_at)) / 1000 : 0;
  return {
    completed_pomodoros: t.completed,
    focus_seconds: Math.round(t.focusSeconds),
    pause_seconds: Math.round(session.pause_seconds + pauseNow),
    pomodoros,
    state: { phase: "ended", phase_started_at: iso(now) },
  };
}

/** "18:42" (rounded up, so the display reaches 00:00 exactly at the end). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** A brand-new session's anchor: focus starts at `now`. */
export function initialState(now: number): FocusSessionState {
  return runFrom("focus", now);
}
