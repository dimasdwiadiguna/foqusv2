/** Ordering helpers for drag-to-reorder lists. Pure. */

/** Move `activeId` to where `overId` is. Returns a new array; unknown ids leave it unchanged. */
export function moveItem<T extends string>(ids: readonly T[], activeId: T, overId: T): T[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}

/**
 * Apply a new order of a visible subset to the full ordering: the subset keeps the positions it
 * already occupied, filled in its new order; everything else stays put. Ids in `subsetOrder` that
 * are not in `all` are ignored.
 */
export function reorderSubset<T extends string>(all: readonly T[], subsetOrder: readonly T[]): T[] {
  const known = new Set(all);
  const subset = subsetOrder.filter((id) => known.has(id));
  const inSubset = new Set(subset);
  const result = [...all];
  let k = 0;
  for (let i = 0; i < result.length; i++) {
    if (inSubset.has(result[i])) result[i] = subset[k++];
  }
  return result;
}

/** The next sort order after the largest in a list (0 for an empty list). */
export function nextOrder(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values) + 1;
}
