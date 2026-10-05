/** Half-open time intervals `[start, end)` in epoch milliseconds. Pure. */

export interface Interval {
  start: number;
  end: number;
}

export const MINUTE = 60_000;

/** Sorted, non-empty, with touching or overlapping intervals merged. */
export function normalize(list: readonly Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** `base` minus every interval in `cut`. */
export function subtract(base: readonly Interval[], cut: readonly Interval[]): Interval[] {
  let result = normalize(base);
  for (const c of normalize(cut)) {
    const next: Interval[] = [];
    for (const r of result) {
      if (c.end <= r.start || c.start >= r.end) {
        next.push(r);
        continue;
      }
      if (c.start > r.start) next.push({ start: r.start, end: c.start });
      if (c.end < r.end) next.push({ start: c.end, end: r.end });
    }
    result = next;
  }
  return result;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True when `inner` lies entirely inside one interval of `outer`. */
export function within(inner: Interval, outer: readonly Interval[]): boolean {
  return normalize(outer).some((o) => inner.start >= o.start && inner.end <= o.end);
}

export function totalMinutes(list: readonly Interval[]): number {
  return normalize(list).reduce((n, i) => n + (i.end - i.start), 0) / MINUTE;
}

/** Round up to the next multiple of `minutes` (epoch-based; every real zone offset is a multiple of 5). */
export function ceilTo(ms: number, minutes: number): number {
  const step = minutes * MINUTE;
  return Math.ceil(ms / step) * step;
}

export function roundTo(ms: number, minutes: number): number {
  const step = minutes * MINUTE;
  return Math.round(ms / step) * step;
}
