"use client";

import { useToday } from "@/data";
import { formatWeekRange, seasonWeekNumber } from "@/lib/time";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { QuickAddButton } from "@/components/actions/QuickAddButton";

export default function PlanPage() {
  const today = useToday();
  if (!today) return <ScreenSkeleton />;
  const { week, weeks } = seasonWeekNumber(today);

  return (
    <>
      <ScreenHeader actions={<QuickAddButton preset={{ thisWeek: true }} />} title="Plan" subtitle={`${formatWeekRange(today)} · Week ${week} of ${weeks}`} />
      <EmptyState title="Nothing planned this week" body="This week's blocks will appear here, day by day." />
    </>
  );
}
