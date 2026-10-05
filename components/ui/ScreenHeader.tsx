export function ScreenHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-title">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-caption text-text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="-mr-2 flex shrink-0 items-center">{actions}</div> : null}
    </header>
  );
}
