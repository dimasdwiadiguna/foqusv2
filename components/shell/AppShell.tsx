"use client";

import { useDbReady } from "@/data";
import { BottomNav } from "./BottomNav";

/**
 * The app frame: a scrolling screen above the bottom navigation, sized with dynamic viewport units
 * so iOS toolbars never cover the nav (§6.10). On wide screens the phone-width column is centered
 * until the desktop layout arrives in Step 2.4 (§6.11).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const db = useDbReady();

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col bg-bg min-[481px]:border-x min-[481px]:border-border">
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-[max(env(safe-area-inset-top),16px)] pb-6">
        {db.status === "ready" ? (
          children
        ) : db.status === "error" ? (
          <div role="alert" className="mt-16 rounded-card border border-danger bg-surface p-4">
            <p className="text-heading">Can&apos;t open your data</p>
            <p className="mt-1 text-text-muted">{db.message}</p>
          </div>
        ) : (
          <ScreenSkeleton />
        )}
      </main>
      <BottomNav />
    </div>
  );
}

export function ScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-7 w-32 rounded-block bg-surface" />
      <div className="mt-2 h-4 w-48 rounded-block bg-surface" />
      <div className="mt-6 h-28 rounded-card bg-surface" />
    </div>
  );
}
