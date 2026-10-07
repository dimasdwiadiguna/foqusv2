import { describe, expect, it } from "vitest";
import { defaultSplit, planSessions, sessionProgress, type SessionInput } from "./sessions";
import { addDays, weekDates } from "./time";

const TZ = "Asia/Jakarta";
const iso = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`).toISOString();
const local = (ms: number) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
// Tuesday 6 Oct 2026, 06:00 Jakarta; this week and next.
const base: SessionInput = {
  action: { id: "w", goal_id: "g", due_on: null },
  count: 3,
  size: 2,
  days: [...weekDates("2026-10-05"), ...weekDates("2026-10-12")],
  today: "2026-10-06",
  now: iso("2026-10-06", "06:00"),
  timeZone: TZ,
  windows: () => ({ availability: { start_time: "05:00", end_time: "21:00" }, peak: { start_time: "05:00", end_time: "09:00" } }),
  personal: [],
  events: [],
  blocks: [],
  dailyCap: 10,
  bufferMinutes: 10,
};

describe("planSessions", () => {
  it("places 3 × 2 on three different days, in the peak for goal work", () => {
    const { blocks, missing } = planSessions(base);
    expect(missing).toBe(0);
    expect(blocks.map((b) => [local(b.start), b.pomodoros])).toEqual([
      ["2026-10-06 06:00", 2],
      ["2026-10-07 05:00", 2],
      ["2026-10-08 05:00", 2],
    ]);
  });

  it("reports sessions that do not fit and never shortens them", () => {
    const days = ["2026-10-06"];
    const r = planSessions({ ...base, days, dailyCap: 4 });
    expect(r.blocks.map((b) => b.pomodoros)).toEqual([2, 2]);
    expect(r.missing).toBe(1);
  });

  it("is deterministic", () => {
    expect(planSessions(base)).toEqual(planSessions(base));
    expect(planSessions({ ...base, days: [...base.days].slice(0, 14) })).toEqual(planSessions(base));
  });

  it("can use next week when this week is full", () => {
    const r = planSessions({ ...base, today: "2026-10-11", now: iso("2026-10-11", "06:00") });
    expect(r.blocks.map((b) => b.date)).toEqual(["2026-10-11", "2026-10-12", addDays("2026-10-12", 1)]);
  });
});

describe("defaultSplit and sessionProgress", () => {
  it("splits by the session size, or by the max per block", () => {
    expect(defaultSplit(6, 2, 4)).toEqual({ count: 3, size: 2 });
    expect(defaultSplit(7, null, 4)).toEqual({ count: 2, size: 4 });
    expect(defaultSplit(1, null, 4)).toEqual({ count: 1, size: 4 });
  });
  it("counts scheduled sessions", () => {
    const blocks = [
      { action_id: "w", status: "done" as const, deleted_at: null },
      { action_id: "w", status: "scheduled" as const, deleted_at: null },
      { action_id: "w", status: "draft" as const, deleted_at: null },
      { action_id: "w", status: "missed" as const, deleted_at: null },
    ];
    expect(sessionProgress({ id: "w", estimate_pomodoros: 6, session_pomodoros: 2 }, blocks)).toEqual({ total: 3, scheduled: 2 });
    expect(sessionProgress({ id: "w", estimate_pomodoros: 6, session_pomodoros: null }, blocks)).toBeNull();
  });
});
