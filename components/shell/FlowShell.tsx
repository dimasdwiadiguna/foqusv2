"use client";

import { useDbReady } from "@/data";
import { ScreenSkeleton } from "./AppShell";

/** Full-screen flows (§6.7): no bottom navigation; the flow draws its own progress bar and buttons. */
export function FlowShell({ children }: { children: React.ReactNode }) {
  const db = useDbReady();
  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col bg-bg min-[481px]:border-x min-[481px]:border-border">
      {db.status === "ready" ? (
        children
      ) : db.status === "error" ? (
        <div role="alert" className="m-4 mt-16 rounded-card border border-danger bg-surface p-4">
          <p className="text-heading">Can&apos;t open your data</p>
          <p className="mt-1 text-text-muted">{db.message}</p>
        </div>
      ) : (
        <div className="p-4 pt-16">
          <ScreenSkeleton />
        </div>
      )}
    </div>
  );
}
