"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { OTHER_AREA_ID } from "@/lib/ids";
import { formatShortDate } from "@/lib/time";
import { useWeekStart } from "@/data";
import { addAction } from "@/repo";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { EstimateStepper } from "./EstimateStepper";
import { OwnerSelect, type Owner } from "./OwnerSelect";

export interface QuickAddPreset {
  goal_id?: string | null;
  area_id?: string | null;
  major_move_id?: string | null;
  /** Start with "This week" on. */
  thisWeek?: boolean;
}

const QuickAddContext = createContext<(preset?: QuickAddPreset) => void>(() => {});

/** Open quick add from anywhere (§6.6: the "+" in Today, Plan, and Goals). */
export function useQuickAdd() {
  return useContext(QuickAddContext);
}

/**
 * Quick add (§6.7): a sheet with the keyboard open, a title, and chips for goal or area, estimate,
 * due date, and "This week". "Add" closes; "Add another" keeps the chips and the keyboard.
 */
export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPreset] = useState<QuickAddPreset | null>(null);
  const [session, setSession] = useState(0);
  const keyboardProxy = useRef<HTMLInputElement>(null);

  const open = useCallback((p: QuickAddPreset = {}) => {
    // iOS only raises the keyboard for focus inside the tap's handler: focus a proxy input now,
    // then hand focus to the real field when the sheet mounts.
    keyboardProxy.current?.focus({ preventScroll: true });
    setSession((n) => n + 1);
    setPreset(p);
  }, []);

  return (
    <QuickAddContext.Provider value={open}>
      {children}
      <input
        ref={keyboardProxy}
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none fixed top-0 left-0 h-px w-px text-[16px] opacity-0"
        readOnly
      />
      <QuickAddSheet key={session} preset={preset} onClose={() => setPreset(null)} />
    </QuickAddContext.Provider>
  );
}

function QuickAddSheet({ preset, onClose }: { preset: QuickAddPreset | null; onClose: () => void }) {
  const weekStart = useWeekStart();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>(
    preset?.goal_id ? { goal_id: preset.goal_id, area_id: null } : { goal_id: null, area_id: preset?.area_id ?? OTHER_AREA_ID },
  );
  const [moveId] = useState(preset?.major_move_id ?? null);
  const [estimate, setEstimate] = useState(1);
  const [due, setDue] = useState("");
  const [thisWeek, setThisWeek] = useState(preset?.thisWeek ?? false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(0);

  const add = async (another: boolean) => {
    setError(null);
    const submitted = title;
    try {
      await addAction({
        title: submitted,
        goal_id: owner.goal_id,
        area_id: owner.area_id,
        major_move_id: owner.goal_id && owner.goal_id === preset?.goal_id ? moveId : null,
        estimate_pomodoros: estimate,
        due_on: due || null,
        planned_week: thisWeek ? (weekStart ?? null) : null,
      });
      if (another) {
        setTitle((t) => (t === submitted ? "" : t));
        setAdded((n) => n + 1);
        titleRef.current?.focus();
      } else {
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be added.");
      titleRef.current?.focus();
    }
  };

  const chip = "inline-flex min-h-11 items-center rounded-full border border-border bg-surface-raised px-3 text-caption";

  return (
    <Sheet
      open={preset !== null}
      onClose={onClose}
      title="Quick add"
      initialFocus={titleRef}
      footer={
        <div className="flex gap-3">
          <Button block onClick={() => void add(true)}>
            Add another
          </Button>
          <Button block variant="primary" onClick={() => void add(false)}>
            Add
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add(false);
        }}
      >
        <label htmlFor="quick-title" className="sr-only">
          Title
        </label>
        <input
          ref={titleRef}
          id="quick-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          enterKeyHint="done"
          autoComplete="off"
          className={`${controlClass} min-h-11`}
        />
        {error ? (
          <p role="alert" className="mt-2 text-caption text-danger">
            {error}
          </p>
        ) : null}
        {added > 0 ? (
          <p aria-live="polite" className="mt-2 text-caption text-success">
            Added {added}.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <OwnerSelect aria-label="Goal or area" value={owner} onChange={setOwner} className={`${chip} max-w-48 truncate`} />
          <span className={`${chip} px-1`}>
            <EstimateStepper value={estimate} onChange={setEstimate} compact />
          </span>
          <label className={`${chip} relative gap-1`}>
            <span>{due ? `Due ${formatShortDate(due)}` : "Due date"}</span>
            <input
              type="date"
              aria-label="Due date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="absolute inset-0 opacity-0"
            />
          </label>
          <button type="button" aria-pressed={thisWeek} onClick={() => setThisWeek((v) => !v)} className={`${chip} ${thisWeek ? "border-accent text-accent" : ""}`}>
            {thisWeek ? "✓ This week" : "This week"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
