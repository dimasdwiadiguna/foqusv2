"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getWeekContext, useActiveSession, useRow, useSettings, useToday, useUnresolvedBlocks } from "@/data";
import { pickSlot, type PickedSlot } from "@/lib/scheduler";
import { formatDayHeader, toLocalDate, toLocalTime } from "@/lib/time";
import { rescheduleTo, rescheduleToTray, resolveDone, resolveDrop } from "@/repo";
import type { Block, Settings } from "@/types";
import { celebrate } from "@/components/celebration/celebrate";
import { usePlacement } from "@/components/timeline/PlacementProvider";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";

const Ctx = createContext<() => void>(() => {});

/** Open the resolver (the Today prompt card). */
export function useOpenResolver() {
  return useContext(Ctx);
}

/**
 * The missed-block resolver (§5.10). On app open and on return to the foreground, unresolved blocks
 * are listed oldest first, one card each: Done, Reschedule, or Drop. "Later" hides it until the
 * next open. It stays out of the way while a focus session runs.
 */
export function ResolverProvider({ children }: { children: React.ReactNode }) {
  const blocks = useUnresolvedBlocks();
  const session = useActiveSession();
  const settings = useSettings();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && setOpen(true);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const show = open && !session && settings && blocks && blocks.length > 0;
  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {/* The app underneath is inert while the resolver is up: no focus or taps behind it. */}
      <div inert={Boolean(show)} className="contents">
        {children}
      </div>
      {show ? <ResolverScreen blocks={blocks} settings={settings} onLater={() => setOpen(false)} /> : null}
    </Ctx.Provider>
  );
}

function ResolverScreen({ blocks, settings, onLater }: { blocks: Block[]; settings: Settings; onLater: () => void }) {
  const [resolvedCount, setResolvedCount] = useState(0);
  const total = blocks.length + resolvedCount;
  const block = blocks[0];
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="resolver-title" className="fixed inset-0 z-40 flex justify-center bg-bg">
      <div className="flex w-full max-w-[480px] flex-col px-4 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="flex min-h-11 items-center justify-between">
          <span className="text-caption text-text-muted">
            {resolvedCount + 1} of {total}
          </span>
          <button type="button" onClick={onLater} className="-mr-2 min-h-11 px-2 text-accent">
            Later
          </button>
        </div>
        <div className="mb-6 h-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={resolvedCount}>
          <div className="h-full bg-accent" style={{ width: `${(resolvedCount / total) * 100}%` }} />
        </div>
        <h1 id="resolver-title" className="mb-1 text-title">
          What happened?
        </h1>
        <p className="mb-6 text-text-muted">This block&apos;s time has passed. Nothing disappears silently.</p>
        <BlockCard key={block.id} block={block} settings={settings} onResolved={() => setResolvedCount((n) => n + 1)} />
      </div>
    </div>
  );
}

type Step = "choose" | "done-count" | "done-action" | "reschedule" | "drop";

export function BlockCard({ block, settings, onResolved }: { block: Block; settings: Settings; onResolved: () => void }) {
  const action = useRow("actions", block.action_id);
  const goal = useRow("goals", action?.goal_id ?? "");
  const area = useRow("areas", action?.area_id ?? "");
  const today = useToday();
  const { schedule } = usePlacement();
  const [step, setStep] = useState<Step>("choose");
  const [completed, setCompleted] = useState(block.planned_pomodoros);
  const [slot, setSlot] = useState<PickedSlot | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const tz = settings.timezone;

  // "Next free slot": the §5.11 rule for this one block.
  useEffect(() => {
    if (step !== "reschedule" || !action || !today) return;
    let live = true;
    void getWeekContext(today).then((ctx) => {
      if (!live) return;
      setSlot(
        pickSlot({
          action,
          pomodoros: block.planned_pomodoros,
          bufferMinutes: block.buffer_minutes,
          timeZone: tz,
          now: new Date().toISOString(),
          today,
          windows: ctx.windows,
          personal: ctx.personal,
          events: [],
          blocks: ctx.blocks,
          dailyCap: settings.daily_pomodoro_cap,
          excludeBlockId: block.id,
        }),
      );
    });
    return () => {
      live = false;
    };
  }, [step, action, today, block, tz, settings.daily_pomodoro_cap]);

  const run = (fn: () => Promise<unknown>, after?: () => void) => async () => {
    setError(null);
    try {
      await fn();
      after?.();
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    }
  };

  const big = "min-h-14 text-heading";

  return (
    <section className="flex flex-1 flex-col">
      <div className="mb-6 rounded-card border border-danger/60 bg-surface p-4">
        <p className="text-caption text-text-muted">
          {formatDayHeader(toLocalDate(block.starts_at, tz))} · {toLocalTime(block.starts_at, tz)} – {toLocalTime(block.ends_at, tz)}
        </p>
        <p className="text-heading">{action?.title ?? "Deleted action"}</p>
        <p className="text-caption text-text-muted">
          {goal?.title ?? area?.name ?? ""} · {block.planned_pomodoros} {block.planned_pomodoros === 1 ? "pomodoro" : "pomodoros"}
        </p>
      </div>

      {step === "choose" ? (
        <div className="flex flex-col gap-3">
          <Button variant="primary" className={big} onClick={() => setStep("done-count")}>
            Done
          </Button>
          <Button className={big} onClick={() => setStep("reschedule")}>
            Reschedule
          </Button>
          <Button className={big} onClick={() => setStep("drop")}>
            Drop
          </Button>
        </div>
      ) : null}

      {step === "done-count" ? (
        <div>
          <p className="mb-3">How many pomodoros did you complete?</p>
          <Stepper label="completed pomodoros" value={completed} min={0} max={block.planned_pomodoros} onChange={setCompleted} />
          <Button variant="primary" block className="mt-6" onClick={() => setStep("done-action")}>
            Next
          </Button>
        </div>
      ) : null}

      {step === "done-action" ? (
        <div>
          <p className="mb-3">Is {action ? `“${action.title}”` : "the action"} done?</p>
          <div className="flex gap-3">
            <Button className={`flex-1 ${big}`} onClick={run(() => resolveDone(block.id, completed, true), () => void celebrate("action"))}>
              Yes
            </Button>
            <Button className={`flex-1 ${big}`} onClick={run(() => resolveDone(block.id, completed, false))}>
              Not yet
            </Button>
          </div>
        </div>
      ) : null}

      {step === "reschedule" ? (
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            className={big}
            disabled={!slot}
            onClick={run(() => rescheduleTo(block.id, { start: slot!.start, pomodoros: block.planned_pomodoros, bufferMinutes: block.buffer_minutes }))}
          >
            {slot === undefined
              ? "Finding the next free slot…"
              : slot
                ? `Next free slot: ${formatDayHeader(slot.date)} ${toLocalTime(slot.start, tz)}`
                : "No free slot left this week"}
          </Button>
          <Button
            className={big}
            disabled={!action}
            onClick={() => action && schedule(action, today, { replaces: block.id, pomodoros: block.planned_pomodoros })}
          >
            Pick a time
          </Button>
          <Button className={big} onClick={run(() => rescheduleToTray(block.id))}>
            Back to tray
          </Button>
          <Button variant="ghost" onClick={() => setStep("choose")}>
            Back
          </Button>
        </div>
      ) : null}

      {step === "drop" ? (
        <div className="flex flex-col gap-3">
          <p className="text-text-muted">The block is marked missed. The action stays in the tray unless you drop it too.</p>
          <Button className={big} onClick={run(() => resolveDrop(block.id, false))}>
            Drop this block
          </Button>
          <Button variant="danger" className={big} onClick={run(() => resolveDrop(block.id, true))}>
            Drop the action too
          </Button>
          <Button variant="ghost" onClick={() => setStep("choose")}>
            Back
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
