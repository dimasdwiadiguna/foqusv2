"use client";

import Link from "next/link";
import { useAreas, useOpenCountsByArea } from "@/data";

/** Area chips under the goal list (§6.7): each opens its task list. The count is open tasks. */
export function AreaChips() {
  const areas = useAreas() ?? [];
  const counts = useOpenCountsByArea();
  return (
    <section aria-labelledby="areas-heading" className="mt-8">
      <h2 id="areas-heading" className="mb-2 text-caption uppercase tracking-wide text-text-muted">
        Areas
      </h2>
      <ul className="flex flex-wrap gap-2">
        {areas.map((a) => (
          <li key={a.id}>
            <Link
              href={`/goals/area?id=${encodeURIComponent(a.id)}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4"
            >
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: a.color }} />
              {a.name}
              <span className="text-caption text-text-muted">
                <span className="sr-only">, open tasks: </span>
                {counts?.get(a.id) ?? 0}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
