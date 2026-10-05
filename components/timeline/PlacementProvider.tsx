"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { getPlacementContext, useSettings } from "@/data";
import { checkPlacement, snapToFree, type PlacementWarning } from "@/lib/placement";
import { todayIn, toLocalDate, toLocalTime } from "@/lib/time";
import { placeBlock, rescheduleTo, updateBlockPlacement } from "@/repo";
import type { Action, Block } from "@/types";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { BlockSheet } from "./BlockSheet";
import { ScheduleSheet } from "./ScheduleSheet";

export interface Proposal {
  /** Epoch ms. */
  start: number;
  pomodoros: number;
  /** Defaults to the settings buffer for new blocks. */
  bufferMinutes?: number;
}

interface PlacementApi {
  /**
   * Run the §5.8 rules on a proposal and act on them: an overlap snaps to the nearest free
   * position (or gives up and leaves things as they were); soft warnings ask "Place anyway?".
   * Resolves true when the block was saved.
   */
  place: (action: Pick<Action, "id" | "goal_id" | "due_on">, proposal: Proposal, block?: Block, opts?: PlaceOptions) => Promise<boolean>;
  /** Tap alternative to dragging: pick a day, time, and size for an action. */
  schedule: (action: Action, date?: string, opts?: PlaceOptions & { pomodoros?: number }) => void;
  /** The block sheet. */
  openBlock: (block: Block) => void;
  toast: (message: string) => void;
}

export interface PlaceOptions {
  /** Rescheduling a missed block (§5.10): the new block is its successor. */
  replaces?: string;
}

const Ctx = createContext<PlacementApi | null>(null);

export function usePlacement(): PlacementApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("usePlacement needs a PlacementProvider.");
  return api;
}

export function PlacementProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const [confirm, setConfirm] = useState<{ warnings: PlacementWarning[]; resolve: (ok: boolean) => void } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<{ action: Action; date?: string; opts?: PlaceOptions & { pomodoros?: number }; key: number } | null>(null);
  const [blockOpen, setBlockOpen] = useState<Block | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = useCallback((m: string) => {
    setMessage(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(null), 4000);
  }, []);

  const place = useCallback<PlacementApi["place"]>(
    async (action, proposal, block, opts) => {
      if (!settings) return false;
      const tz = settings.timezone;
      const date = toLocalDate(proposal.start, tz);
      const ctx = await getPlacementContext(date);
      const input = {
        start: proposal.start,
        pomodoros: proposal.pomodoros,
        bufferMinutes: proposal.bufferMinutes ?? block?.buffer_minutes ?? settings.default_buffer_minutes,
        blockId: block?.id,
        action,
        timeZone: tz,
        today: todayIn(Date.now(), tz),
        availability: ctx.availability,
        peak: ctx.peak,
        personal: ctx.personal,
        events: [],
        blocks: ctx.blocks,
        dailyCap: settings.daily_pomodoro_cap,
      };
      let result = checkPlacement(input);
      if (!result.ok && result.reason === "overlap") {
        // The one hard rule: snap to the nearest free position, or give up and leave things as they were.
        const snapped = snapToFree(input);
        if (snapped === null) {
          toast("There is no free spot for it that day, so nothing changed.");
          return false;
        }
        input.start = snapped;
        result = checkPlacement(input);
        if (result.ok) toast(`Moved to ${toLocalTime(snapped, tz)} so it doesn't overlap another block.`);
      }
      if (!result.ok) {
        toast(result.message);
        return false;
      }
      if (result.warnings.length > 0) {
        const go = await new Promise<boolean>((resolve) => setConfirm({ warnings: result.warnings, resolve }));
        setConfirm(null);
        if (!go) return false;
      }
      try {
        const p = { start: input.start, pomodoros: input.pomodoros, bufferMinutes: input.bufferMinutes };
        if (block) await updateBlockPlacement(block.id, p);
        else if (opts?.replaces) await rescheduleTo(opts.replaces, p);
        else await placeBlock(action.id, p);
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : "That could not be placed.");
        return false;
      }
    },
    [settings, toast],
  );

  const api: PlacementApi = {
    place,
    toast,
    schedule: (action, date, opts) => setScheduling({ action, date, opts, key: Date.now() }),
    openBlock: setBlockOpen,
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet
        open={confirm !== null}
        onClose={() => confirm?.resolve(false)}
        title="Place anyway?"
        footer={
          <div className="flex gap-3">
            <Button block onClick={() => confirm?.resolve(false)}>
              Cancel
            </Button>
            <Button block variant="primary" onClick={() => confirm?.resolve(true)}>
              Place anyway
            </Button>
          </div>
        }
      >
        <ul className="flex flex-col gap-2">
          {confirm?.warnings.map((w) => (
            <li key={w.kind} className="flex gap-2">
              <span aria-hidden="true" className="text-warning">
                ⚠
              </span>
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      </Sheet>
      {scheduling ? (
        <ScheduleSheet key={scheduling.key} action={scheduling.action} initialDate={scheduling.date} options={scheduling.opts} onClose={() => setScheduling(null)} />
      ) : null}
      <BlockSheet block={blockOpen} onClose={() => setBlockOpen(null)} />
      {/* At the top, so it never covers a sheet. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[70] flex justify-center px-4">
        {message ? (
          <p role="status" className="max-w-sm rounded-card border border-border bg-surface-raised px-4 py-3 text-center shadow-lg">
            {message}
          </p>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}
