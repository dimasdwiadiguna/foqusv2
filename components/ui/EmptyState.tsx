/** A calm placeholder card for a screen or section with nothing in it yet (§6.9). */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-card border border-border bg-surface px-4 py-5 text-center">
      <h2 className="text-heading">{title}</h2>
      <p className="mx-auto mt-1 max-w-72 text-text-muted">{body}</p>
    </section>
  );
}
