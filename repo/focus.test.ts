import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { getUnresolvedBlocks } from "@/data/queries";
import {
  addAction,
  addSessionPomodoro,
  endSession,
  placeBlock,
  rescheduleTo,
  rescheduleToTray,
  resolveDone,
  resolveDrop,
  saveScratchpad,
  sessionStep,
  startSession,
} from "@/repo";
import { freshDb, setNow } from "@/test/db";

const at = (time: string, date = "2026-10-06") => Date.parse(`${date}T${time}:00+07:00`);
const get = <N extends "blocks" | "actions" | "focus_sessions">(table: N, id: string) => getDb().t(table).get(id);

beforeEach(() => freshDb(new Date(at("06:00")).toISOString()));
afterEach(() => vi.useRealTimers());

describe("focus sessions (§5.9)", () => {
  it("starting a block late shifts it to now and makes it active", async () => {
    const a = await addAction({ title: "Outline" });
    const b = await placeBlock(a.id, { start: at("05:30"), pomodoros: 2, bufferMinutes: 10 });
    setNow(new Date(at("06:07")).toISOString());
    const s = await startSession({ blockId: b.id }, at("06:07"));
    expect(s).toMatchObject({ block_id: b.id, action_id: a.id, planned_pomodoros: 2, completed_pomodoros: 0, state: { phase: "focus" } });
    expect(await get("blocks", b.id)).toMatchObject({
      status: "active",
      starts_at: new Date(at("06:07")).toISOString(),
      ends_at: new Date(at("07:07")).toISOString(),
    });
    await expect(startSession({ blockId: b.id }, at("06:08"))).rejects.toThrow(/already running/);
  });

  it("an action with no block gets an ad hoc block starting now", async () => {
    const a = await addAction({ title: "Email" });
    const s = await startSession({ actionId: a.id, pomodoros: 2 }, at("06:00"));
    expect(await get("blocks", s.block_id!)).toMatchObject({ origin: "adhoc", status: "active", planned_pomodoros: 2 });
  });

  it("refuses to overlap another block unless that block is moved to the tray", async () => {
    const a = await addAction({ title: "A" });
    const other = await placeBlock(a.id, { start: at("06:30"), pomodoros: 1, bufferMinutes: 10 });
    await expect(startSession({ actionId: a.id, pomodoros: 2 }, at("06:00"))).rejects.toThrow(/overlap/);
    await startSession({ actionId: a.id, pomodoros: 2, moveToTray: [other.id] }, at("06:00"));
    expect((await get("blocks", other.id))?.deleted_at).not.toBeNull();
  });

  it("pause, resume, and scratchpad are stored", async () => {
    const a = await addAction({ title: "A" });
    const s = await startSession({ actionId: a.id }, at("06:00"));
    await sessionStep(s.id, "pause", at("06:10"));
    expect((await get("focus_sessions", s.id))?.state).toMatchObject({ phase: "paused", resume_phase: "focus", resume_seconds_remaining: 900 });
    await sessionStep(s.id, "resume", at("06:20"));
    expect(await get("focus_sessions", s.id)).toMatchObject({ pause_seconds: 600, state: { phase: "focus", phase_elapsed_before: 600 } });
    await saveScratchpad(s.id, "idea");
    expect((await get("focus_sessions", s.id))?.scratchpad).toBe("idea");
  });

  it("ending with 0 pomodoros returns the block to scheduled", async () => {
    const a = await addAction({ title: "A" });
    const b = await placeBlock(a.id, { start: at("06:00"), pomodoros: 2, bufferMinutes: 10 });
    const s = await startSession({ blockId: b.id }, at("06:00"));
    await endSession(s.id, { actionDone: false, focusRating: 3, note: null }, at("06:10"));
    expect(await get("blocks", b.id)).toMatchObject({ status: "scheduled", completed_pomodoros: 0 });
    expect(await get("focus_sessions", s.id)).toMatchObject({ completed_pomodoros: 0, focus_seconds: 600, focus_rating: 3, state: { phase: "ended" } });
  });

  it("ending after pomodoros marks the block done; 'needs more time' raises the estimate", async () => {
    const a = await addAction({ title: "A", estimate_pomodoros: 1 });
    const s = await startSession({ actionId: a.id }, at("06:00"));
    await endSession(s.id, { actionDone: false, extraPomodoros: 2, focusRating: 4, note: " ok " }, at("06:26"));
    expect(await get("blocks", s.block_id!)).toMatchObject({ status: "done", completed_pomodoros: 1 });
    expect(await get("actions", a.id)).toMatchObject({ status: "todo", estimate_pomodoros: 3 });
    expect(await get("focus_sessions", s.id)).toMatchObject({ note: "ok", completed_pomodoros: 1 });
  });

  it("a session that ends early frees the rest of its slot for the next one", async () => {
    const a = await addAction({ title: "A" });
    const s = await startSession({ actionId: a.id }, at("06:00")); // 06:00–06:30
    await endSession(s.id, { actionDone: false, focusRating: null, note: null }, at("06:26"));
    expect(await get("blocks", s.block_id!)).toMatchObject({ status: "done", ends_at: new Date(at("06:26")).toISOString() });
    await expect(startSession({ actionId: a.id }, at("06:26"))).resolves.toBeTruthy();
  });

  it("'Is this action done? Yes' completes the action", async () => {
    const a = await addAction({ title: "A" });
    const s = await startSession({ actionId: a.id }, at("06:00"));
    await endSession(s.id, { actionDone: true, focusRating: null, note: null }, at("06:26"));
    expect(await get("actions", a.id)).toMatchObject({ status: "done" });
    expect((await get("focus_sessions", s.id))?.action_completed).toBe(true);
  });

  it("the away check can override the completed count", async () => {
    const a = await addAction({ title: "A" });
    const s = await startSession({ actionId: a.id, pomodoros: 3 }, at("06:00"));
    await endSession(s.id, { completed: 2, actionDone: false, focusRating: null, note: null }, at("09:00"));
    expect(await get("blocks", s.block_id!)).toMatchObject({ status: "done", completed_pomodoros: 2 });
  });

  it("adding a pomodoro grows the block, pushing the next one later if asked", async () => {
    const a = await addAction({ title: "A" });
    const s = await startSession({ actionId: a.id }, at("06:00")); // 06:00–06:30
    const next = await placeBlock(a.id, { start: at("06:40"), pomodoros: 1, bufferMinutes: 10 });
    await expect(addSessionPomodoro(s.id, {}, at("06:05"))).rejects.toThrow(/overlap/);
    await addSessionPomodoro(s.id, { pushBlockId: next.id }, at("06:05"));
    expect(await get("blocks", s.block_id!)).toMatchObject({ planned_pomodoros: 2, ends_at: new Date(at("07:00")).toISOString() });
    expect(await get("blocks", next.id)).toMatchObject({ starts_at: new Date(at("07:10")).toISOString() });
    expect((await get("focus_sessions", s.id))?.planned_pomodoros).toBe(2);
  });
});

describe("missed-block resolver (§5.10)", () => {
  const missed = async () => {
    const a = await addAction({ title: "Grade quizzes" });
    const b = await placeBlock(a.id, { start: at("06:00"), pomodoros: 2, bufferMinutes: 10 });
    setNow(new Date(at("08:00")).toISOString());
    return { a, b };
  };

  it("finds unresolved blocks, oldest first", async () => {
    const { b } = await missed();
    expect((await getUnresolvedBlocks(at("08:00"))).map((x) => x.id)).toEqual([b.id]);
    expect(await getUnresolvedBlocks(at("06:30"))).toEqual([]);
  });

  it("Done records the pomodoros and can complete the action", async () => {
    const { a, b } = await missed();
    await resolveDone(b.id, 1, true);
    expect(await get("blocks", b.id)).toMatchObject({ status: "done", completed_pomodoros: 1 });
    expect((await get("actions", a.id))?.status).toBe("done");
    expect(await getUnresolvedBlocks(at("08:00"))).toEqual([]);
  });

  it("Reschedule to a time links the successor and counts the reschedule", async () => {
    const { a, b } = await missed();
    const next = await rescheduleTo(b.id, { start: at("10:00"), pomodoros: 2, bufferMinutes: 10 });
    expect(await get("blocks", b.id)).toMatchObject({ status: "missed", resolution: "rescheduled", replaced_by_block_id: next.id });
    expect(next).toMatchObject({ status: "scheduled", action_id: a.id });
    expect((await get("actions", a.id))?.reschedule_count).toBe(1);
  });

  it("Reschedule back to the tray counts the reschedule with no successor", async () => {
    const { a, b } = await missed();
    await rescheduleToTray(b.id);
    expect(await get("blocks", b.id)).toMatchObject({ status: "missed", resolution: "rescheduled", replaced_by_block_id: null });
    expect((await get("actions", a.id))?.reschedule_count).toBe(1);
  });

  it("Drop keeps the action, or drops it too", async () => {
    const { a, b } = await missed();
    await resolveDrop(b.id, false);
    expect(await get("blocks", b.id)).toMatchObject({ status: "missed", resolution: "dropped" });
    expect((await get("actions", a.id))?.status).toBe("todo");
    const second = await placeBlock(a.id, { start: at("07:00"), pomodoros: 1, bufferMinutes: 0 });
    await resolveDrop(second.id, true);
    expect((await get("actions", a.id))?.status).toBe("dropped");
    await expect(resolveDrop(second.id, true)).rejects.toThrow(/already resolved/);
  });
});
