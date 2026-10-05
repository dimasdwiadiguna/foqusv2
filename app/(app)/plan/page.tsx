"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useToday } from "@/data";
import { addDays, formatDayHeader, formatWeekRange, parseDate, seasonWeekNumber, startOfWeek } from "@/lib/time";
import { QuickAddButton } from "@/components/actions/QuickAddButton";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { BackIcon } from "@/components/shell/icons";
import { TimelineBoard } from "@/components/timeline/TimelineBoard";
import { WeekStrip } from "@/components/timeline/WeekStrip";
import { IconButton } from "@/components/ui/Button";

export default function PlanPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Plan />
    </Suspense>
  );
}

function validDate(s: string | null): string | null {
  if (!s) return null;
  try {
    parseDate(s);
    return s;
  } catch {
    return null;
  }
}

/** Plan (§6.7): the week strip, a day timeline, and the tray. Arrows change week; swipe changes day. */
function Plan() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const [trayOpen, setTrayOpen] = useState(false);
  if (!today) return <ScreenSkeleton />;
  const date = validDate(params.get("date")) ?? today;
  const go = (d: string) => router.replace(`/plan?date=${d}`, { scroll: false });
  const { week, weeks } = seasonWeekNumber(date);

  return (
    <>
      <header className="mb-3 flex items-center justify-between gap-1">
        <div className="-ml-3 flex items-center">
          <IconButton label="Previous week" onClick={() => go(addDays(date, -7))}>
            <BackIcon className="size-6" />
          </IconButton>
          <div className="text-center">
            <h1 className="text-title">{formatWeekRange(date)}</h1>
            <p className="text-caption text-text-muted">
              Week {week} of {weeks}
              {startOfWeek(date) !== startOfWeek(today) ? (
                <>
                  {" · "}
                  <button type="button" className="text-accent" onClick={() => go(today)}>
                    This week
                  </button>
                </>
              ) : null}
            </p>
          </div>
          <IconButton label="Next week" onClick={() => go(addDays(date, 7))}>
            <BackIcon className="size-6 rotate-180" />
          </IconButton>
        </div>
        <QuickAddButton preset={{ thisWeek: true }} />
      </header>
      <WeekStrip date={date} today={today} onSelect={go} />
      <h2 className="sr-only">{formatDayHeader(date)}</h2>
      <TimelineBoard
        date={date}
        weekStart={startOfWeek(today)}
        trayOpen={trayOpen}
        onTrayOpenChange={setTrayOpen}
        onSwipeDay={(d) => go(addDays(date, d))}
      />
    </>
  );
}
