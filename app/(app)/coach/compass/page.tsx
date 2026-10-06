"use client";

import { CompassView } from "@/components/coach/CompassView";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

/** Compass (§6.7): a single reading page with an Edit button. */
export default function CompassPage() {
  return (
    <>
      <ScreenHeader back={{ href: "/coach", label: "Coach" }} title="Compass" />
      <CompassView />
    </>
  );
}
