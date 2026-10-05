"use client";

import { useState } from "react";
import { useRows, useRules, useWeekStart } from "@/data";
import { formatWeekdays } from "@/lib/recurrence";
import { formatShortDate } from "@/lib/time";
import type { RecurrenceRule } from "@/types";
import { RepeatIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { RuleSheet } from "./RuleSheet";

/**
 * Recurring actions of one goal or area (§5.5, §6.7: goal detail section 7, the area page, wizard
 * step 5): each rule with its days, size, and time; tap to edit or pause; add a new one.
 */
export function RuleList({ goalId, areaId, readOnly = false }: { goalId?: string; areaId?: string; readOnly?: boolean }) {
  const rules = (useRules() ?? []).filter((r) => (goalId ? r.goal_id === goalId : r.area_id === areaId));
  const weekStart = useWeekStart();
  const actions = useRows("actions") ?? [];
  const thisWeek = (ruleId: string) => actions.filter((a) => a.recurrence_rule_id === ruleId && a.planned_week === weekStart && a.status !== "dropped");
  const [editing, setEditing] = useState<RecurrenceRule | "new" | null>(null);

  return (
    <>
      {rules.length ? (
        <ul className="mb-2 divide-y divide-border rounded-card border border-border bg-surface">
          {rules.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setEditing(r)}
                className="flex min-h-12 w-full items-center gap-3 px-3 py-1.5 text-left"
                aria-label={`Edit recurring action ${r.title}`}
              >
                <RepeatIcon className={`size-4 shrink-0 ${r.active ? "text-accent" : "text-text-muted"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${r.active ? "" : "text-text-muted"}`}>{r.title}</span>
                  <span className="block truncate text-caption text-text-muted">
                    {formatWeekdays(r.weekdays)} · {r.pomodoros} {r.pomodoros === 1 ? "pomodoro" : "pomodoros"}
                    {r.preferred_start ? ` · ${r.preferred_start}` : ""}
                    {r.active ? (r.ends_on ? ` · until ${formatShortDate(r.ends_on)}` : "") : " · paused"}
                  </span>
                  {thisWeek(r.id).length ? (
                    <span className="block text-caption text-text-muted">
                      This week: {thisWeek(r.id).filter((a) => a.status === "done").length} of {thisWeek(r.id).length} done
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-caption text-text-muted">Habits that come back every week, like a weekly review or a daily writing block.</p>
      )}
      {readOnly ? null : (
        <Button block onClick={() => setEditing("new")}>
          Add a recurring action
        </Button>
      )}
      <RuleSheet
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        rule={editing === "new" ? null : editing}
        open={editing !== null}
        defaultOwner={goalId ? { goal_id: goalId, area_id: null } : { goal_id: null, area_id: areaId ?? null }}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
