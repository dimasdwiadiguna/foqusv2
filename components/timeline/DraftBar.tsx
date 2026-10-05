"use client";

import { useState, useSyncExternalStore } from "react";
import { useBlocksForDays, useRows, useSettings } from "@/data";
import type { DidntFit } from "@/lib/draft";
import { endOfWeek } from "@/lib/time";
import { commitDraft, discardDraft, draftMyWeek } from "@/repo";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { usePlacement } from "./PlacementProvider";

/**
 * The weekly draft in Plan (§5.11, §6.7 Plan): "Draft my week" in the tray bar; while a draft
 * exists, a sticky bar replaces the tray: "12 blocks drafted · 2 didn't fit  [Discard] [Commit]".
 * The "didn't fit" list lives for the session (it is the result of the last run, not stored data).
 */
let lastRun = new Map<string, DidntFit[]>();
const listeners = new Set<() => void>();
const setDidntFit = (week: string, list: DidntFit[]) => {
  lastRun = new Map(lastRun).set(week, list);
  listeners.forEach((l) => l());
};
const useDidntFit = (week: string) =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => lastRun.get(week) ?? EMPTY,
    () => EMPTY,
  );
const EMPTY: DidntFit[] = [];

/** Draft blocks in the week, or undefined while loading. */
export function useDraftBlocks(weekStart: string | undefined) {
  const settings = useSettings();
  const blocks = useBlocksForDays(weekStart, weekStart ? endOfWeek(weekStart) : undefined, settings?.timezone);
  return blocks?.filter((b) => b.status === "draft");
}

export function DraftButton({ weekStart, unscheduled }: { weekStart: string; unscheduled: number }) {
  const { toast } = usePlacement();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="primary"
      className="mr-2 shrink-0 px-4"
      disabled={busy}
      onClick={async () => {
        if (unscheduled === 0) {
          toast("Everything on this week's list already has a time.");
          return;
        }
        setBusy(true);
        try {
          const r = await draftMyWeek(weekStart);
          setDidntFit(weekStart, r.didntFit);
          if (r.placed === 0) toast(r.didntFit.length ? "Nothing fits this week. See what didn't fit." : "Nothing to draft.");
        } catch (e) {
          toast(e instanceof Error ? e.message : "The draft could not be made.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Drafting…" : "Draft my week"}
    </Button>
  );
}

export function DraftBar({ weekStart, drafted }: { weekStart: string; drafted: number }) {
  const { toast } = usePlacement();
  const didntFit = useDidntFit(weekStart);
  const actions = useRows("actions");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<string>) => async () => {
    setBusy(true);
    try {
      toast(await fn());
      setDidntFit(weekStart, []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="region" aria-label="Draft" className="flex min-h-12 items-center gap-2 border-t border-accent/60 bg-surface py-1 pr-2 pl-4">
      <p className="min-w-0 flex-1 text-caption leading-tight">
        <span className="block font-semibold">
          {drafted} {drafted === 1 ? "block" : "blocks"} drafted
        </span>
        {didntFit.length ? (
          <button type="button" onClick={() => setOpen(true)} className="-my-2 min-h-11 text-left text-warning underline underline-offset-2">
            {didntFit.length} didn&apos;t fit
          </button>
        ) : (
          <span className="text-text-muted">Adjust, then commit</span>
        )}
      </p>
      <Button className="shrink-0 px-4" disabled={busy} onClick={run(async () => `Draft discarded (${await discardDraft(weekStart)} blocks).`)}>
        Discard
      </Button>
      <Button variant="primary" className="shrink-0 px-4" disabled={busy} onClick={run(async () => {
        const n = await commitDraft(weekStart);
        return `${n} ${n === 1 ? "block" : "blocks"} scheduled.`;
      })}>
        Commit
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Didn't fit">
        <ul className="divide-y divide-border">
          {didntFit.map((d) => (
            <li key={d.action_id} className="py-2">
              <p>{actions?.find((a) => a.id === d.action_id)?.title ?? "Deleted action"}</p>
              <p className="text-caption text-text-muted">
                {d.pomodoros} {d.pomodoros === 1 ? "pomodoro" : "pomodoros"} · {d.reason}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-caption text-text-muted">They stay in the tray. Place them by hand, or make room and draft again.</p>
      </Sheet>
    </div>
  );
}
