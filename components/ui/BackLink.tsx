import Link from "next/link";
import { BackIcon } from "@/components/shell/icons";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 pr-3 text-text-muted">
      <BackIcon className="size-5" />
      {label}
    </Link>
  );
}
