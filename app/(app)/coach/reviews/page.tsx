"use client";

import Link from "next/link";
import { useReviews, type ReviewSnapshot } from "@/data";
import { formatWeekRange } from "@/lib/time";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

/** Past weekly reviews (§5.15), each with its stored numbers. */
export default function ReviewsPage() {
  const reviews = useReviews();
  if (!reviews) return <ScreenSkeleton />;
  return (
    <>
      <ScreenHeader back={{ href: "/coach", label: "Coach" }} title="Past reviews" />
      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" body="The weekly review opens on Sunday. Each one you finish is kept here with its numbers." />
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {reviews.map((r) => {
            const s = r.stats as ReviewSnapshot | null;
            return (
              <li key={r.id}>
                <Link href={`/review?week=${r.week_start}`} className="flex min-h-12 items-center gap-3 px-3 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block">{formatWeekRange(r.week_start)}</span>
                    {s ? (
                      <span className="block text-caption text-text-muted">
                        {s.follow_through === null ? "—" : `${Math.round(s.follow_through * 100)}%`} follow-through · {s.completed} pomodoros
                      </span>
                    ) : null}
                  </span>
                  <span aria-hidden="true" className="text-text-muted">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
