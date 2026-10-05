"use client";

import { useState } from "react";
import { useSeasons } from "@/data";
import { formatSeason, shiftSeason } from "@/lib/time";
import { ChevronDownIcon } from "@/components/shell/icons";
import { Sheet } from "@/components/ui/Sheet";

/**
 * Season picker (§6.7 Goals): seasons that exist, plus the current and next one. Past seasons are
 * read-only. Seasons are only created when a goal is first planned in them.
 */
export function SeasonSelector({ value, current, onChange }: { value: string; current: string; onChange: (id: string) => void }) {
  const seasons = useSeasons() ?? [];
  const [open, setOpen] = useState(false);
  const ids = [...new Set([...seasons.map((s) => s.id), current, shiftSeason(current, 1), value])].sort();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-text-muted"
        aria-label={`Season: ${formatSeason(value)}. Change season`}
      >
        {formatSeason(value)}
        <ChevronDownIcon className="size-4" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Season">
        <ul className="divide-y divide-border">
          {ids.map((id) => (
            <li key={id}>
              <button
                type="button"
                aria-current={id === value ? "true" : undefined}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className="flex min-h-12 w-full items-center justify-between text-left"
              >
                <span className={id === value ? "font-semibold text-accent" : ""}>{formatSeason(id)}</span>
                <span className="text-caption text-text-muted">
                  {id === current ? "Current" : id < current ? "Past · read-only" : "Upcoming"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
