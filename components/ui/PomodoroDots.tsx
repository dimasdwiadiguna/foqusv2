import { dots, dotsLabel } from "@/lib/actions";

/** §6.5: `●●○○` for 2 of 4; more than 8 collapses to `● 5/12`. */
export function PomodoroDots({
  completed,
  total,
  className = "",
  decorative = false,
}: {
  completed: number;
  total: number;
  className?: string;
  /** Hide from screen readers when nearby text already says the number. */
  decorative?: boolean;
}) {
  const d = dots(completed, total);
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": dotsLabel(completed, total) };
  if (d.kind === "count") {
    return (
      <span {...a11y} className={`inline-flex items-center gap-1 text-caption ${className}`}>
        <Dot filled /> {d.completed}/{d.total}
      </span>
    );
  }
  return (
    <span {...a11y} className={`inline-flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: d.total }, (_, i) => (
        <Dot key={i} filled={i < d.filled} />
      ))}
    </span>
  );
}

function Dot({ filled }: { filled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 rounded-full border border-current ${filled ? "bg-current" : "bg-transparent"}`}
    />
  );
}
