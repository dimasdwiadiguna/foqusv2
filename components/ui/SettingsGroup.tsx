/** A titled group in a grouped settings list (§6.7 Settings). Rows are separated by hairlines. */
export function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `group-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="mb-2 px-1 text-caption uppercase tracking-wide text-text-muted">
        {title}
      </h2>
      <div className="divide-y divide-border rounded-card border border-border bg-surface">{children}</div>
    </section>
  );
}

export function SettingsRow({ label, hint, htmlFor, children }: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const Label = htmlFor ? "label" : "div";
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
      <Label htmlFor={htmlFor} className="min-w-0">
        <span className="block">{label}</span>
        {hint ? <span className="block text-caption text-text-muted">{hint}</span> : null}
      </Label>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
