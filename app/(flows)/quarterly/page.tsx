"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuarterlyDue, useToday } from "@/data";
import { seasonOfDate } from "@/lib/time";
import { QuarterlyFlow } from "@/components/quarterly/QuarterlyFlow";

/** The quarterly review (§5.16): `/quarterly` for the season due, `/quarterly?season=2026-Q4` for one season. */
export default function QuarterlyPage() {
  return (
    <Suspense fallback={null}>
      <Quarterly />
    </Suspense>
  );
}

function Quarterly() {
  const params = useSearchParams();
  const today = useToday();
  const due = useQuarterlyDue();
  const season = params.get("season") ?? (due === undefined || !today ? undefined : (due ?? seasonOfDate(today)));
  if (!season) return null;
  return <QuarterlyFlow key={season} season={season} />;
}
