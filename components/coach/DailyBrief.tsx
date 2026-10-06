"use client";

import { useBlocksForDays, useInsights, useSettings, useStrengths, useToday } from "@/data";
import { plannedBlocks } from "@/lib/checkin";
import { dailyBrief } from "@/lib/coach";
import { toLocalTime } from "@/lib/time";

/** The daily brief (§5.18), on Coach and Today. */
export function DailyBrief({ className = "" }: { className?: string }) {
  const settings = useSettings();
  const today = useToday();
  const blocks = useBlocksForDays(today, today, settings?.timezone);
  const strengths = useStrengths();
  const insights = useInsights();
  if (!settings || !blocks || !strengths || !insights) return null;
  const plan = plannedBlocks(blocks);
  const top = strengths[0];
  const text = dailyBrief({
    blocks: plan.length,
    pomodoros: plan.reduce((n, b) => n + b.planned_pomodoros, 0),
    firstAt: plan[0] ? toLocalTime(plan[0].starts_at, settings.timezone) : null,
    topGoal: top ? { title: top.goal.title, strength: top.strength } : null,
    topInsight: insights[0] ?? null,
  });
  return <p className={`text-text-muted ${className}`}>{text}</p>;
}
