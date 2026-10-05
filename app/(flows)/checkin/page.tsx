"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useToday } from "@/data";
import { CheckinFlow } from "@/components/checkin/CheckinFlow";
import { PlacementProvider } from "@/components/timeline/PlacementProvider";

/** The daily check-in (§5.14): `/checkin` for today, `/checkin?date=` for yesterday or an edit. */
export default function CheckinPage() {
  return (
    <Suspense fallback={null}>
      <PlacementProvider>
        <Checkin />
      </PlacementProvider>
    </Suspense>
  );
}

function Checkin() {
  const params = useSearchParams();
  const today = useToday();
  const date = params.get("date") ?? today;
  const step = params.get("step");
  if (!date) return null;
  return <CheckinFlow key={date} date={date} startAt={step === "rate" || step === "note" || step === "tomorrow" ? step : undefined} />;
}
