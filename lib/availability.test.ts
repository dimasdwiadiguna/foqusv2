import { describe, expect, it } from "vitest";
import { freeIntervals, freeMinutes, personalSpans, type FreeInput, type ScheduleBlock } from "./availability";
import { normalize, subtract } from "./intervals";

const TZ = "Asia/Jakarta";
const at = (date: string, time: string) => Date.parse(`${date}T${time}:00+07:00`);
const iso = (date: string, time: string) => new Date(at(date, time)).toISOString();
const span = (date: string, a: string, b: string) => ({ start: at(date, a), end: at(date, b) });

const block = (id: string, start: string, end: string, extra: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
  id,
  action_id: "a",
  starts_at: iso("2026-10-06", start),
  ends_at: iso("2026-10-06", end),
  buffer_minutes: 10,
  status: "scheduled",
  planned_pomodoros: 2,
  deleted_at: null,
  ...extra,
});

// Tuesday 6 Oct 2026, seen from the evening before so "now" does not cut anything.
const base: FreeInput = {
  date: "2026-10-06",
  timeZone: TZ,
  availability: { start_time: "05:00", end_time: "21:00" },
  personal: [],
  events: [],
  blocks: [],
  now: iso("2026-10-05", "20:00"),
};

describe("intervals", () => {
  it("merges and subtracts", () => {
    expect(normalize([{ start: 5, end: 8 }, { start: 1, end: 3 }, { start: 3, end: 4 }])).toEqual([{ start: 1, end: 4 }, { start: 5, end: 8 }]);
    expect(subtract([{ start: 0, end: 10 }], [{ start: 2, end: 3 }, { start: 8, end: 12 }])).toEqual([{ start: 0, end: 2 }, { start: 3, end: 8 }]);
  });
});

describe("freeIntervals (§5.6)", () => {
  it("is the availability window on an empty day", () => {
    expect(freeIntervals(base)).toEqual([span("2026-10-06", "05:00", "21:00")]);
    expect(freeMinutes(base)).toBe(16 * 60);
  });

  it("removes a personal block on its weekdays only", () => {
    const lunch = { label: "Lunch", weekdays: [2 as const], start_time: "12:00", end_time: "13:00", active: true, deleted_at: null };
    expect(freeIntervals({ ...base, personal: [lunch] })).toEqual([span("2026-10-06", "05:00", "12:00"), span("2026-10-06", "13:00", "21:00")]);
    expect(freeIntervals({ ...base, date: "2026-10-07", personal: [lunch] })).toEqual([span("2026-10-07", "05:00", "21:00")]);
    expect(freeIntervals({ ...base, personal: [{ ...lunch, active: false }] })).toHaveLength(1);
    expect(personalSpans("2026-10-06", [lunch], TZ)[0].label).toBe("Lunch");
  });

  it("removes a committed block and its buffer", () => {
    const free = freeIntervals({ ...base, blocks: [block("b", "06:00", "07:00")] });
    expect(free).toEqual([span("2026-10-06", "05:00", "06:00"), span("2026-10-06", "07:10", "21:00")]);
  });

  it("ignores missed, deleted, and draft blocks, and the block being moved", () => {
    const blocks = [
      block("m", "06:00", "07:00", { status: "missed" }),
      block("d", "08:00", "09:00", { deleted_at: iso("2026-10-05", "10:00") }),
      block("x", "10:00", "11:00", { status: "draft" }),
      block("self", "12:00", "13:00"),
    ];
    expect(freeIntervals({ ...base, blocks, excludeBlockId: "self" })).toEqual([span("2026-10-06", "05:00", "21:00")]);
  });

  it("drops everything before now on today, rounded up to 5 minutes", () => {
    const free = freeIntervals({ ...base, now: iso("2026-10-06", "09:12") });
    expect(free).toEqual([span("2026-10-06", "09:15", "21:00")]);
    expect(freeIntervals({ ...base, now: iso("2026-10-07", "09:00") })).toEqual([]);
  });

  it("removes timed blocking events but not all-day ones", () => {
    const events = [
      { title: "Team sync", starts_at: iso("2026-10-06", "07:00"), ends_at: iso("2026-10-06", "08:00"), all_day: false },
      { title: "Holiday", starts_at: iso("2026-10-06", "00:00"), ends_at: iso("2026-10-07", "00:00"), all_day: true },
    ];
    expect(freeIntervals({ ...base, events })).toEqual([span("2026-10-06", "05:00", "07:00"), span("2026-10-06", "08:00", "21:00")]);
  });

  it("has no free time when the window is empty", () => {
    expect(freeIntervals({ ...base, availability: { start_time: "09:00", end_time: "09:00" } })).toEqual([]);
  });
});

describe("firstFreeStart", () => {
  it("finds the first gap long enough, buffer included", async () => {
    const { firstFreeStart, TIME_OPTIONS } = await import("./availability");
    const free = [span("2026-10-06", "05:00", "05:40"), span("2026-10-06", "07:00", "09:00")];
    expect(firstFreeStart(free, 30)).toBe(at("2026-10-06", "05:00"));
    expect(firstFreeStart(free, 30, 10)).toBe(at("2026-10-06", "05:00"));
    expect(firstFreeStart(free, 30, 15)).toBe(at("2026-10-06", "07:00"));
    expect(firstFreeStart(free, 180)).toBeNull();
    expect(TIME_OPTIONS).toHaveLength(288);
    expect(TIME_OPTIONS[TIME_OPTIONS.length - 1]).toBe("23:55");
  });
});
