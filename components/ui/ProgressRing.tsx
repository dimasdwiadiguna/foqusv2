/** A progress ring with its percentage as text, so the value is never color alone. */
export function ProgressRing({
  value,
  color,
  size = 40,
  label,
}: {
  /** 0–1 */
  value: number;
  color: string;
  size?: number;
  label: string;
}) {
  const stroke = size >= 56 ? 5 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(value * 100);
  return (
    <span role="img" aria-label={`${label}: ${pct}%`} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
        />
      </svg>
      <span aria-hidden="true" className={`absolute ${size >= 56 ? "text-caption" : "text-[11px] font-medium"}`}>
        {pct}%
      </span>
    </span>
  );
}
