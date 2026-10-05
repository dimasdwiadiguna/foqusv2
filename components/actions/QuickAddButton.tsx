"use client";

import { PlusIcon } from "@/components/shell/icons";
import { IconButton } from "@/components/ui/Button";
import { useQuickAdd, type QuickAddPreset } from "./QuickAdd";

/** The header "+" (§6.6). */
export function QuickAddButton({ preset }: { preset?: QuickAddPreset }) {
  const open = useQuickAdd();
  return (
    <IconButton label="Quick add" onClick={() => open(preset)} className="text-accent">
      <PlusIcon className="size-7" />
    </IconButton>
  );
}
