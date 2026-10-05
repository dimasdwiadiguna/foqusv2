"use client";

import { useAreas, useBlocksForDays, useNow, useRows, useSettings } from "@/data";
import { toLocalTime } from "@/lib/time";
import { PomodoroDots } from "@/components/ui/PomodoroDots";
import { Button } from "@/components/ui/Button";
import { usePlacement } from "./PlacementProvider";

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
  if (!settings || !blocks) return <div className="mb-4 h-28 animate-pulse rounded-card bg-surface" />;

  const next = blocks.find((b) => (b.status === "scheduled" || b.status === "active") && Date.parse(b.ends_at) > now);
  if (!next) {
    return (
      <section aria-label="Next" className="mb-4 rounded-card border border-border bg-surface p-4">
        <p className="text-text-muted">Nothing scheduled. Pick something from your week.</p>
        <Button className="mt-3" onClick={onOpenTray}>
          Open the tray
        </Button>
      </section>
    );
  }
  const action = actions?.find((a) => a.id === next.action_id);
  const goal = action?.goal_id ? goals?.find((g) => g.id === action.goal_id) : undefined;
  const area = action?.area_id ? areas?.find((a) => a.id === action.area_id) : undefined;
  const tz = settings.timezone;
  return (
    <section aria-label="Next" className="mb-4 rounded-card border border-border bg-surface">
      <button type="button" onClick={() => openBlock(next)} className="block w-full p-4 text-left">
        <span className="block text-caption tracking-wide text-accent uppercase">
          {Date.parse(next.starts_at) <= now ? "Now" : "Next"} · {toLocalTime(next.starts_at, tz)} – {toLocalTime(next.ends_at, tz)}
        </span>
        <span className="mt-1 block text-heading">{action?.title ?? "Deleted action"}</span>
        <span className="mt-0.5 flex items-center gap-2 text-caption text-text-muted">
          <span className="truncate">{goal?.title ?? area?.name ?? ""}</span>
          <PomodoroDots completed={next.completed_pomodoros} total={next.planned_pomodoros} className="text-accent" />
        </span>
      </button>
    </section>
  );
}
