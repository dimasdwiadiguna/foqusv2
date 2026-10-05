"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FocusIcon, GoalsIcon, PlanIcon, SettingsIcon, TodayIcon } from "./icons";

/**
 * Bottom navigation (§6.6). Until Step 2.3 the fifth slot is Settings; Coach replaces it then.
 * Focus sits in the center, raised.
 */
const TABS = [
  { href: "/today", label: "Today", Icon: TodayIcon },
  { href: "/plan", label: "Plan", Icon: PlanIcon },
  { href: "/focus", label: "Focus", Icon: FocusIcon, center: true },
  { href: "/goals", label: "Goals", Icon: GoalsIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, Icon, ...rest }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const center = "center" in rest && rest.center;
          return (
            <li key={href} className="flex justify-center">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-caption ${
                  active ? "text-accent" : "text-text-muted"
                }`}
              >
                {center ? (
                  <span
                    className={`-mt-5 flex size-12 items-center justify-center rounded-full border-4 border-bg shadow-lg ${
                      active ? "bg-accent text-bg" : "bg-surface-raised text-text"
                    }`}
                  >
                    <Icon className="size-6" />
                  </span>
                ) : (
                  <Icon className="size-6" />
                )}
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
