"use client";

import { useState } from "react";
import { useCompass, useStrengths } from "@/data";
import { saveCompass } from "@/repo";
import { Button } from "@/components/ui/Button";
import { controlClass, TextField } from "@/components/ui/Field";

/**
 * Compass (§5.18, §6.7): the vision in large text, values as pills, then each active goal with its
 * why. `editable` adds the Edit button that turns the page into a form.
 */
export function CompassView({ editable = true }: { editable?: boolean }) {
  const compass = useCompass();
  const goals = useStrengths();
  const [editing, setEditing] = useState(false);
  if (compass === undefined || !goals) return null;

  if (editing) return <CompassForm vision={compass?.vision ?? ""} values={compass?.values ?? []} onDone={() => setEditing(false)} />;
  return (
    <div>
      {compass?.vision ? (
        <p className="text-title leading-snug font-semibold whitespace-pre-wrap">{compass.vision}</p>
      ) : (
        <p className="text-text-muted">
          No vision written yet. Where do you want to be in three to five years, and what kind of person gets there?
        </p>
      )}
      {compass?.values.length ? (
        <ul aria-label="Values" className="mt-3 flex flex-wrap gap-2">
          {compass.values.map((v) => (
            <li key={v} className="rounded-full border border-accent/60 px-3 py-1 text-caption text-accent">
              {v}
            </li>
          ))}
        </ul>
      ) : null}
      {editable ? (
        <Button className="mt-4" onClick={() => setEditing(true)}>
          Edit
        </Button>
      ) : null}
      <h2 className="mt-6 mb-2 text-heading">Why each goal matters</h2>
      {goals.length === 0 ? <p className="text-text-muted">No active goals.</p> : null}
      <ul className="flex flex-col gap-2">
        {goals.map(({ goal }) => (
          <li key={goal.id} className="rounded-card border border-border bg-surface px-3 py-2">
            <p className="font-semibold">{goal.title}</p>
            <p className={goal.why ? "" : "text-text-muted"}>{goal.why ?? "No why written yet."}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompassForm({ vision: v0, values: vals0, onDone }: { vision: string; values: string[]; onDone: () => void }) {
  const [vision, setVision] = useState(v0);
  const [values, setValues] = useState(vals0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const t = draft.trim();
    if (t && !values.includes(t)) setValues([...values, t]);
    setDraft("");
  };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await saveCompass({ vision, values: draft.trim() ? [...values, draft.trim()] : values });
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That could not be saved.");
        }
      }}
    >
      <label htmlFor="compass-vision" className="mb-1 block text-caption text-text-muted">
        Vision
      </label>
      <textarea
        id="compass-vision"
        rows={6}
        value={vision}
        onChange={(e) => setVision(e.target.value)}
        className={`${controlClass} resize-none`}
        placeholder="In five years I…"
      />
      <p className="mt-1 mb-4 text-caption text-text-muted italic">Prompts: What does a good ordinary day look like? What work are you proud of? Who are you around?</p>
      <p className="mb-1 text-caption text-text-muted">Values</p>
      {values.length ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <li key={v}>
              <button type="button" onClick={() => setValues(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="min-h-11 rounded-full border border-border px-3">
                {v} ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            id="compass-value"
            label="Add a value"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            example="e.g. Craft, Family, Health"
          />
        </div>
        <Button className="mb-4" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mb-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button block onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" block>
          Save
        </Button>
      </div>
    </form>
  );
}
