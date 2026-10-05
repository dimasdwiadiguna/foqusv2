import { describe, expect, it } from "vitest";
import type { ScheduleBlock } from "./availability";
import { checkPlacement, snapToFree, type PlacementInput } from "./placement";

const TZ = "Asia/Jakarta";
const at = (time: string, date = "2026-10-06") => Date.parse(`${date}T${time}:00+07:00`);
const iso = (time: string, date = "2026-10-06") => new Date(at(time, date)).toISOString();

const block = (id: string, start: string, pomodoros: number, extra: Partial<ScheduleBlock & { title: string }> = {}) => ({
  id,
  action_id: `action-${id}`,
  starts_at: iso(start),
  ends_at: new Date(at(start) + pomodoros * 30 * 60_000).toISOString(),
  buffer_minutes: 10,
  status: "scheduled" as const,
  planned_pomodoros: pomodoros,
  deleted_at: null,
  title: `Block ${id}`,
  ...extra,
});

const base: PlacementInput = {
  start: at("10:00"),
  pomodoros: 2,
  bufferMinutes: 10,
  action: { goal_id: null, due_on: null },
  timeZone: TZ,
  today: "2026-10-06",
  availability: { start_time: "05:00", end_time: "21:00" },
  peak: { start_time: "05:00", end_time: "09:00" },
  personal: [],
  events: [],
  blocks: [],
  dailyCap: 10,
};

const ok = (r: ReturnType<typeof checkPlacement>) => {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r;
};

describe("checkPlacement (§5.8)", () => {
  it("accepts a clean placement with no warnings", () => {
    const r = ok(checkPlacement(base));
    expect(r.warnings).toEqual([]);
    expect(r.end - r.start).toBe(60 * 60_000);
  });

  it("rejects an overlap with another FOQUS block (hard rule, not a warning)", () => {
    const r = checkPlacement({ ...base, blocks: [block("x", "10:30", 1)] });
    expect(r).toMatchObject({ ok: false, reason: "overlap", blockId: "x" });
    // Touching end to start is not an overlap.
    expect(checkPlacement({ ...base, blocks: [block("y", "11:00", 1, { buffer_minutes: 0 })], bufferMinutes: 0 }).ok).toBe(true);
    // A done block still holds its time; a missed one does not; the moved block ignores itself.
    expect(checkPlacement({ ...base, blocks: [block("d", "10:30", 1, { status: "done" })] }).ok).toBe(false);
    expect(checkPlacement({ ...base, blocks: [block("m", "10:30", 1, { status: "missed" })] }).ok).toBe(true);
    expect(checkPlacement({ ...base, blockId: "s", blocks: [block("s", "10:30", 1)] }).ok).toBe(true);
  });

  it("warns on overlapping another block's buffer, in both directions", () => {
    // Block 09:00–09:30 with a 10-minute buffer to 09:40; proposal starts 09:35.
    const into = ok(checkPlacement({ ...base, start: at("09:35"), blocks: [block("x", "09:00", 1)] }));
    expect(into.warnings).toEqual([{ kind: "buffer", message: "This runs into the buffer after “Block x”." }]);
    // Proposal 10:00–11:00 with its buffer to 11:10; next block starts 11:05.
    const out = ok(checkPlacement({ ...base, blocks: [block("y", "11:05", 1)] }));
    expect(out.warnings.map((w) => w.kind)).toEqual(["buffer"]);
    expect(out.warnings[0].message).toBe("Its buffer runs into “Block y”.");
  });

  it("warns on a blocking external event, naming it and its calendar", () => {
    const events = [{ title: "Team sync", calendar: "Work", starts_at: iso("10:30"), ends_at: iso("11:30"), all_day: false }];
    expect(ok(checkPlacement({ ...base, events })).warnings).toEqual([{ kind: "event", message: "This overlaps Team sync (Work calendar)." }]);
  });

  it("warns on a personal block", () => {
    const personal = [{ label: "Lunch", weekdays: [2 as const], start_time: "10:30", end_time: "11:00", active: true, deleted_at: null }];
    expect(ok(checkPlacement({ ...base, personal })).warnings).toEqual([{ kind: "personal", message: "This overlaps Lunch, a personal block." }]);
  });

  it("warns outside the availability window", () => {
    const r = ok(checkPlacement({ ...base, start: at("20:30") }));
    expect(r.warnings).toEqual([{ kind: "availability", message: "This is outside your available hours (05:00–21:00)." }]);
  });

  it("warns when the day goes past the daily cap", () => {
    const blocks = [block("a", "05:00", 4), block("b", "07:00", 4), block("c", "13:00", 2, { status: "missed" })];
    const r = ok(checkPlacement({ ...base, pomodoros: 4, start: at("14:00"), blocks }));
    expect(r.warnings).toEqual([{ kind: "cap", message: "12 pomodoros planned today. Your cap is 10." }]);
    const other = ok(checkPlacement({ ...base, today: "2026-10-05", pomodoros: 4, start: at("14:00"), blocks }));
    expect(other.warnings[0].message).toBe("12 pomodoros planned on Tue 6 Oct. Your cap is 10.");
  });

  it("warns when the action is due before the block, and flags it after-due", () => {
    const r = ok(checkPlacement({ ...base, action: { goal_id: null, due_on: "2026-10-05" } }));
    expect(r.warnings).toEqual([{ kind: "due", message: "This action is due Mon 5 Oct, before this block." }]);
    expect(r.afterDue).toBe(true);
    expect(ok(checkPlacement({ ...base, action: { goal_id: null, due_on: "2026-10-06" } })).afterDue).toBe(false);
  });

  it("marks goal work outside the peak window off-peak without a warning", () => {
    const r = ok(checkPlacement({ ...base, action: { goal_id: "g", due_on: null } }));
    expect(r).toMatchObject({ offPeak: true, warnings: [] });
    expect(ok(checkPlacement({ ...base, start: at("06:00"), action: { goal_id: "g", due_on: null } })).offPeak).toBe(false);
    // Straddling the end of the peak window is off-peak.
    expect(ok(checkPlacement({ ...base, start: at("08:30"), action: { goal_id: "g", due_on: null } })).offPeak).toBe(true);
    // Area tasks are never off-peak.
    expect(ok(checkPlacement(base)).offPeak).toBe(false);
  });

  it("rejects a block that would run past midnight", () => {
    expect(checkPlacement({ ...base, start: at("23:30"), pomodoros: 2 })).toMatchObject({ ok: false, reason: "midnight" });
  });

  it("collects several warnings at once", () => {
    const personal = [{ label: "Gym", weekdays: [2 as const], start_time: "20:00", end_time: "21:30", active: true, deleted_at: null }];
    const kinds = ok(checkPlacement({ ...base, start: at("20:30"), personal })).warnings.map((w) => w.kind);
    expect(kinds).toEqual(["personal", "availability"]);
  });
});

describe("snapToFree", () => {
  it("moves to the nearest free 5-minute position", () => {
    // Existing 10:00–11:00; a 1-pomodoro block dropped at 10:40 fits better at 11:00 than at 09:30.
    const blocks = [block("x", "10:00", 2)];
    expect(snapToFree({ ...base, pomodoros: 1, start: at("10:40"), blocks })).toBe(at("11:00"));
    expect(snapToFree({ ...base, pomodoros: 1, start: at("10:10"), blocks })).toBe(at("09:30"));
  });

  it("prefers the later position on a tie", () => {
    const blocks = [block("x", "10:00", 1)];
    expect(snapToFree({ ...base, pomodoros: 1, start: at("10:00"), blocks })).toBe(at("10:30"));
  });

  it("returns null when nothing in the day fits", () => {
    const blocks = Array.from({ length: 12 }, (_, i) => block(`b${i}`, `${String(i * 2).padStart(2, "0")}:00`, 4));
    expect(snapToFree({ ...base, start: at("10:00"), pomodoros: 1, blocks })).toBeNull();
  });

  it("keeps a free start where it is", () => {
    expect(snapToFree(base)).toBe(base.start);
  });
});
