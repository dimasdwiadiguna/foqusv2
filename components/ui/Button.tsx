import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-bg font-semibold",
  secondary: "bg-surface-raised text-text border border-border",
  ghost: "text-text-muted",
  danger: "bg-surface-raised text-danger border border-danger/50",
};

/** A text button with a 44 pt minimum target. */
export function Button({
  variant = "secondary",
  block = false,
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-body transition-opacity active:opacity-70 disabled:opacity-40 ${
        VARIANTS[variant]
      } ${block ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
}

/** A square icon button. `label` is read by screen readers. */
export function IconButton({
  label,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text active:bg-surface-raised ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
