"use client";

import { useActiveGoals, useAreas, useMovesForGoal, useRow } from "@/data";
import { controlClass } from "@/components/ui/Field";

export interface Owner {
  goal_id: string | null;
  area_id: string | null;
}

export const ownerValue = (o: Owner) => (o.goal_id ? `goal:${o.goal_id}` : `area:${o.area_id}`);
export function parseOwner(value: string): Owner {
  const [kind, id] = [value.slice(0, value.indexOf(":")), value.slice(value.indexOf(":") + 1)];
  return kind === "goal" ? { goal_id: id, area_id: null } : { goal_id: null, area_id: id };
}

/**
 * Goal or area, as one native picker (fast on iPhone). Active goals in rank order, then live areas.
 * The current owner is always listed, even if it is closed or archived.
 */
export function OwnerSelect({
  id,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: Owner;
  onChange: (o: Owner) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const goals = useActiveGoals() ?? [];
  const areas = useAreas() ?? [];
  const currentGoal = useRow("goals", value.goal_id ?? "");
  const currentArea = useRow("areas", value.area_id ?? "");
  const goalOptions = currentGoal && !goals.some((g) => g.id === currentGoal.id) ? [...goals, currentGoal] : goals;
  const areaOptions = currentArea && !areas.some((a) => a.id === currentArea.id) ? [...areas, currentArea] : areas;

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={ownerValue(value)}
      onChange={(e) => onChange(parseOwner(e.target.value))}
      className={className ?? `${controlClass} min-h-11`}
    >
      {goalOptions.length > 0 ? (
        <optgroup label="Goals">
          {goalOptions.map((g) => (
            <option key={g.id} value={`goal:${g.id}`}>
              {g.title}
            </option>
          ))}
        </optgroup>
      ) : null}
      <optgroup label="Areas">
        {areaOptions.map((a) => (
          <option key={a.id} value={`area:${a.id}`}>
            {a.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

/** Major move picker for a goal action. Renders nothing for area tasks or goals without moves. */
export function MoveSelect({
  id,
  goalId,
  value,
  onChange,
}: {
  id: string;
  goalId: string | null;
  value: string | null;
  onChange: (moveId: string | null) => void;
}) {
  const moves = useMovesForGoal(goalId) ?? [];
  if (!goalId || moves.length === 0) return null;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-caption text-text-muted">
        Major move
      </label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={`${controlClass} min-h-11`}>
        <option value="">No major move</option>
        {moves.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title}
          </option>
        ))}
      </select>
    </div>
  );
}
