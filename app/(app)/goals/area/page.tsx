"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useActionsForArea, useRow } from "@/data";
import { ActionList } from "@/components/actions/ActionList";
import { QuickAddButton } from "@/components/actions/QuickAddButton";
import { useQuickAdd } from "@/components/actions/QuickAdd";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

export default function AreaPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Area />
    </Suspense>
  );
}

/** An area's task list (§6.7 Goals: tapping an area opens its task list). */
function Area() {
  const id = useSearchParams().get("id") ?? "";
  const area = useRow("areas", id);
  const actions = useActionsForArea(id);
  const quickAdd = useQuickAdd();

  if (area === undefined && actions === undefined) return <ScreenSkeleton />;
  if (!area) {
    return (
      <>
        <ScreenHeader back={{ href: "/goals", label: "Goals" }} title="Area" />
        <EmptyState title="Area not found" body="It may have been deleted on this device." />
      </>
    );
  }

  return (
    <>
      <ScreenHeader
        back={{ href: "/goals", label: "Goals" }}
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3.5 rounded-full" style={{ background: area.color }} />
            {area.name}
          </span>
        }
        subtitle={area.archived_at ? "Archived" : "Area tasks"}
        actions={<QuickAddButton preset={{ area_id: area.id }} />}
      />
      <ActionList actions={actions ?? []} emptyText="No open tasks in this area." />
      <Button block className="mt-2" onClick={() => quickAdd({ area_id: area.id })}>
        Add a task
      </Button>
    </>
  );
}
