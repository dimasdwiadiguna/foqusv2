import { describe, expect, it } from "vitest";
import type { ScheduleBlock } from "./availability";
import { personalSpans } from "./availability";
import { DIDNT_FIT, draftWeek, rankItems, type DraftInput, type DraftItem } from "./draft";
import { toLocalDate, weekDates } from "./time";

const TZ = "Asia/Jakarta";
const at = (date: string, time: string) => Date.parse(`${date}T${time}:00+07:00`);
const iso = (date: string, time: string) => new Date(at(date, time)).toISOString();

const goal = (id: string, unscheduled: number, rank = 1, over: Partial<DraftItem["action"]> = {}): DraftItem => ({
  action: { id, goal_id: `g${rank}`, due_on: null, sort_order: 0, occurrence_date: null, ...over },
  unscheduled,
  goalRank: rank,
  planEndsOn: "2026-12-31",
  preferredStart: null,
});
const area = (id: string, unscheduled: number, over: Partial<DraftItem["action"]> = {}): DraftItem => ({
  action: { id, goal_id: null, due_on: null, sort_order: 0, occurrence_date: null, ...over },
  unscheduled,
  goalRank: null,
  planEndsOn: null,
  preferredStart: null,
});

// Tuesday 6 Oct 2026 06:00 in Jakarta; the week runs to Sunday 11 Oct.
const base: DraftInput = {
  items: [],
  days: weekDates("2026-10-05"),
  today: "2026-10-06",
  now: iso("2026-10-06", "06:00"),
  timeZone: TZ,
  windows: () => ({ availability: { start_time: "05:00", end_time: "21:00" }, peak: { start_time: "05:00", end_time: "09:00" } }),
  personal: [],
  events: [],
  blocks: [],
  dailyCap: 10,
  maxPerBlock: 4,
  bufferMinutes: 10,
};
const local = (ms: number) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ");

describe("rankItems (§5.11)", () => {
  it("puts recurring by date first, then goal work by rank, due date, plan end, order; then area tasks by due date", () => {
    const items = [
      area("area-late", 1, { due_on: "2026-10-09" }),
      area("area-none", 1),
      goal("g2", 1, 2),
      goal("g1-nodue", 1, 1),
      goal("g1-due", 1, 1, { due_on: "2026-10-08" }),
      { ...area("rec-thu", 1, { occurrence_date: "2026-10-08" }) },
      { ...goal("rec-wed", 1, 3, { occurrence_date: "2026-10-07" }) },
      area("area-soon", 1, { due_on: "2026-10-07" }),
    ];
    expect(rankItems(items).map((i) => i.action.id)).toEqual(["rec-wed", "rec-thu", "g1-due", "g1-nodue", "g2", "area-soon", "area-late", "area-none"]);
  });
});

describe("draftWeek (§5.11)", () => {
  it("places goals in rank order, peak first", () => {
    const { blocks } = draftWeek({ ...base, items: [goal("second", 4, 2), goal("first", 4, 1)] });
    // The first goal takes Tuesday's peak; the second cannot fit 2 h before 09:00 there, so it takes Wednesday's.
    expect(blocks.map((b) => [b.action_id, local(b.start), b.offPeak])).toEqual([
      ["first", "2026-10-06 06:00", false],
      ["second", "2026-10-07 05:00", false],
    ]);
  });

  it("puts area tasks outside the peak first", () => {
    const { blocks } = draftWeek({ ...base, items: [area("task", 2), goal("goal", 2)] });
    expect(blocks.map((b) => [b.action_id, local(b.start)])).toEqual([
      ["goal", "2026-10-06 06:00"],
      ["task", "2026-10-06 09:00"],
    ]);
  });

  it("never exceeds the daily cap", () => {
    const { blocks } = draftWeek({ ...base, dailyCap: 4, items: [area("a", 4), area("b", 4), area("c", 4)] });
    expect(blocks.map((b) => b.date)).toEqual(["2026-10-06", "2026-10-07", "2026-10-08"]);
  });

  it("splits an 8-pomodoro action into two blocks on different days", () => {
    const { blocks, didntFit } = draftWeek({ ...base, items: [area("big", 8)] });
    expect(blocks.map((b) => [b.date, b.pomodoros])).toEqual([
      ["2026-10-06", 4],
      ["2026-10-07", 4],
    ]);
    expect(didntFit).toEqual([]);
  });

  it("chunks an action split into sessions by its session size", () => {
    const { blocks } = draftWeek({ ...base, items: [{ ...area("write", 6), chunk: 2 }] });
    expect(blocks.map((b) => [b.date, b.pomodoros])).toEqual([
      ["2026-10-06", 2],
      ["2026-10-07", 2],
      ["2026-10-08", 2],
    ]);
  });

  it("places a smaller chunk when a full one does not fit, and re-queues the rest", () => {
    // Only Sunday is left and it has 1 h 20 min of availability: 2 pomodoros + buffer fit, 4 do not.
    const windows = () => ({ availability: { start_time: "05:00", end_time: "06:20" }, peak: { start_time: "05:00", end_time: "06:20" } });
    const r = draftWeek({ ...base, today: "2026-10-11", now: iso("2026-10-11", "05:00"), windows, items: [goal("g", 4)] });
    expect(r.blocks.map((b) => b.pomodoros)).toEqual([2]);
    expect(r.didntFit).toEqual([{ action_id: "g", pomodoros: 2, reason: DIDNT_FIT.none }]);
  });

  it("marks work after a due date that cannot be met, or lists it with a reason", () => {
    // Tuesday is fully booked; the action was due Tuesday.
    const busy: ScheduleBlock[] = [
      { id: "x", action_id: "other", starts_at: iso("2026-10-06", "06:00"), ends_at: iso("2026-10-06", "21:00"), buffer_minutes: 0, status: "scheduled", planned_pomodoros: 2, deleted_at: null },
    ];
    const late = draftWeek({ ...base, blocks: busy, items: [area("due-tue", 2, { due_on: "2026-10-06" })] });
    expect(late.blocks[0]).toMatchObject({ date: "2026-10-07", afterDue: true });

    // With no time left anywhere in the week, it is listed with a reason.
    const full = draftWeek({ ...base, today: "2026-10-11", now: iso("2026-10-11", "06:00"), blocks: [{ ...busy[0], starts_at: iso("2026-10-11", "06:00"), ends_at: iso("2026-10-11", "21:00") }], items: [area("due-sat", 2, { due_on: "2026-10-10" })] });
    expect(full.didntFit).toEqual([{ action_id: "due-sat", pomodoros: 2, reason: DIDNT_FIT.due }]);

    const capped = draftWeek({ ...base, dailyCap: 2, blocks: weekDates("2026-10-05").map((d, i) => ({ ...busy[0], id: `c${i}`, starts_at: iso(d, "20:00"), ends_at: iso(d, "21:00") })), items: [area("t", 1)] });
    expect(capped.didntFit).toEqual([{ action_id: "t", pomodoros: 1, reason: DIDNT_FIT.cap }]);
  });

  it("puts a recurring occurrence on its own day, at its preferred time when free", () => {
    const occ = { ...area("run:2026-10-08", 1, { occurrence_date: "2026-10-08" }), preferredStart: "17:00" };
    expect(draftWeek({ ...base, items: [occ] }).blocks.map((b) => local(b.start))).toEqual(["2026-10-08 17:00"]);
    // Preferred time taken: the area rule on the same day (non-peak first).
    const blocks: ScheduleBlock[] = [
      { id: "x", action_id: "o", starts_at: iso("2026-10-08", "17:00"), ends_at: iso("2026-10-08", "18:00"), buffer_minutes: 0, status: "scheduled", planned_pomodoros: 2, deleted_at: null },
    ];
    expect(draftWeek({ ...base, blocks, items: [occ] }).blocks.map((b) => local(b.start))).toEqual(["2026-10-08 09:00"]);
    // Its day is full: it does not move to another day.
    const full = draftWeek({ ...base, windows: (w) => (w === 4 ? { availability: undefined, peak: undefined } : base.windows(w)), items: [occ] });
    expect(full.blocks).toEqual([]);
    expect(full.didntFit[0]).toMatchObject({ reason: DIDNT_FIT.none });
  });

  it("is deterministic, whatever order the items arrive in", () => {
    const items = [goal("a", 3, 1), goal("b", 5, 2), area("c", 2, { due_on: "2026-10-08" }), area("d", 6), goal("e", 2, 1, { due_on: "2026-10-07" })];
    const one = draftWeek({ ...base, items });
    expect(draftWeek({ ...base, items: [...items].reverse() })).toEqual(one);
    expect(draftWeek({ ...base, items })).toEqual(one);
  });

  it("never overlaps anything, stays in availability, respects the cap; 30 actions in well under a second", () => {
    const personal = [{ label: "Lunch", weekdays: [1, 2, 3, 4, 5, 6, 7] as (1 | 2 | 3 | 4 | 5 | 6 | 7)[], start_time: "12:00", end_time: "13:00", active: true, deleted_at: null }];
    const committed: ScheduleBlock[] = [
      { id: "x", action_id: "o", starts_at: iso("2026-10-07", "10:00"), ends_at: iso("2026-10-07", "11:00"), buffer_minutes: 15, status: "scheduled", planned_pomodoros: 2, deleted_at: null },
    ];
    const events = [{ title: "Meeting", starts_at: iso("2026-10-08", "14:00"), ends_at: iso("2026-10-08", "15:30"), all_day: false }];
    const items = Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? area(`t${i}`, 1 + (i % 5)) : goal(`g${i}`, 1 + (i % 7), 1 + (i % 4))));
    const input = { ...base, personal, events, blocks: committed, dailyCap: 12, items };
    const t0 = performance.now();
    const { blocks } = draftWeek(input);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(blocks.length).toBeGreaterThan(10);

    const busy = [
      ...committed.map((b) => ({ start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) + b.buffer_minutes * 60_000 })),
      ...events.map((e) => ({ start: Date.parse(e.starts_at), end: Date.parse(e.ends_at) })),
    ];
    const spans = blocks.map((b) => ({ start: b.start, end: b.end + b.bufferMinutes * 60_000, b }));
    for (const s of spans) {
      const d = toLocalDate(s.start, TZ);
      expect(s.start).toBeGreaterThanOrEqual(Math.max(at(d, "05:00"), Date.parse(base.now)));
      expect(s.b.end).toBeLessThanOrEqual(at(d, "21:00"));
      for (const p of [...busy, ...personalSpans(d, personal, TZ)]) expect(s.start < p.end && p.start < s.end).toBe(false);
      for (const o of spans) if (o !== s) expect(s.start < o.end && o.start < s.end).toBe(false);
    }
    const load = new Map<string, number>();
    for (const b of blocks) load.set(b.date, (load.get(b.date) ?? 0) + b.pomodoros);
    load.set("2026-10-07", (load.get("2026-10-07") ?? 0) + 2);
    for (const n of load.values()) expect(n).toBeLessThanOrEqual(12);
  });
});
