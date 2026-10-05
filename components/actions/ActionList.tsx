"use client";

import { useState } from "react";
import { useCompletedByAction, useWeekStart } from "@/data";
import { reorderActions } from "@/repo";
import type { Action } from "@/types";
import { SortableItem, SortableList } from "@/components/ui/Sortable";
import { ActionRow } from "./ActionRow";
import { ActionSheet } from "./ActionSheet";

/**
 * Open actions, reorderable by long-press; done and dropped ones collapse underneath.
 * Tapping a row opens its edit sheet.
 */
export function ActionList({
  actions,
  readOnly = false,
  emptyText,
  subtitleFor,
  showClosed = true,
}: {
  actions: Action[];
  readOnly?: boolean;
  emptyText?: string;
  subtitleFor?: (a: Action) => string | undefined;
  showClosed?: boolean;
}) {
  const completed = useCompletedByAction();
  const weekStart = useWeekStart();
  const [editing, setEditing] = useState<Action | null>(null);
  const open = actions.filter((a) => a.status === "todo");
  const closed = actions.filter((a) => a.status !== "todo");

  const row = (a: Action, sortable?: Parameters<typeof ActionRow>[0]["sortable"]) => (
    <ActionRow
      action={a}
      completed={completed?.get(a.id) ?? 0}
      weekStart={weekStart}
      subtitle={subtitleFor?.(a)}
      onOpen={setEditing}
      sortable={sortable}
      readOnly={readOnly}
    />
  );

  return (
    <>
      {open.length === 0 && emptyText ? <p className="py-3 text-text-muted">{emptyText}</p> : null}
      <SortableList ids={open.map((a) => a.id)} onReorder={(ids) => void reorderActions(ids)} disabled={readOnly}>
        {open.map((a) =>
          readOnly ? (
            <li key={a.id} className="mb-1.5">
              {row(a)}
            </li>
          ) : (
            <SortableItem key={a.id} id={a.id} className="mb-1.5">
              {(s) => row(a, s)}
            </SortableItem>
          ),
        )}
      </SortableList>
      {showClosed && closed.length > 0 ? (
        <details className="mt-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-caption text-text-muted">
            Done and dropped ({closed.length})
          </summary>
          <ul>
            {closed.map((a) => (
              <li key={a.id} className="mb-1.5">
                {row(a)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <ActionSheet action={editing} readOnly={readOnly} onClose={() => setEditing(null)} />
    </>
  );
}
