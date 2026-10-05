"use client";

import { useToday } from "@/data";
import { quarterOf } from "@/lib/time";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

export default function GoalsPage() {
  const today = useToday();
  if (!today) return <ScreenSkeleton />;
  const { year, quarter } = quarterOf(today);

  return (
    <>
      <ScreenHeader title="Goals" subtitle={`Q${quarter} ${year}`} />
      <EmptyState title="No goals yet" body="Your goals for this season will appear here." />
    </>
  );
}
