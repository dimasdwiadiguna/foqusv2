"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

export default function FocusPage() {
  return (
    <>
      <ScreenHeader title="Focus" />
      <EmptyState title="No session running" body="A running focus session and its timer will show here." />
    </>
  );
}
