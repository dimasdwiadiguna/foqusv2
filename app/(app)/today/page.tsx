"use client";

import { useToday } from "@/data";
import { formatDayHeader, formatSeasonWeek } from "@/lib/time";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { QuickAddButton } from "@/components/actions/QuickAddButton";

export default function TodayPage() {
  const today = useToday();
  if (!today) return <ScreenSkeleton />;

  return (
    <>
      <ScreenHeader actions={<QuickAddButton preset={{ thisWeek: true }} />} title={formatDayHeader(today)} subtitle={formatSeasonWeek(today)} />
      <EmptyState title="Nothing scheduled" body="Today's time blocks will appear here." />
    </>
  );
}
