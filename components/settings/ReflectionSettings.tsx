"use client";

import Link from "next/link";
import { useStreaks } from "@/data";
import { SettingsGroup } from "@/components/ui/SettingsGroup";

/** Settings → Reflection: the way to past check-ins until Coach exists (Step 2.3). */
export function ReflectionSettings() {
  const streaks = useStreaks();
  const n = streaks?.checkin.current ?? 0;
  return (
    <SettingsGroup title="Reflection">
      <Link href="/settings/checkins" className="flex min-h-12 items-center gap-3 px-3 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block">Check-ins</span>
          <span className="block text-caption text-text-muted">
            {n} {n === 1 ? "day" : "days"} in a row
          </span>
        </span>
        <span aria-hidden="true" className="text-text-muted">
          ›
        </span>
      </Link>
    </SettingsGroup>
  );
}
