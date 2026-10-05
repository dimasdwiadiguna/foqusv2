import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { getBlocksForDays, getDaySchedule, getPersonalBlocks } from "@/data/queries";
import {
  addAction,
  copyWindowToAllDays,
  createGoal,
  createPersonalBlock,
  deleteBlock,
  deletePersonalBlock,
  markBlockDone,
  placeBlock,
  rolloverWeek,
  updateBlockPlacement,
  updateWindow,
} from "@/repo";
import { freshDb } from "@/test/db";

const at = (time: string, date = "2026-10-06") => Date.parse(`${date}T${time}:00+07:00`);

beforeEach(() => freshDb("2026-10-05T00:00:00.000Z")); // Mon 5 Oct, 07:00 in Jakarta
afterEach(() => vi.useRealTimers());

describe("blocks", () => {
  it("places a committed block with ends_at kept in step", async () => {
    const a = await addAction({ title: "Grade quizzes" });
    const b = await placeBlock(a.id, { start: at("10:00"), pomodoros: 2, bufferMinutes: 10 });
    expect(b).toMatchObject({
      status: "scheduled",
      origin: "manual",
      starts_at: "2026-10-06T03:00:00.000Z",
      ends_at: "2026-10-06T04:00:00.000Z",
      planned_pomodoros: 2,
      buffer_minutes: 10,
      completed_pomodoros: 0,
      off_peak: false,
      after_due: false,
      _dirty: 1,
    });
    expect(b.id).toMatch(/^[0-9a-f-]{36}$/);

    const moved = await updateBlockPlacement(b.id, { start: at("12:00"), pomodoros: 3, bufferMinutes: 5 });
    expect(moved).toMatchObject({ starts_at: "2026-10-06T05:00:00.000Z", ends_at: "2026-10-06T06:30:00.000Z", buffer_minutes: 5 });
  });

  it("refuses an overlap with another block, even if the UI was bypassed", async () => {
    const a = await addAction({ title: "A" });
    await placeBlock(a.id, { start: at("10:00"), pomodoros: 2, bufferMinutes: 10 });
    await expect(placeBlock(a.id, { start: at("10:30"), pomodoros: 1, bufferMinutes: 10 })).rejects.toThrow(/overlaps “A”/);
    const b = await placeBlock(a.id, { start: at("11:00"), pomodoros: 1, bufferMinutes: 10 });
    await expect(updateBlockPlacement(b.id, { start: at("10:45"), pomodoros: 1, bufferMinutes: 10 })).rejects.toThrow(/overlaps/);
  });

  it("stores the off-peak and after-due flags", async () => {
    const { goal } = await createGoal("2026-Q4", {
      title: "G",
      area_id: null,
      outcome: "O",
      metric_label: null,
      metric_target: null,
      metric_current: null,
      starts_on: "2026-10-05",
      ends_on: "2026-12-31",
    });
    const a = await addAction({ title: "Goal work", goal_id: goal.id, due_on: "2026-10-05" });
    const off = await placeBlock(a.id, { start: at("10:00"), pomodoros: 1, bufferMinutes: 10 });
    expect(off).toMatchObject({ off_peak: true, after_due: true });
    const peak = await updateBlockPlacement(off.id, { start: at("05:30", "2026-10-05"), pomodoros: 1, bufferMinutes: 10 });
    expect(peak).toMatchObject({ off_peak: false, after_due: false });
  });

  it("validates pomodoros against the per-block maximum", async () => {
    const a = await addAction({ title: "A" });
    await expect(placeBlock(a.id, { start: at("10:00"), pomodoros: 5, bufferMinutes: 10 })).rejects.toThrow(/1 to 4/);
  });

  it("marks done with the planned pomodoros and soft-deletes", async () => {
    const a = await addAction({ title: "A" });
    const b = await placeBlock(a.id, { start: at("10:00"), pomodoros: 2, bufferMinutes: 10 });
    expect(await markBlockDone(b.id)).toMatchObject({ status: "done", completed_pomodoros: 2 });
    await deleteBlock(b.id);
    expect(await getBlocksForDays("2026-10-06", "2026-10-06", "Asia/Jakarta")).toEqual([]);
    expect((await getDb().t("blocks").get(b.id))?.deleted_at).not.toBeNull();
  });

  it("lists blocks by local day in the zone", async () => {
    const a = await addAction({ title: "A" });
    await placeBlock(a.id, { start: at("00:30", "2026-10-07"), pomodoros: 1, bufferMinutes: 0 }); // 6 Oct 17:30 UTC
    expect(await getBlocksForDays("2026-10-06", "2026-10-06", "Asia/Jakarta")).toHaveLength(0);
    expect(await getBlocksForDays("2026-10-07", "2026-10-07", "Asia/Jakarta")).toHaveLength(1);
  });
});

describe("schedule settings", () => {
  it("updates one weekday or copies to all", async () => {
    await updateWindow("availability", 3, "06:00", "20:00");
    expect((await getDaySchedule(3)).availability).toMatchObject({ start_time: "06:00", end_time: "20:00", _dirty: 1 });
    expect((await getDaySchedule(4)).availability).toMatchObject({ start_time: "05:00" });
    await copyWindowToAllDays("peak", "06:00", "10:00");
    for (const d of [1, 2, 3, 4, 5, 6, 7] as const) expect((await getDaySchedule(d)).peak).toMatchObject({ start_time: "06:00", end_time: "10:00" });
    await expect(updateWindow("peak", 1, "10:00", "09:00")).rejects.toThrow(/after it starts/);
  });

  it("creates, edits, and deletes personal blocks", async () => {
    const p = await createPersonalBlock({ label: " Lunch ", weekdays: [5, 1, 1], start_time: "12:00", end_time: "13:00", active: true });
    expect(p).toMatchObject({ label: "Lunch", weekdays: [1, 5] });
    await expect(createPersonalBlock({ label: "X", weekdays: [], start_time: "12:00", end_time: "13:00", active: true })).rejects.toThrow(/day/);
    await deletePersonalBlock(p.id);
    expect(await getPersonalBlocks()).toEqual([]);
  });
});

describe("week rollover (§5.4)", () => {
  it("moves still-todo actions from earlier weeks to this week only", async () => {
    const old = await addAction({ title: "Old", planned_week: "2026-09-28" });
    const done = await addAction({ title: "Done", planned_week: "2026-09-28" });
    await getDb().t("actions").update(done.id, { status: "done" });
    const backlog = await addAction({ title: "Backlog" });
    const current = await addAction({ title: "Current", planned_week: "2026-10-05" });
    expect(await rolloverWeek("2026-10-05")).toBe(1);
    const get = async (id: string) => (await getDb().t("actions").get(id))?.planned_week;
    expect(await get(old.id)).toBe("2026-10-05");
    expect(await get(done.id)).toBe("2026-09-28");
    expect(await get(backlog.id)).toBeNull();
    expect(await get(current.id)).toBe("2026-10-05");
    expect(await rolloverWeek("2026-10-05")).toBe(0);
  });
});
