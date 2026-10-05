import { describe, expect, it } from "vitest";
import { addPomodoro, end, formatClock, initialState, pause, resume, skipBreak, startNext, timerAt, type TimerSession } from "./timer";

const T0 = Date.parse("2026-10-06T00:00:00Z");
const min = (m: number) => T0 + m * 60_000;
const cfg = { focusMinutes: 25, breakMinutes: 5, autoStart: true };
const fresh = (planned: number): TimerSession => ({
  planned_pomodoros: planned,
  completed_pomodoros: 0,
  focus_seconds: 0,
  pause_seconds: 0,
  pomodoros: [],
  state: initialState(T0),
});
const apply = (s: TimerSession, patch: Partial<TimerSession> | null): TimerSession => {
  if (!patch) throw new Error("no patch");
  return { ...s, ...patch };
};

describe("timerAt", () => {
  it("counts down focus, then break, then focus", () => {
    const s = fresh(3);
    expect(timerAt(s, min(10), cfg)).toMatchObject({ phase: "focus", secondsRemaining: 15 * 60, completed: 0, focusSeconds: 600 });
    expect(timerAt(s, min(27), cfg)).toMatchObject({ phase: "break", secondsRemaining: 3 * 60, completed: 1, focusSeconds: 1500 });
    expect(timerAt(s, min(31), cfg)).toMatchObject({ phase: "focus", secondsRemaining: 24 * 60, completed: 1, focusSeconds: 1560 });
  });

  it("has no break after the last pomodoro, and finishes", () => {
    const t = timerAt(fresh(2), min(55), cfg);
    expect(t).toMatchObject({ phase: "finished", completed: 2, focusSeconds: 3000, finishedAt: min(55) });
    expect(t.newPomodoros.map((p) => p.ended_at)).toEqual([new Date(min(25)).toISOString(), new Date(min(55)).toISOString()]);
  });

  it("a return after the whole planned time shows every pomodoro done", () => {
    const t = timerAt(fresh(3), min(500), cfg);
    expect(t).toMatchObject({ phase: "finished", completed: 3, focusSeconds: 4500, finishedAt: min(85) });
  });

  it("a reload mid-phase resumes at the right second (state is all that is stored)", () => {
    const s = JSON.parse(JSON.stringify(fresh(2))) as TimerSession;
    expect(timerAt(s, min(12) + 30_000, cfg).secondsRemaining).toBe(12 * 60 + 30);
  });

  it("waits between phases when auto-start is off", () => {
    const manual = { ...cfg, autoStart: false };
    const t = timerAt(fresh(2), min(40), manual);
    expect(t).toMatchObject({ phase: "waiting", nextPhase: "break", since: min(25), completed: 1 });
    const s = apply(fresh(2), startNext(fresh(2), min(40), manual));
    expect(timerAt(s, min(41), manual)).toMatchObject({ phase: "break", secondsRemaining: 4 * 60, completed: 1 });
  });
});

describe("actions", () => {
  it("pause stops the clock; resume continues where it stopped and logs the pause", () => {
    let s = fresh(2);
    s = apply(s, pause(s, min(10), cfg));
    expect(timerAt(s, min(40), cfg)).toMatchObject({ phase: "paused", pausedPhase: "focus", secondsRemaining: 900, focusSeconds: 600 });
    s = apply(s, resume(s, min(40), cfg));
    expect(s.pause_seconds).toBe(1800);
    expect(timerAt(s, min(45), cfg)).toMatchObject({ phase: "focus", secondsRemaining: 600, focusSeconds: 900 });
    // The pomodoro completes 25 focus minutes after it began, not counting the pause.
    expect(timerAt(s, min(55), cfg)).toMatchObject({ phase: "break", completed: 1, focusSeconds: 1500 });
  });

  it("pausing during a break and resuming works the same way", () => {
    let s = fresh(2);
    s = apply(s, pause(s, min(27), cfg));
    expect(timerAt(s, min(60), cfg)).toMatchObject({ phase: "paused", pausedPhase: "break", secondsRemaining: 180, completed: 1 });
    s = apply(s, resume(s, min(60), cfg));
    expect(timerAt(s, min(63) + 1, cfg)).toMatchObject({ phase: "focus", completed: 1 });
  });

  it("skip break starts the next focus now", () => {
    let s = fresh(3);
    s = apply(s, skipBreak(s, min(26), cfg));
    expect(timerAt(s, min(26), cfg)).toMatchObject({ phase: "focus", secondsRemaining: 1500, completed: 1 });
    expect(s.pomodoros).toHaveLength(1);
    expect(skipBreak(s, min(27), cfg)).toBeNull(); // not in a break
  });

  it("add a pomodoro lengthens the plan, or continues a finished session", () => {
    let s = fresh(1);
    s = apply(s, addPomodoro(s, min(10), cfg));
    expect(s.planned_pomodoros).toBe(2);
    expect(timerAt(s, min(27), cfg)).toMatchObject({ phase: "break", completed: 1 });

    let f = fresh(1);
    f = apply(f, addPomodoro(f, min(40), cfg));
    expect(timerAt(f, min(41), cfg)).toMatchObject({ phase: "focus", completed: 1, planned: 2, secondsRemaining: 24 * 60 });
  });

  it("ending mid-focus discards the partial pomodoro but keeps its minutes", () => {
    const s = fresh(3);
    const e = end(s, min(40), cfg);
    expect(e).toMatchObject({ completed_pomodoros: 1, focus_seconds: 1500 + 600, state: { phase: "ended" } }); // 10 min into the second focus
    expect(e.pomodoros.map((p) => p.completed)).toEqual([true, false]);
    expect(timerAt({ ...s, ...e }, min(90), cfg)).toMatchObject({ phase: "ended", completed: 1 });
  });

  it("ending while paused counts the pause", () => {
    let s = fresh(1);
    s = apply(s, pause(s, min(5), cfg));
    const e = end(s, min(15), cfg);
    expect(e).toMatchObject({ completed_pomodoros: 0, focus_seconds: 300, pause_seconds: 600 });
  });
});

describe("formatClock", () => {
  it("rounds up and pads", () => {
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(0.2)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-3)).toBe("00:00");
  });
});
