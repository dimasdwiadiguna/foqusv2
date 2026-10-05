import Link from "next/link";
import { BackIcon } from "@/components/shell/icons";

/**
 * The compact header on every tabbed screen. It sticks to the top of the scroll area (so "+" and
 * the other actions stay one tap away) and carries the top safe-area inset itself, so content never
 * shows above it under the notch. One row: optional back link or leading control, a title with an
 * optional one-line subtitle, then actions.
 */
export function ScreenHeader({
  title,
  subtitle,
  actions,
  back,
  leading,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  leading?: React.ReactNode;
  /** Sticks with the header, under its row (Today's Next card, Plan's week strip). */
  children?: React.ReactNode;
}) {
  return (
    <header
      data-screen-header=""
      className="sticky top-0 z-20 -mx-4 mb-2 border-b border-border/60 bg-bg px-4 pt-[max(env(safe-area-inset-top),4px)]"
    >
      <div className="flex min-h-12 items-center gap-1">
        {back ? (
          <Link href={back.href} aria-label={`Back to ${back.label}`} className="-ml-3 flex size-11 shrink-0 items-center justify-center text-text-muted">
            <BackIcon className="size-6" />
          </Link>
        ) : null}
        {leading}
        <div className="min-w-0 flex-1 py-1">
          <h1 className="line-clamp-2 text-[18px] leading-[22px] font-bold break-words">{title}</h1>
          {subtitle ? <p className="truncate text-caption leading-4 text-text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="-mr-2 flex shrink-0 items-center">{actions}</div> : null}
      </div>
      {children ? <div className="pb-2">{children}</div> : null}
    </header>
  );
}

/** Height covered by the sticky header inside a scroll container (0 when there is none). */
export function headerCover(container: HTMLElement): number {
  const header = container.querySelector<HTMLElement>("[data-screen-header]");
  if (!header) return 0;
  return Math.max(0, header.getBoundingClientRect().bottom - container.getBoundingClientRect().top);
}
