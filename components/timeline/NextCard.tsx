"use client";

import { useAreas, useBlocksForDays, useNow, useRows, useSettings } from "@/data";
import { useEffect } from "react";
import { dayNumbers, isDayWon, type DayNumbers } from "@/lib/checkin";
import { toLocalTime } from "@/lib/time";
import { celebrate } from "@/components/celebration/celebrate";
import { PomodoroDots } from "@/components/ui/PomodoroDots";
import { Button } from "@/components/ui/Button";
import { usePlacement } from "./PlacementProvider";
import { useStartFocus } from "@/components/focus/useStartFocus";

/**
 * The Next card on Today (§6.7): the running or next block today. With none left, it points to
 * the week's tray instead.
 */
export function NextCard({ date, onOpenTray }: { date: string; onOpenTray: () => void }) {
  const settings = useSettings();
  const now = useNow(30_000);
  const blocks = useBlocksForDays(date, date, settings?.timezone);
  const actions = useRows("actions");
  const goals = useRows("goals");
  const areas = useAreas(true);
  const { openBlock } = usePlacement();
  const focus = useStartFocus();
  if (!settings || !blocks) return <div className="h-14 animate-pulse rounded-card bg-surface" />;

  const next = blocks.find((b) => (b.status === "scheduled" || b.status === "active") && Date.parse(b.ends_at) > now);
  if (!next && isDayWon(blocks)) return <DayWon date={date} numbers={dayNumbers(blocks)} />;
  if (!next) {
    return (
      <section aria-label="Next" className="flex items-center gap-2 rounded-card border border-border bg-surface py-1 pr-1 pl-3">
        <p className="min-w-0 flex-1 text-caption text-text-muted">Nothing scheduled. Pick something from your week.</p>
        <Button className="shrink-0 px-4" onClick={onOpenTray}>
          Open tray
        </Button>
      </section>
    );
  }
  const action = actions?.find((a) => a.id === next.action_id);
  const goal = action?.goal_id ? goals?.find((g) => g.id === action.goal_id) : undefined;
  const area = action?.area_id ? areas?.find((a) => a.id === action.area_id) : undefined;
  const tz = settings.timezone;
  // One compact row: it sticks under the Today header, so it is always one tap from focus.
  return (
    <section aria-label="Next" className="flex items-center gap-2 rounded-card border border-border bg-surface py-1 pr-1 pl-3">
      <button type="button" onClick={() => openBlock(next)} className="min-w-0 flex-1 py-0.5 text-left">
        <span className="flex items-center gap-2 text-[12px] leading-4 font-medium tracking-wide text-accent uppercase">
          {Date.parse(next.starts_at) <= now ? "Now" : "Next"} · {toLocalTime(next.starts_at, tz)} – {toLocalTime(next.ends_at, tz)}
          <PomodoroDots completed={next.completed_pomodoros} total={next.planned_pomodoros} />
        </span>
        <span className="block truncate text-[15px] leading-5 font-semibold">{action?.title ?? "Deleted action"}</span>
        <span className="block truncate text-[12px] leading-4 text-text-muted">{goal?.title ?? area?.name ?? ""}</span>
      </button>
      <Button variant="primary" className="shrink-0 px-4" onClick={() => focus.start({ blockId: next.id, pomodoros: next.planned_pomodoros })}>
        {next.status === "active" ? "Resume" : "Start"}
      </Button>
      {focus.dialog}
    </section>
  );
}

/**
 * "Day won" (§5.19): every block today is done. Confetti once per day on this device, the first
 * time the banner shows.
 */
function DayWon({ date, numbers }: { date: string; numbers: DayNumbers }) {
  useEffect(() => {
    const key = `foqus:day-won:${date}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Without storage the confetti would repeat on every visit, so skip it.
      return;
    }
    void celebrate("day");
  }, [date]);
  return (
    <section aria-label="Day won" className="animate-moment flex items-center gap-3 rounded-card border border-success/60 bg-surface px-3 py-2">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-lg font-bold text-bg">
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-heading text-success">Day won</p>
        <p className="text-caption text-text-muted">
          Every block done · {numbers.done} {numbers.done === 1 ? "pomodoro" : "pomodoros"}
        </p>
      </div>
    </section>
  );
}
