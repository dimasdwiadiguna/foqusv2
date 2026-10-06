"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useToday } from "@/data";
import { seasonOfDate } from "@/lib/time";
import { GoalsList } from "@/components/goals/GoalsList";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { useIsDesktop } from "@/components/shell/useIsDesktop";
export default function GoalsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Goals />
    </Suspense>
  );
}

function Goals() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const desktop = useIsDesktop();
  const current = today ? seasonOfDate(today) : null;
  const season = params.get("season") ?? current;
  if (!today || !current || !season) return <ScreenSkeleton />;
  const list = <GoalsList season={season} current={current} onSeason={(id) => router.replace(`/goals?season=${id}`)} />;
  if (!desktop) return list;
  // Desktop (§6.11): the list on the left, goal detail on the right once a goal is chosen.
  return (
    <div className="grid grid-cols-[420px_minmax(0,1fr)] gap-6">
      <div className="min-w-0">{list}</div>
      <p className="mt-24 text-center text-text-muted">Choose a goal to see its plan.</p>
    </div>
  );
}

