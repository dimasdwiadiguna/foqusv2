"use client";

import { useDbReady } from "@/data";
import { QuickAddProvider } from "@/components/actions/QuickAdd";
import { PlacementProvider } from "@/components/timeline/PlacementProvider";
import { ResolverProvider } from "@/components/resolver/Resolver";
import { usePathname } from "next/navigation";
import { BottomNav, SideNav } from "./BottomNav";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { useIsDesktop } from "./useIsDesktop";
import { FirstRunGate } from "@/components/setup/FirstRunGate";

/**
 * The app frame: a scrolling screen above the bottom navigation, sized with dynamic viewport units
 * so iOS toolbars never cover the nav (§6.10). At 1024 px and wider, a left sidebar replaces the
 * bottom navigation and the keyboard shortcuts are on (§6.11); in between, the phone-width column
 * is centered.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const db = useDbReady();
  const desktop = useIsDesktop();
  const pathname = usePathname();
  // On desktop (§6.11) Plan, Today, and Goals use the full width; other screens keep a readable column.
  const wide = WIDE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <div
      className={
        desktop
          ? "flex h-dvh bg-bg"
          : "mx-auto flex h-dvh max-w-[480px] flex-col bg-bg min-[481px]:border-x min-[481px]:border-border"
      }
    >
      {desktop ? <SideNav /> : null}
      <main
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 [overflow-anchor:none] ${desktop ? "px-6" : ""}`}
      >
        <div className={desktop && !wide ? "mx-auto max-w-[720px]" : ""}>
          {db.status === "ready" ? (
            <QuickAddProvider>
              <PlacementProvider>
                <ResolverProvider>
                  <FirstRunGate>{children}</FirstRunGate>
                  {desktop ? <KeyboardShortcuts /> : null}
                </ResolverProvider>
              </PlacementProvider>
            </QuickAddProvider>
          ) : db.status === "error" ? (
            <div
              role="alert"
              className="mt-16 rounded-card border border-danger bg-surface p-4"
            >
              <p className="text-heading">Can&apos;t open your data</p>
              <p className="mt-1 text-text-muted">{db.message}</p>
            </div>
          ) : (
            <ScreenSkeleton />
          )}
        </div>
      </main>
      {desktop ? null : <BottomNav />}
    </div>
  );
}

const WIDE = ["/plan", "/today", "/goals"];

export function ScreenSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="animate-pulse pt-[max(env(safe-area-inset-top),16px)]"
    >
      <div className="h-7 w-32 rounded-block bg-surface" />
      <div className="mt-2 h-4 w-48 rounded-block bg-surface" />
      <div className="mt-6 h-28 rounded-card bg-surface" />
    </div>
  );
}
