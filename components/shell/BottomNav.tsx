"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveSession, useInsights, useNow, useQuarterlyDue, useReviewDue, useSettings, useUnresolvedBlocks } from "@/data";
import { formatClock, timerAt } from "@/lib/timer";
import { CoachIcon, FocusIcon, GoalsIcon, PlanIcon, SettingsIcon, TodayIcon } from "./icons";

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

function useNavState() {
  const pathname = usePathname();
  const unresolved = useUnresolvedBlocks()?.length ?? 0;
  const running = useRunningLabel();
  const insights = useInsights()?.length ?? 0;
  const weekly = useReviewDue();
  const quarterly = useQuarterlyDue();
  const coachDot = insights > 0 || Boolean(weekly) || Boolean(quarterly);
  return { pathname, unresolved, running, coachDot };
}

/**
 * The desktop sidebar (§6.11): the same destinations, with Focus as a button at the top and
 * Settings at the bottom.
 */
export function SideNav() {
  const { pathname, unresolved, running, coachDot } = useNavState();
  const item = (href: string, label: string, Icon: (p: { className?: string }) => React.ReactNode, extra?: React.ReactNode) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-full px-3 ${active ? "bg-surface-raised text-accent" : "text-text-muted hover:text-text"}`}
        >
          <Icon className="size-5" />
          <span className="flex-1">{label}</span>
          {extra}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Main" className="flex w-52 shrink-0 flex-col gap-4 border-r border-border bg-surface px-3 py-4">
      <Link
        href="/focus"
        aria-label={running ? `Focus, ${running} left` : "Focus"}
        className={`flex min-h-12 items-center justify-center gap-2 rounded-full font-semibold ${running ? "animate-pulse bg-accent text-bg" : "bg-accent text-bg"}`}
      >
        <FocusIcon className="size-5" />
        {running ? <span className="tabular-nums">{running}</span> : "Focus"}
      </Link>
      <ul className="flex flex-col gap-1">
        {item("/today", "Today", TodayIcon, unresolved ? <span className="min-w-5 rounded-full bg-danger px-1 text-center text-[11px] leading-5 font-bold text-bg" aria-label={`${unresolved} unresolved`}>{unresolved}</span> : null)}
        {item("/plan", "Plan", PlanIcon)}
        {item("/goals", "Goals", GoalsIcon)}
        {item("/coach", "Coach", CoachIcon, coachDot ? <span className="size-2.5 rounded-full bg-accent" aria-label="Something new" /> : null)}
      </ul>
      <ul className="mt-auto">{item("/settings", "Settings", SettingsIcon)}</ul>
      <p className="px-3 text-[12px] leading-4 text-text-muted">Keys: N add · F focus · T today · ← → day</p>
    </nav>
  );
}

export function BottomNav() {
  const { pathname, unresolved, running, coachDot } = useNavState();

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
