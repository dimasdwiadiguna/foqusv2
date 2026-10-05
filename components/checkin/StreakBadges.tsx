"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStreaks } from "@/data";
import { CheckCircleIcon, FlameIcon } from "@/components/shell/icons";

/**
 * The streaks in the Today header (§5.19, §6.7): check-in days and focus days. A number that went
 * up since it was last shown rolls up. Tapping opens the check-in history.
 */
export function StreakBadges() {
  const streaks = useStreaks();
  if (!streaks) return null;
  const c = streaks.checkin.current;
  const f = streaks.focus.current;
  return (
    <Link
      href="/settings/checkins"
      aria-label={`Check-in streak ${c} ${c === 1 ? "day" : "days"}, focus streak ${f} ${f === 1 ? "day" : "days"}. Open check-ins`}
      className="flex min-h-11 items-center gap-2 px-1 text-caption font-semibold"
    >
      <span className={`flex items-center gap-0.5 ${streaks.checkin.today ? "text-success" : "text-text-muted"}`}>
        <CheckCircleIcon className="size-4" />
        <RollingNumber id="checkin" value={c} />
      </span>
      <span className={`flex items-center gap-0.5 ${streaks.focus.today ? "text-accent" : "text-text-muted"}`}>
        <FlameIcon className="size-4" />
        <RollingNumber id="focus" value={f} />
      </span>
    </Link>
  );
}

/** A number that rolls up when it is higher than the last value shown on this device. */
export function RollingNumber({ id, value }: { id: string; value: number }) {
  const key = `foqus:streak-seen:${id}`;
  // The last value seen before this mount; a higher value now (or later) rolls up.
  const [from] = useState(() => {
    try {
      const seen = Number(localStorage.getItem(key) ?? NaN);
      return Number.isFinite(seen) ? seen : value;
    } catch {
      return value;
    }
  });
  const rolled = value > from;
  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Storage can be unavailable (private mode); the number simply does not roll.
    }
  }, [key, value]);
  return (
    <span className="inline-block overflow-hidden tabular-nums">
      <span key={value} className={`inline-block ${rolled ? "animate-roll" : ""}`}>
        {value}
      </span>
    </span>
  );
}
