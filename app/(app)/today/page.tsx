"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToday, useWeekStart } from "@/data";
import { addDays, formatDayHeader, formatSeasonWeek } from "@/lib/time";
import { QuickAddButton } from "@/components/actions/QuickAddButton";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { NextCard } from "@/components/timeline/NextCard";
import { TimelineBoard } from "@/components/timeline/TimelineBoard";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

export default function TodayPage() {
  const today = useToday();
  const weekStart = useWeekStart();
  const router = useRouter();
  const [trayOpen, setTrayOpen] = useState(false);
  if (!today) return <ScreenSkeleton />;

  return (
    <>
      <ScreenHeader actions={<QuickAddButton preset={{ thisWeek: true }} />} title={formatDayHeader(today)} subtitle={formatSeasonWeek(today)} />
      <NextCard date={today} onOpenTray={() => setTrayOpen(true)} />
      <TimelineBoard
        date={today}
        weekStart={weekStart}
        trayOpen={trayOpen}
        onTrayOpenChange={setTrayOpen}
        onSwipeDay={(d) => router.push(`/plan?date=${addDays(today, d)}`)}
      />
    </>
  );
}
