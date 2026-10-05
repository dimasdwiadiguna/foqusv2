export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-title">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-caption text-text-muted">{subtitle}</p> : null}
    </header>
  );
}
