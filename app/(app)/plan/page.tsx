"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useToday } from "@/data";
import {
  addDays,
  formatDayHeader,
  formatWeekRange,
  parseDate,
  seasonWeekNumber,
  startOfWeek,
} from "@/lib/time";
import { QuickAddButton } from "@/components/actions/QuickAddButton";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { BackIcon } from "@/components/shell/icons";
import { TimelineBoard } from "@/components/timeline/TimelineBoard";
import { WeekStrip } from "@/components/timeline/WeekStrip";
import { CapacityMeter } from "@/components/timeline/CapacityMeter";
import { DayHeadings, MultiDayBoard, WeekBoard, WeekHeadings } from "@/components/timeline/WeekBoard";
import { usePlanDays } from "@/components/timeline/usePlanDays";
import { useIsDesktop } from "@/components/shell/useIsDesktop";
import { IconButton } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

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

/**
 * Plan (§6.7): the week strip, the timeline, and the tray. On the phone it shows three days side by
 * side by default (owner feedback), or one; arrows change week; swipe moves by a day.
 */
function Plan() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const [trayOpen, setTrayOpen] = useState(false);
  const desktop = useIsDesktop();
  const [dayCount, setDayCount] = usePlanDays();
  if (!today) return <ScreenSkeleton />;
  const date = validDate(params.get("date")) ?? today;
  const go = (d: string) =>
    router.replace(`/plan?date=${d}`, { scroll: false });
  const { week, weeks } = seasonWeekNumber(date);
  // The phone shows the selected day and, in the three-day view, the two after it.
  const shown = dayCount === 3 ? [date, addDays(date, 1), addDays(date, 2)] : [date];

  return (
    <>
      <ScreenHeader
        leading={
          <IconButton
            label="Previous week"
            className="-ml-3"
            onClick={() => go(addDays(date, -7))}
          >
            <BackIcon className="size-6" />
          </IconButton>
        }
        title={formatWeekRange(date)}
        subtitle={
          <>
            Week {week} of {weeks}
            {startOfWeek(date) !== startOfWeek(today) ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="pointer-events-auto text-accent"
                  onClick={() => go(today)}
                >
                  This week
                </button>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <IconButton label="Next week" onClick={() => go(addDays(date, 7))}>
              <BackIcon className="size-6 rotate-180" />
            </IconButton>
            {desktop ? null : (
              <IconButton
                label={dayCount === 3 ? "Show one day" : "Show three days"}
                onClick={() => setDayCount(dayCount === 3 ? 1 : 3)}
                className="text-text-muted"
              >
                <span aria-hidden="true" className="flex h-5 items-stretch gap-0.5">
                  {Array.from({ length: dayCount === 3 ? 1 : 3 }, (_, i) => (
                    <span key={i} className={`rounded-sm border-2 border-current ${dayCount === 3 ? "w-4" : "w-1.5"}`} />
                  ))}
                </span>
              </IconButton>
            )}
            <QuickAddButton preset={{ thisWeek: true }} />
          </>
        }
      >
        {desktop ? (
          <>
            <CapacityMeter weekStart={startOfWeek(date)} />
            <div className="mt-2">
              <WeekHeadings date={date} today={today} />
            </div>
          </>
        ) : (
          <>
            <WeekStrip date={date} today={today} onSelect={go} shown={shown} />
            <CapacityMeter weekStart={startOfWeek(date)} />
            {dayCount === 3 ? (
              <div className="mt-1.5">
                <DayHeadings days={shown} today={today} counts={false} />
              </div>
            ) : null}
          </>
        )}
      </ScreenHeader>
      <h2 className="sr-only">
        {desktop ? formatWeekRange(date) : dayCount === 3 ? `${formatDayHeader(shown[0])} to ${formatDayHeader(shown[2])}` : formatDayHeader(date)}
      </h2>
      {desktop ? (
        <WeekBoard
          date={date}
          today={today}
          weekStart={startOfWeek(today)}
          planning={startOfWeek(date) === startOfWeek(today)}
        />
      ) : dayCount === 3 ? (
        <MultiDayBoard
          days={shown}
          today={today}
          weekStart={startOfWeek(today)}
          planning={startOfWeek(date) === startOfWeek(today)}
          tray="bottom"
          trayOpen={trayOpen}
          onTrayOpenChange={setTrayOpen}
          onSwipeDay={(d) => go(addDays(date, d))}
        />
      ) : (
        <TimelineBoard
          date={date}
          weekStart={startOfWeek(today)}
          trayOpen={trayOpen}
          onTrayOpenChange={setTrayOpen}
          onSwipeDay={(d) => go(addDays(date, d))}
          planning={startOfWeek(date) === startOfWeek(today)}
        />
      )}
    </>
  );
}
