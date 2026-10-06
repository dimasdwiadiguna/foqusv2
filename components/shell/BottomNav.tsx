"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveSession, useInsights, useNow, useReviewDue, useSettings, useUnresolvedBlocks } from "@/data";
import { formatClock, timerAt } from "@/lib/timer";
import { CoachIcon, FocusIcon, GoalsIcon, PlanIcon, TodayIcon } from "./icons";

/**
 * Bottom navigation (§6.6). Focus sits in the center, raised; while a session runs it pulses and
 * shows the time left. Today carries the count of unresolved blocks (§5.10); Coach shows a dot when
 * there are new insights or a review is due. Settings lives in the Today header (from Step 2.3).
 */
const TABS = [
  { href: "/today", label: "Today", Icon: TodayIcon },
  { href: "/plan", label: "Plan", Icon: PlanIcon },
  { href: "/focus", label: "Focus", Icon: FocusIcon, center: true },
  { href: "/goals", label: "Goals", Icon: GoalsIcon },
  { href: "/coach", label: "Coach", Icon: CoachIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const unresolved = useUnresolvedBlocks()?.length ?? 0;
  const running = useRunningLabel();
  const insights = useInsights()?.length ?? 0;
  const reviewDue = Boolean(useReviewDue());
  const coachDot = insights > 0 || reviewDue;

  return (
    <nav aria-label="Main" className="shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, Icon, ...rest }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const center = "center" in rest && rest.center;
          const badge = href === "/today" && unresolved > 0 ? unresolved : 0;
          return (
            <li key={href} className="flex justify-center">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={
                  center && running ? `Focus, ${running} left` : badge ? `${label}, ${badge} unresolved` : href === "/coach" && coachDot ? "Coach, something new" : undefined
                }
                className={`relative flex min-h-12 w-full flex-col items-center justify-center gap-0.5 pt-1 pb-0.5 text-[11px] font-medium ${
                  active ? "text-accent" : "text-text-muted"
                }`}
              >
                {center ? (
                  <span
                    className={`-mt-4 flex size-11 items-center justify-center rounded-full border-4 border-bg shadow-lg ${
                      running ? "animate-pulse bg-accent text-bg" : active ? "bg-accent text-bg" : "bg-surface-raised text-text"
                    }`}
                  >
                    {running ? <span className="text-[12px] font-semibold tabular-nums">{running}</span> : <Icon className="size-5" />}
                  </span>
                ) : (
                  <Icon className="size-5" />
                )}
                <span>{label}</span>
                {href === "/coach" && coachDot ? <span aria-hidden="true" className="absolute top-1.5 left-1/2 ml-2.5 size-2.5 rounded-full bg-accent" /> : null}
                {badge ? (
                  <span aria-hidden="true" className="absolute top-1 left-1/2 ml-2 min-w-5 rounded-full bg-danger px-1 text-center text-[11px] leading-5 font-bold text-bg">
                    {badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "18:42" while a session runs (focus or break), "Paused", "Done", or null with no session. */
function useRunningLabel(): string | null {
  const session = useActiveSession();
  const settings = useSettings();
  const now = useNow(session ? 1000 : 60_000);
  if (!session || !settings) return null;
  const t = timerAt(session, now, {
    focusMinutes: settings.focus_minutes,
    breakMinutes: settings.break_minutes,
    autoStart: settings.auto_start_next_phase,
  });
  if (t.phase === "paused") return "Paused";
  if (t.phase === "finished" || t.phase === "waiting") return "Done";
  if (t.phase === "ended") return null;
  return formatClock(t.secondsRemaining);
}
