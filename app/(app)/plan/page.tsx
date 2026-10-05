"use client";

import { useToday } from "@/data";
import { formatWeekRange, seasonWeekNumber } from "@/lib/time";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

export default function PlanPage() {
  const today = useToday();
  if (!today) return <ScreenSkeleton />;
  const { week, weeks } = seasonWeekNumber(today);

  return (
    <>
      <ScreenHeader title="Plan" subtitle={`${formatWeekRange(today)} · Week ${week} of ${weeks}`} />
      <EmptyState title="Nothing planned this week" body="This week's blocks will appear here, day by day." />
    </>
  );
}
