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
import { WeekBoard, WeekHeadings } from "@/components/timeline/WeekBoard";
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

/** Plan (§6.7): the week strip, a day timeline, and the tray. Arrows change week; swipe changes day. */
function Plan() {
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const [trayOpen, setTrayOpen] = useState(false);
  const desktop = useIsDesktop();
  if (!today) return <ScreenSkeleton />;
  const date = validDate(params.get("date")) ?? today;
  const go = (d: string) =>
    router.replace(`/plan?date=${d}`, { scroll: false });
  const { week, weeks } = seasonWeekNumber(date);

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
            <WeekStrip date={date} today={today} onSelect={go} />
            <CapacityMeter weekStart={startOfWeek(date)} />
          </>
        )}
      </ScreenHeader>
      <h2 className="sr-only">
        {desktop ? formatWeekRange(date) : formatDayHeader(date)}
      </h2>
      {desktop ? (
        <WeekBoard
          date={date}
          today={today}
          weekStart={startOfWeek(today)}
          planning={startOfWeek(date) === startOfWeek(today)}
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
