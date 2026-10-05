"use client";

import { Suspense } from "react";
import { GoalWizard } from "@/components/wizard/GoalWizard";

export default function GoalSetupPage() {
  return (
    <Suspense fallback={null}>
      <GoalWizard />
    </Suspense>
  );
}
