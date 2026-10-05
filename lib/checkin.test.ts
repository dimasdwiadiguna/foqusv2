import { describe, expect, it } from "vitest";
import { checkinPrompt, closingLine, dayNumbers, isCheckinEditable, isDayWon } from "./checkin";
import type { BlockStatus } from "@/types";

const TZ = "Asia/Jakarta";
const b = (ends_at: string, status: BlockStatus = "scheduled", over: Partial<{ planned_pomodoros: number; completed_pomodoros: number; resolution: "rescheduled" | "dropped" | null }> = {}) => ({
  status,
  ends_at,
  resolution: null,
  planned_pomodoros: 2,
  completed_pomodoros: status === "done" ? 2 : 0,
  deleted_at: null,
  ...over,
});
const local = (time: string) => `2026-10-05T${time}:00+07:00`;

describe("checkinPrompt", () => {
  it("is quiet until the last block ends, then prominent", () => {
    const blocks = [b("2026-10-05T03:00:00Z", "done"), b("2026-10-05T09:00:00Z")]; // last ends 16:00 local
    expect(checkinPrompt({ blocks, checkin: null, now: local("15:59"), timeZone: TZ })).toBe("quiet");
    expect(checkinPrompt({ blocks, checkin: null, now: local("16:00"), timeZone: TZ })).toBe("prominent");
  });

  it("on a day with no blocks, is prominent from 18:00 local", () => {
    expect(checkinPrompt({ blocks: [], checkin: null, now: local("17:59"), timeZone: TZ })).toBe("quiet");
    expect(checkinPrompt({ blocks: [], checkin: null, now: local("18:00"), timeZone: TZ })).toBe("prominent");
    // Drafts and deleted blocks do not count as blocks.
    const drafts = [b("2026-10-05T14:00:00Z", "draft"), { ...b("2026-10-05T14:00:00Z"), deleted_at: "x" }];
    expect(checkinPrompt({ blocks: drafts, checkin: null, now: local("18:30"), timeZone: TZ })).toBe("prominent");
  });

  it("is done once completed", () => {
    expect(checkinPrompt({ blocks: [], checkin: { completed_at: "2026-10-05T12:00:00Z" }, now: local("20:00"), timeZone: TZ })).toBe("done");
    expect(checkinPrompt({ blocks: [], checkin: { completed_at: null }, now: local("20:00"), timeZone: TZ })).toBe("prominent");
  });
});

describe("isCheckinEditable", () => {
  it("allows today and yesterday only", () => {
    expect(isCheckinEditable("2026-10-05", "2026-10-05")).toBe(true);
    expect(isCheckinEditable("2026-10-04", "2026-10-05")).toBe(true);
    expect(isCheckinEditable("2026-10-03", "2026-10-05")).toBe(false);
    expect(isCheckinEditable("2026-10-06", "2026-10-05")).toBe(false);
  });
});

describe("dayNumbers and isDayWon", () => {
  it("counts the plan without drafts or rescheduled misses", () => {
    const blocks = [
      b("x", "done"),
      b("x", "missed", { resolution: "rescheduled" }),
      b("x", "missed", { resolution: "dropped", completed_pomodoros: 0 }),
      b("x", "draft"),
      b("x", "done", { planned_pomodoros: 3, completed_pomodoros: 1 }),
    ];
    expect(dayNumbers(blocks)).toEqual({ done: 3, planned: 7 });
    expect(isDayWon(blocks)).toBe(false);
  });

  it("is won when every planned block is done", () => {
    expect(isDayWon([b("x", "done"), b("x", "missed", { resolution: "rescheduled" }), b("x", "draft")])).toBe(true);
    expect(isDayWon([b("x", "done"), b("x", "active")])).toBe(false);
    expect(isDayWon([])).toBe(false);
  });
});

describe("closingLine", () => {
  it("picks one line by rule", () => {
    expect(closingLine({ done: 4, planned: 4, energy: 1, focus: 5 })).toMatch(/Low energy/);
    expect(closingLine({ done: 0, planned: 0, energy: 4, focus: 4 })).toMatch(/No blocks today/);
    expect(closingLine({ done: 4, planned: 4, energy: 4, focus: 2 })).toMatch(/Focus was hard/);
    expect(closingLine({ done: 4, planned: 4, energy: null, focus: null })).toMatch(/Every planned/);
    expect(closingLine({ done: 3, planned: 4, energy: 3, focus: 3 })).toMatch(/Most of the plan/);
    expect(closingLine({ done: 1, planned: 4, energy: 3, focus: 3 })).toMatch(/Less got done/);
  });
});
