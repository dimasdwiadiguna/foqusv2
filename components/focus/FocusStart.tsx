"use client";

import Link from "next/link";
import { useState } from "react";
import { useBlocksForDays, useNow, useRows, useSettings, useToday, useWeekList } from "@/data";
import { startOfWeek, toLocalTime } from "@/lib/time";
import type { Action, Block } from "@/types";
import { ChevronDownIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { useStartFocus } from "./useStartFocus";

const SOON_MS = 15 * 60_000;

/**
 * The center button with no session running (§5.9): offer the current block, or the next block if
 * it begins within 15 minutes; otherwise a picker of this week's actions (an ad hoc block of 1
 * pomodoro, adjustable before starting).
 */
export function FocusStart() {
  const settings = useSettings();
  const today = useToday();
  const now = useNow(30_000);
  const blocks = useBlocksForDays(today, today, settings?.timezone);
  const week = useWeekList(today ? startOfWeek(today) : undefined);
  const actions = useRows("actions");
  const focus = useStartFocus();
  const [picked, setPicked] = useState<Action | null>(null);
  const [pomodoros, setPomodoros] = useState(1);
  if (!settings || !blocks || !week || !actions) return null;

  const ready: Block | undefined = blocks.find(
    (b) => b.status === "scheduled" && Date.parse(b.starts_at) - SOON_MS <= now && Date.parse(b.ends_at) > now,
  );
  const readyAction = ready ? actions.find((a) => a.id === ready.action_id) : undefined;

  return (
    <>
      <header className="flex items-center px-2 pt-[max(env(safe-area-inset-top),12px)]">
        <Link href="/today" aria-label="Back to Today" className="flex size-11 items-center justify-center text-text-muted">
          <ChevronDownIcon className="size-7" />
        </Link>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        {ready ? (
          <section className="mt-8 text-center">
            <p className="text-caption tracking-wide text-accent uppercase">
              {Date.parse(ready.starts_at) <= now ? "Now" : "Starting soon"} · {toLocalTime(ready.starts_at, settings.timezone)}
            </p>
            <h1 className="mt-2 text-title">{readyAction?.title ?? "Block"}</h1>
            <p className="mt-1 text-text-muted">
              {ready.planned_pomodoros} {ready.planned_pomodoros === 1 ? "pomodoro" : "pomodoros"}
            </p>
            <Button variant="primary" className="mt-8 min-h-14 px-10 text-heading" onClick={() => focus.start({ blockId: ready.id, pomodoros: ready.planned_pomodoros })}>
              Start focus
            </Button>
          </section>
        ) : (
          <section className="mt-4">
            <h1 className="text-title">What will you focus on?</h1>
            <p className="mt-1 mb-4 text-text-muted">Nothing is scheduled right now. Pick from this week.</p>
            {week.length === 0 ? <p className="text-text-muted">This week&apos;s list is empty. Add actions with “This week” turned on.</p> : null}
            <ul>
              {week.map((a) => (
                <li key={a.id} className="mb-2">
                  <button
                    type="button"
                    aria-pressed={picked?.id === a.id}
                    onClick={() => {
                      setPicked(a);
                      setPomodoros(1);
                    }}
                    className={`flex min-h-12 w-full items-center rounded-card border px-4 text-left ${picked?.id === a.id ? "border-accent" : "border-border"} bg-surface`}
                  >
                    {a.title}
                  </button>
                </li>
              ))}
            </ul>
            {picked ? (
              <div className="sticky bottom-0 mt-4 rounded-card border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span>Pomodoros</span>
                  <Stepper label="pomodoros" value={pomodoros} min={1} max={settings.max_pomodoros_per_block} onChange={setPomodoros} />
                </div>
                <Button variant="primary" block onClick={() => focus.start({ actionId: picked.id, pomodoros })}>
                  Start focus
                </Button>
              </div>
            ) : null}
          </section>
        )}
        {focus.dialog}
      </main>
    </>
  );
}
