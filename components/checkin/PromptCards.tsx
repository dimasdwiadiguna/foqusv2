"use client";

import Link from "next/link";
import { useState } from "react";
import { useBlocksForDays, useCheckin, useNow, useQuarterlyDue, useReview, useReviewDue, useSettings, useUnresolvedBlocks } from "@/data";
import { checkinPrompt, plannedBlocks } from "@/lib/checkin";
import { addDays, formatSeason, toLocalDate } from "@/lib/time";
import { UnresolvedCard } from "@/components/resolver/UnresolvedCard";

/**
 * Today's prompt cards (§6.7): unresolved blocks, the quarterly and weekly reviews, yesterday's open check-in, today's check-in. At
 * most two show; the rest collapse into "1 more". Due cards stick with the header under the Next
 * card (Today opens scrolled to now, so anything above the timeline would be out of sight).
 * Today's check-in is a quiet row above the timeline (`quiet`) until the last block ends, or 18:00
 * on a day without blocks; then it becomes a prominent card in the header.
 */
export function PromptCards({ date, quiet = false }: { date: string; quiet?: boolean }) {
  const settings = useSettings();
  const now = useNow(30_000);
  const unresolved = useUnresolvedBlocks();
  const yesterday = addDays(date, -1);
  const twoDays = useBlocksForDays(yesterday, date, settings?.timezone);
  const todayCheckin = useCheckin(date);
  const yesterdayCheckin = useCheckin(yesterday);
  const reviewDue = useReviewDue();
  const quarterlyDue = useQuarterlyDue();
  const review = useReview(reviewDue ?? undefined);
  const [expanded, setExpanded] = useState(false);
  if (!settings || !unresolved || !twoDays || todayCheckin === undefined || yesterdayCheckin === undefined) return null;
  const tz = settings.timezone;
  const blocks = twoDays.filter((b) => toLocalDate(b.starts_at, tz) === date);
  // Yesterday's check-in is only asked for when yesterday was planned or a check-in was started.
  const yesterdayPlanned = plannedBlocks(twoDays.filter((b) => toLocalDate(b.starts_at, tz) === yesterday)).length > 0;

  const prompt = checkinPrompt({ blocks, checkin: todayCheckin, now, timeZone: tz });
  if (quiet) {
    if (prompt !== "quiet") return null;
    return (
      <div className="mb-2">
        <CheckinCard href="/checkin" title="Today's check-in" label="Check in" />
      </div>
    );
  }
  const cards: { key: string; node: React.ReactNode }[] = [];
  if (unresolved.length > 0) cards.push({ key: "unresolved", node: <UnresolvedCard /> });
  if (quarterlyDue) {
    cards.push({
      key: "quarterly",
      node: <CheckinCard href={`/quarterly?season=${quarterlyDue}`} title={`Your ${formatSeason(quarterlyDue)} review is ready`} label="Review" prominent />,
    });
  }
  if (reviewDue) {
    cards.push({
      key: "review",
      node: <CheckinCard href={`/review?week=${reviewDue}`} title="Your weekly review is ready" label={review && review.step > 0 ? "Resume" : "Review"} prominent />,
    });
  }
  if (!yesterdayCheckin?.completed_at && (yesterdayPlanned || yesterdayCheckin)) {
    cards.push({
      key: "yesterday",
      node: (
        <CheckinCard
          href={`/checkin?date=${yesterday}`}
          title="Yesterday's check-in is open until midnight"
          label="Check in"
          prominent
        />
      ),
    });
  }
  if (prompt === "prominent") {
    cards.push({
      key: "today",
      node: <CheckinCard href="/checkin" title="Time to check in" label="Check in" prominent />,
    });
  }

  const visible = expanded ? cards : cards.slice(0, 2);
  const hidden = cards.length - visible.length;
  if (cards.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {visible.map((c) => (
        <div key={c.key}>{c.node}</div>
      ))}
      {hidden > 0 ? (
        <button type="button" onClick={() => setExpanded(true)} className="-my-1.5 min-h-11 self-start px-1 text-caption text-accent">
          {hidden} more
        </button>
      ) : null}
    </div>
  );
}

function CheckinCard({ href, title, label, prominent = false }: { href: string; title: string; label: string; prominent?: boolean }) {
  return (
    <section
      aria-label={title}
      className={`flex items-center gap-3 rounded-card border bg-surface py-1 pr-1 pl-3 ${prominent ? "border-accent/70" : "border-border"}`}
    >
      <p className={`min-w-0 flex-1 ${prominent ? "font-semibold" : "text-text-muted"}`}>{title}</p>
      <Link
        href={href}
        className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 ${prominent ? "bg-accent font-semibold text-bg" : "border border-border bg-surface-raised"}`}
      >
        {label}
      </Link>
    </section>
  );
}
