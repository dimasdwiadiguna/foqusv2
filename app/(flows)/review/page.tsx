"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useReviewDue, useToday } from "@/data";
import { reviewWeekFor } from "@/lib/review";
import { ReviewFlow } from "@/components/review/ReviewFlow";
import { PlacementProvider } from "@/components/timeline/PlacementProvider";

/** The weekly review (§5.15): `/review` for the one due, `/review?week=` for a given week. */
export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <PlacementProvider>
        <Review />
      </PlacementProvider>
    </Suspense>
  );
}

function Review() {
  const params = useSearchParams();
  const today = useToday();
  const due = useReviewDue();
  const week = params.get("week") ?? (due === undefined || !today ? undefined : (due ?? reviewWeekFor(today)));
  if (!week) return null;
  return <ReviewFlow key={week} week={week} />;
}
