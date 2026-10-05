"use client";

import { useToday } from "@/data";
import { formatDayHeader, formatSeasonWeek } from "@/lib/time";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

export default function TodayPage() {
  const today = useToday();
  if (!today) return <ScreenSkeleton />;

  return (
    <>
      <ScreenHeader title={formatDayHeader(today)} subtitle={formatSeasonWeek(today)} />
      <EmptyState title="Nothing scheduled" body="Today's time blocks will appear here." />
    </>
  );
}
