"use client";

/** An on/off switch. State is shown by position and by the "On"/"Off" text, not by color alone. */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center gap-2"
    >
      <span className="w-7 text-right text-caption text-text-muted">{checked ? "On" : "Off"}</span>
      <span
        className={`relative h-7 w-12 rounded-full transition-colors ${checked ? "bg-accent" : "bg-surface-raised ring-1 ring-border"}`}
      >
        <span
          className={`absolute top-0.5 left-0 size-6 rounded-full bg-text shadow transition-transform ${checked ? "translate-x-5.5" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}
