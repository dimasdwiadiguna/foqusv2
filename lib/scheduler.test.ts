import { describe, expect, it } from "vitest";
import type { ScheduleBlock } from "./availability";
import { pickSlot, type PickInput } from "./scheduler";

const TZ = "Asia/Jakarta";
const at = (date: string, time: string) => Date.parse(`${date}T${time}:00+07:00`);
const iso = (date: string, time: string) => new Date(at(date, time)).toISOString();
const block = (id: string, date: string, time: string, pomodoros: number, actionId = "other"): ScheduleBlock => ({
  id,
  action_id: actionId,
  starts_at: iso(date, time),
  ends_at: new Date(at(date, time) + pomodoros * 30 * 60_000).toISOString(),
  buffer_minutes: 10,
  status: "scheduled",
  planned_pomodoros: pomodoros,
  deleted_at: null,
});

// Tuesday 6 Oct 2026 at 06:00 in Jakarta; the week runs to Sunday 11 Oct.
const base: PickInput = {
  action: { id: "a", goal_id: "g", due_on: null },
  pomodoros: 2,
  bufferMinutes: 10,
  timeZone: TZ,
  now: iso("2026-10-06", "06:00"),
  today: "2026-10-06",
  windows: () => ({ availability: { start_time: "05:00", end_time: "21:00" }, peak: { start_time: "05:00", end_time: "09:00" } }),
  personal: [],
  events: [],
  blocks: [],
  dailyCap: 10,
};

describe("pickSlot (§5.11)", () => {
  it("puts goal work at the earliest peak slot, after now", () => {
    expect(pickSlot(base)).toMatchObject({ start: at("2026-10-06", "06:00"), date: "2026-10-06", offPeak: false, afterDue: false });
  });

  it("puts area tasks at the earliest non-peak slot", () => {
    expect(pickSlot({ ...base, action: { id: "a", goal_id: null, due_on: null } })).toMatchObject({ start: at("2026-10-06", "09:00"), offPeak: false });
  });

  it("falls back: goal work off-peak when the peak is full, marked off-peak", () => {
    const blocks = [block("x", "2026-10-06", "06:00", 4)]; // 06:00–08:00 + buffer
    const peakFull = { ...base, blocks, windows: () => ({ ...base.windows(2), peak: { start_time: "05:00", end_time: "08:30" } }) };
    // Tue peak is taken (08:10–08:30 is too short), so Wednesday's peak wins over Tuesday's off-peak.
    expect(pickSlot(peakFull)).toMatchObject({ date: "2026-10-07", start: at("2026-10-07", "05:00"), offPeak: false });
    // With only today available, it goes off-peak today.
    const onlyToday = { ...peakFull, today: "2026-10-11", now: iso("2026-10-11", "06:00"), blocks: [block("y", "2026-10-11", "06:00", 4)] };
    expect(pickSlot(onlyToday)).toMatchObject({ date: "2026-10-11", start: at("2026-10-11", "08:30"), offPeak: true });
  });

  it("area tasks use leftover peak time when nothing else is free", () => {
    const windows = () => ({ availability: { start_time: "05:00", end_time: "10:00" }, peak: { start_time: "05:00", end_time: "09:00" } });
    const r = pickSlot({ ...base, today: "2026-10-11", now: iso("2026-10-11", "05:00"), windows, action: { id: "a", goal_id: null, due_on: null } });
    expect(r).toMatchObject({ date: "2026-10-11", start: at("2026-10-11", "05:00") });
  });

  it("skips a day that would go over the daily cap", () => {
    const blocks = [block("x", "2026-10-06", "10:00", 4), block("y", "2026-10-06", "13:00", 4)];
    expect(pickSlot({ ...base, blocks, dailyCap: 9 })?.date).toBe("2026-10-07");
  });

  it("prefers a day without another block for the same action, unless nothing else works", () => {
    const blocks = [block("x", "2026-10-06", "15:00", 1, "a")];
    expect(pickSlot({ ...base, blocks })?.date).toBe("2026-10-07");
    // On Sunday (the last day of the week) there is no other day, so it shares the day.
    const sunday = { ...base, today: "2026-10-11", now: iso("2026-10-11", "06:00"), blocks: [block("x", "2026-10-11", "15:00", 1, "a")] };
    expect(pickSlot(sunday)?.date).toBe("2026-10-11");
  });

  it("keeps to days on or before the due date, then tries after it, marked after-due", () => {
    const due = { ...base, action: { id: "a", goal_id: "g", due_on: "2026-10-07" } };
    // Today and Wednesday are full.
    const full = ["2026-10-06", "2026-10-07"].flatMap((d, i) => [block(`f${i}a`, d, "05:00", 4), block(`f${i}b`, d, "07:10", 4), block(`f${i}c`, d, "09:20", 4), block(`f${i}d`, d, "11:30", 4), block(`f${i}e`, d, "13:40", 4), block(`f${i}f`, d, "15:50", 4), block(`f${i}g`, d, "18:00", 4)]);
    const r = pickSlot({ ...due, blocks: full, dailyCap: 40 });
    expect(r).toMatchObject({ date: "2026-10-08", afterDue: true });
    expect(pickSlot(due)).toMatchObject({ date: "2026-10-06", afterDue: false });
  });

  it("respects personal blocks and other blocks' buffers", () => {
    const personal = [{ label: "Run", weekdays: [2 as const], start_time: "06:00", end_time: "07:00", active: true, deleted_at: null }];
    const blocks = [block("x", "2026-10-06", "07:00", 1)]; // 07:00–07:30, buffer to 07:40
    expect(pickSlot({ ...base, personal, blocks })).toMatchObject({ start: at("2026-10-06", "07:40") });
  });

  it("ignores the block being rescheduled", () => {
    const blocks = [block("old", "2026-10-06", "06:00", 2, "a")];
    expect(pickSlot({ ...base, blocks, excludeBlockId: "old" })).toMatchObject({ start: at("2026-10-06", "06:00") });
  });

  it("returns null when nothing fits this week", () => {
    expect(pickSlot({ ...base, dailyCap: 1 })).toBeNull();
  });

  it("is deterministic", () => {
    expect(pickSlot(base)).toEqual(pickSlot(base));
  });
});
