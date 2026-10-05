"use client";

import { useUnresolvedBlocks } from "@/data";
import { Button } from "@/components/ui/Button";
import { useOpenResolver } from "./Resolver";

/** Today's prompt card for unresolved blocks (§5.10, §6.7 Today). */
export function UnresolvedCard() {
  const blocks = useUnresolvedBlocks();
  const open = useOpenResolver();
  if (!blocks || blocks.length === 0) return null;
  const n = blocks.length;
  return (
    <section aria-label="Unresolved blocks" className="mb-2 flex items-center gap-3 rounded-card border border-danger/60 bg-surface px-3 py-1.5">
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-danger font-bold text-bg">
        ?
      </span>
      <p className="min-w-0 flex-1">
        {n} {n === 1 ? "block needs" : "blocks need"} resolving
      </p>
      <Button onClick={open}>Resolve</Button>
    </section>
  );
}
