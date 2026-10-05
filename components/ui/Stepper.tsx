"use client";

/** − value + with 44 pt targets. The label names what is being changed for screen readers. */
export function Stepper({ label, value, min, max, step = 1, unit, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const button =
    "flex size-11 items-center justify-center rounded-full bg-surface-raised text-heading disabled:text-text-faint disabled:opacity-60";
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <button type="button" className={button} aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - step)}>
        −
      </button>
      <output aria-live="polite" className="min-w-14 text-center">
        {value}
        {unit ? <span className="text-caption text-text-muted"> {unit}</span> : null}
      </output>
      <button type="button" className={button} aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + step)}>
        +
      </button>
    </div>
  );
}
