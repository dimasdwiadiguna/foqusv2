"use client";

import Link from "next/link";
import { useCheckins, useStreaks, useToday } from "@/data";
import { isCheckinEditable } from "@/lib/checkin";
import { formatDayHeader } from "@/lib/time";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

/** Past check-ins (§5.14), browsable from Coach. */
export default function CheckinsPage() {
  const checkins = useCheckins();
  const streaks = useStreaks();
  const today = useToday();
  if (!checkins || !streaks || !today) return <ScreenSkeleton />;

  return (
    <>
      <ScreenHeader back={{ href: "/coach", label: "Coach" }} title="Check-ins" />
      <dl className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-card border border-border bg-surface px-3 py-2">
          <dt className="text-caption text-text-muted">Check-in streak</dt>
          <dd className="text-heading">
            {streaks.checkin.current} {streaks.checkin.current === 1 ? "day" : "days"}
          </dd>
        </div>
        <div className="rounded-card border border-border bg-surface px-3 py-2">
          <dt className="text-caption text-text-muted">Focus streak</dt>
          <dd className="text-heading">
            {streaks.focus.current} {streaks.focus.current === 1 ? "day" : "days"}
          </dd>
        </div>
      </dl>
      {checkins.length === 0 ? (
        <EmptyState title="No check-ins yet" body="Check in from Today at the end of the day. Each one shows up here." />
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {checkins.map((c) => {
            const editable = isCheckinEditable(c.date, today);
            return (
              <li key={c.id} className="flex items-start gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{formatDayHeader(c.date)}</p>
                  <p className="flex flex-wrap gap-x-4 text-caption text-text-muted">
                    <Rating label="Energy" value={c.energy} />
                    <Rating label="Focus" value={c.focus} />
                    {c.completed_at ? null : <span>Not finished</span>}
                  </p>
                  {c.note ? <p className="mt-1 whitespace-pre-wrap break-words">{c.note}</p> : null}
                </div>
                {editable ? (
                  <Link
                    href={`/checkin?date=${c.date}${c.completed_at ? "&step=rate" : ""}`}
                    className="-mr-1 flex min-h-11 shrink-0 items-center px-2 text-accent"
                    aria-label={`${c.completed_at ? "Edit" : "Finish"} the check-in for ${formatDayHeader(c.date)}`}
                  >
                    {c.completed_at ? "Edit" : "Finish"}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Rating({ label, value }: { label: string; value: number | null }) {
  return (
    <span aria-label={`${label} ${value ?? "not rated"}${value ? " of 5" : ""}`}>
      {label}{" "}
      <span aria-hidden="true" className="tracking-tight text-accent">
        {value ? "●".repeat(value) : ""}
        <span className="text-border">{"●".repeat(5 - (value ?? 0))}</span>
      </span>
    </span>
  );
}
