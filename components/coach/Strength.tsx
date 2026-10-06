"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStrengthHistory } from "@/data";
import { BAND_LABEL, type PlanStrength, type StrengthBand } from "@/lib/plan-strength";

const TEXT: Record<StrengthBand, string> = { weak: "text-danger", fair: "text-warning", strong: "text-success" };
const BAR: Record<StrengthBand, string> = { weak: "bg-danger", fair: "bg-warning", strong: "bg-success" };

/**
 * "Strong 78" (§5.17). When a goal's plan crosses into Strong, the badge pops once on this device
 * (§5.19 "badge animation"; a fade with reduce motion on).
 */
export function StrengthBadge({ goalId, strength, className = "" }: { goalId: string; strength: PlanStrength; className?: string }) {
  const [pop, setPop] = useState(false);
  useEffect(() => {
    const key = `foqus:band:${goalId}`;
    try {
      const last = localStorage.getItem(key);
      localStorage.setItem(key, strength.band);
      if (strength.band === "strong" && last && last !== "strong") {
        // Shown once, the moment the band changes; the state is UI-only.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPop(true);
      }
    } catch {
      // No storage: no animation.
    }
  }, [goalId, strength.band]);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold tabular-nums ${TEXT[strength.band]} ${pop ? "animate-moment" : ""} ${className}`}
      aria-label={`Plan strength ${strength.total}, ${BAND_LABEL[strength.band]}`}
    >
      {BAND_LABEL[strength.band]} {strength.total}
    </span>
  );
}

/** A horizontal score bar out of `max`. */
export function ScoreBar({ value, max, band }: { value: number; max: number; band: StrengthBand }) {
  return (
    <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-border">
      <span className={`block h-full ${BAR[band]}`} style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%` }} />
    </span>
  );
}

/** Goal detail section 3 (§6.7): score, band, four mini-bars, the top improvement, the trend line. */
export function StrengthCard({ goalId, planId, strength }: { goalId: string; planId: string; strength: PlanStrength }) {
  const history = useStrengthHistory(planId) ?? [];
  const parts: [string, number, string | null][] = [
    ["Goal", strength.completeness, null],
    ["Moves", strength.moves, null],
    ["Scheduled", strength.scheduled, strength.noSizedActions ? "Add sized actions" : null],
    ["Follow-through", strength.followThrough, strength.noFollowThroughData ? "No data yet" : null],
  ];
  const top = strength.improvements[0];
  return (
    <section aria-labelledby="strength" className="mb-3 rounded-card border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="strength" className="text-caption tracking-wide text-text-muted uppercase">
          Plan strength
        </h2>
        <StrengthBadge goalId={goalId} strength={strength} className="text-heading" />
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2">
        {parts.map(([label, v, hint]) => (
          <div key={label}>
            <dt className="truncate text-[12px] leading-4 text-text-muted">{label}</dt>
            <dd className="text-caption tabular-nums">
              {v}/25
              <ScoreBar value={v} max={25} band={strength.band} />
              {hint ? <span className="block text-[11px] leading-4 text-text-muted">{hint}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {history.length > 1 ? <TrendLine values={history.map((h) => h.total)} band={strength.band} /> : null}
      {top ? (
        <Link href={top.link} className="mt-2 flex min-h-11 items-center gap-2 text-accent">
          <span className="min-w-0 flex-1">{top.text}</span>
          <span aria-hidden="true">›</span>
        </Link>
      ) : (
        <p className="mt-2 text-caption text-success">Nothing to improve this week.</p>
      )}
    </section>
  );
}

/** Weekly snapshots as a small line, oldest left (§5.17). */
export function TrendLine({ values, band }: { values: number[]; band: StrengthBand }) {
  const last = values.slice(-12);
  const w = 120;
  const h = 28;
  const step = last.length > 1 ? w / (last.length - 1) : w;
  const points = last.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`).join(" ");
  return (
    <div className="mt-2 flex items-center gap-2">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Weekly plan strength: ${last.join(", ")}`} className={TEXT[band]}>
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="text-caption text-text-muted">{last.length} weeks</span>
    </div>
  );
}

