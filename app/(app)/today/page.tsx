"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToday, useWeekStart } from "@/data";
import { addDays, formatDayHeader, formatSeasonWeek } from "@/lib/time";
import Link from "next/link";
import { QuickAddButton } from "@/components/actions/QuickAddButton";
import { DailyBrief } from "@/components/coach/DailyBrief";
import { SettingsIcon } from "@/components/shell/icons";
import { useIsDesktop } from "@/components/shell/useIsDesktop";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { NextCard } from "@/components/timeline/NextCard";
import { PromptCards } from "@/components/checkin/PromptCards";
import { StreakBadges } from "@/components/checkin/StreakBadges";
import { TimelineBoard } from "@/components/timeline/TimelineBoard";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

export default function TodayPage() {
  const today = useToday();
  const weekStart = useWeekStart();
  const router = useRouter();
  const [trayOpen, setTrayOpen] = useState(false);
  const desktop = useIsDesktop();
  if (!today) return <ScreenSkeleton />;
  const timeline = (
    <TimelineBoard
      date={today}
      weekStart={weekStart}
      trayOpen={trayOpen}
      onTrayOpenChange={setTrayOpen}
      onSwipeDay={(d) => router.push(`/plan?date=${addDays(today, d)}`)}
    />
  );

  return (
    <>
      <ScreenHeader
        actions={
          <>
            <StreakBadges />
            <Link href="/settings" aria-label="Settings" className="flex size-11 items-center justify-center text-text-muted">
              <SettingsIcon className="size-6" />
            </Link>
            <QuickAddButton preset={{ thisWeek: true }} />
          </>
        }
        title={formatDayHeader(today)}
        subtitle={formatSeasonWeek(today)}
      >
        {desktop ? null : (
          <>
            <NextCard date={today} onOpenTray={() => setTrayOpen(true)} />
            <PromptCards date={today} />
          </>
        )}
      </ScreenHeader>
      {desktop ? (
        // Desktop (§6.11): the timeline on the left; the Next card, brief, and prompts on the right.
        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6">
          <div className="min-w-0">{timeline}</div>
          <aside aria-label="Today at a glance" className="sticky top-20 flex flex-col gap-3 self-start">
            <NextCard date={today} onOpenTray={() => setTrayOpen(true)} />
            <PromptCards date={today} />
            <PromptCards date={today} quiet />
            <DailyBrief className="px-1 text-caption" />
          </aside>
        </div>
      ) : (
        <>
          {/* The daily brief (§5.18) and the quiet check-in row sit above the timeline. */}
          <DailyBrief className="mb-2 px-1 text-caption" />
          <PromptCards date={today} quiet />
          {timeline}
        </>
      )}
    </>
  );
}
