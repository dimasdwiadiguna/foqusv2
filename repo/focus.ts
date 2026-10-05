/** Focus sessions (§5.9). The timer math lives in `lib/timer`; this file stores its results. */
import { getDb } from "@/db";
import { getSettings } from "@/data/queries";
import { blockSpan } from "@/lib/availability";
import { MINUTE } from "@/lib/intervals";
import { overlappingBlock } from "@/lib/placement";
import * as timer from "@/lib/timer";
import type { Block, FocusSession } from "@/types";
import { completeAction } from "./actions";
import { nowInstant } from "./clock";
import { createRow, softDelete, updateRow } from "./rows";
import { ALL_TABLES, writeTx } from "./tx";

const FOCUS_TABLES = ALL_TABLES;
const POMODORO_MS = 30 * MINUTE;

async function config(): Promise<timer.TimerConfig> {
  const s = await getSettings();
  if (!s) throw new Error("Settings are missing.");
  return { focusMinutes: s.focus_minutes, breakMinutes: s.break_minutes, autoStart: s.auto_start_next_phase };
}

/** The one session that has not ended, if any. */
export async function getActiveSession(): Promise<FocusSession | undefined> {
  return (await getDb().t("focus_sessions").toArray()).find((s) => !s.deleted_at && s.ended_at === null && s.state.phase !== "ended");
}

async function liveBlocksAround(start: number, end: number): Promise<Block[]> {
  const from = new Date(start - 24 * 60 * MINUTE).toISOString();
  const to = new Date(end + 24 * 60 * MINUTE).toISOString();
  return (await getDb().t("blocks").where("starts_at").between(from, to).toArray()).filter((b) => !b.deleted_at);
}

export interface StartOptions {
  /** Start the session on this block, shifting it to start now. */
  blockId?: string;
  /** Or start on this action with a new ad hoc block. */
  actionId?: string;
  /** Pomodoros for an ad hoc block (default 1). */
  pomodoros?: number;
  /** Scheduled blocks the owner agreed to move back to the tray (soft-deleted). */
  moveToTray?: string[];
}

/**
 * Start a session (§5.9). Only one session runs at a time. Starting a block early or late shifts it
 * to start now; an action without a block gets an ad hoc block of `pomodoros`. Any overlap left
 * after moving blocks to the tray is refused (the hard rule still holds).
 */
export async function startSession(opts: StartOptions, nowMs = Date.parse(nowInstant())): Promise<FocusSession> {
  return writeTx(FOCUS_TABLES, async () => {
    if (await getActiveSession()) throw new Error("A focus session is already running.");
    const settings = await getSettings();
    if (!settings) throw new Error("Settings are missing.");
    const start = Math.floor(nowMs / MINUTE) * MINUTE;

    for (const id of opts.moveToTray ?? []) {
      const b = await getDb().t("blocks").get(id);
      if (b && !b.deleted_at && b.status === "scheduled") await softDelete("blocks", id);
    }

    let block: Block;
    if (opts.blockId) {
      const existing = await getDb().t("blocks").get(opts.blockId);
      if (!existing || existing.deleted_at) throw new Error("That block no longer exists.");
      if (existing.status !== "scheduled") throw new Error("Only a scheduled block can be started.");
      block = existing;
    } else {
      const action = opts.actionId ? await getDb().t("actions").get(opts.actionId) : undefined;
      if (!action || action.deleted_at) throw new Error("That action no longer exists.");
      const pomodoros = Math.min(Math.max(opts.pomodoros ?? 1, 1), settings.max_pomodoros_per_block);
      block = await createRow("blocks", {
        action_id: action.id,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(start + pomodoros * POMODORO_MS).toISOString(),
        planned_pomodoros: pomodoros,
        buffer_minutes: settings.default_buffer_minutes,
        status: "scheduled",
        completed_pomodoros: 0,
        resolution: null,
        resolved_at: null,
        origin: "adhoc",
        off_peak: false,
        after_due: false,
        replaced_by_block_id: null,
      });
    }

    const span = { start, end: start + block.planned_pomodoros * POMODORO_MS };
    const clash = overlappingBlock(span, await liveBlocksAround(span.start, span.end), block.id);
    if (clash) throw new Error("This would overlap another block.");
    await updateRow("blocks", block.id, {
      status: "active",
      starts_at: new Date(span.start).toISOString(),
      ends_at: new Date(span.end).toISOString(),
    });

    return createRow("focus_sessions", {
      block_id: block.id,
      action_id: block.action_id,
      started_at: new Date(nowMs).toISOString(),
      ended_at: null,
      planned_pomodoros: block.planned_pomodoros,
      completed_pomodoros: 0,
      focus_seconds: 0,
      pause_seconds: 0,
      focus_rating: null,
      action_completed: false,
      note: null,
      scratchpad: null,
      state: timer.initialState(nowMs),
      pomodoros: [],
    });
  });
}

type Step = "pause" | "resume" | "skipBreak" | "startNext";

/** Pause, resume, skip break, or start the waiting phase. A no-op when it does not apply. */
export async function sessionStep(id: string, step: Step, nowMs = Date.parse(nowInstant())): Promise<void> {
  const cfg = await config();
  await writeTx(FOCUS_TABLES, async () => {
    const s = await getDb().t("focus_sessions").get(id);
    if (!s || s.deleted_at || s.ended_at) return;
    const patch = timer[step](s, nowMs, cfg);
    if (patch) await updateRow("focus_sessions", id, patch);
  });
}

export interface AddPomodoroOptions {
  /** Push this block (the next one) to start right after the longer block. */
  pushBlockId?: string;
  /** Move this block back to the tray. */
  trayBlockId?: string;
}

/**
 * Add a pomodoro (§5.9): the session plans one more, and its block grows by 30 minutes. If that
 * runs into the next block, the owner chose to push it later or move it back to the tray.
 */
export async function addSessionPomodoro(id: string, opts: AddPomodoroOptions = {}, nowMs = Date.parse(nowInstant())): Promise<void> {
  const cfg = await config();
  await writeTx(FOCUS_TABLES, async () => {
    const s = await getDb().t("focus_sessions").get(id);
    if (!s || s.deleted_at || s.ended_at) throw new Error("This session has ended.");
    const block = s.block_id ? await getDb().t("blocks").get(s.block_id) : undefined;
    if (block && !block.deleted_at) {
      const span = blockSpan(block);
      const longer = { start: span.start, end: span.end + POMODORO_MS };
      if (opts.trayBlockId) await softDelete("blocks", opts.trayBlockId);
      if (opts.pushBlockId) {
        const next = await getDb().t("blocks").get(opts.pushBlockId);
        if (next && !next.deleted_at) {
          const length = blockSpan(next).end - blockSpan(next).start;
          const pushedStart = longer.end + block.buffer_minutes * MINUTE;
          const pushed = { start: pushedStart, end: pushedStart + length };
          if (overlappingBlock(pushed, await liveBlocksAround(pushed.start, pushed.end), next.id)) {
            throw new Error("There is no room to push that block later.");
          }
          await updateRow("blocks", next.id, { starts_at: new Date(pushed.start).toISOString(), ends_at: new Date(pushed.end).toISOString() });
        }
      }
      if (overlappingBlock(longer, await liveBlocksAround(longer.start, longer.end), block.id)) {
        throw new Error("This would overlap another block.");
      }
      await updateRow("blocks", block.id, { planned_pomodoros: block.planned_pomodoros + 1, ends_at: new Date(longer.end).toISOString() });
    }
    await updateRow("focus_sessions", id, timer.addPomodoro(s, nowMs, cfg));
  });
}

export async function saveScratchpad(id: string, text: string): Promise<void> {
  await updateRow("focus_sessions", id, { scratchpad: text.trim() ? text : null });
}

export interface EndInput {
  /** Override the completed count (the away check: "How many did you complete?"). */
  completed?: number;
  actionDone: boolean;
  /** "Needs more time": raise the action's estimate by this many pomodoros. */
  extraPomodoros?: number;
  focusRating: number | null;
  note: string | null;
}

/**
 * End a session (§5.9 Ending). The block becomes `done` with its completed count, or goes back to
 * `scheduled` with none. The action is marked done or its estimate raised, as the owner said.
 */
export async function endSession(id: string, input: EndInput, nowMs = Date.parse(nowInstant())): Promise<{ completed: number }> {
  const cfg = await config();
  return writeTx(FOCUS_TABLES, async () => {
    const s = await getDb().t("focus_sessions").get(id);
    if (!s || s.deleted_at || s.ended_at) throw new Error("This session has already ended.");
    const patch = timer.end(s, nowMs, cfg);
    const completed = Math.max(0, Math.min(input.completed ?? patch.completed_pomodoros, s.planned_pomodoros));
    const rating = input.focusRating === null ? null : Math.min(5, Math.max(1, Math.round(input.focusRating)));
    await updateRow("focus_sessions", id, {
      ...patch,
      completed_pomodoros: completed,
      ended_at: new Date(nowMs).toISOString(),
      focus_rating: rating,
      note: input.note?.trim() || null,
      action_completed: input.actionDone,
    });

    const block = s.block_id ? await getDb().t("blocks").get(s.block_id) : undefined;
    if (block && !block.deleted_at) {
      if (completed > 0) {
        // A session that ends early frees the rest of its slot: the done block ends when the
        // session did, so the next session can start right away.
        const endedAt = Math.floor(nowMs / MINUTE) * MINUTE; // the same minute a new session would start
        const ends = Math.max(Date.parse(block.starts_at), Math.min(Date.parse(block.ends_at), endedAt));
        await updateRow("blocks", block.id, {
          status: "done",
          completed_pomodoros: block.completed_pomodoros + completed,
          ends_at: new Date(ends).toISOString(),
        });
      } else {
        await updateRow("blocks", block.id, { status: "scheduled" });
      }
    }
    const action = await getDb().t("actions").get(s.action_id);
    if (action && !action.deleted_at && action.status === "todo") {
      if (input.actionDone) await completeAction(action.id);
      else if (input.extraPomodoros && input.extraPomodoros > 0) {
        await updateRow("actions", action.id, { estimate_pomodoros: Math.min(40, action.estimate_pomodoros + Math.round(input.extraPomodoros)) });
      }
    }
    return { completed };
  });
}
