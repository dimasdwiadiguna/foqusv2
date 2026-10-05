"use client";

import { useState } from "react";
import { useAreas, useOpenCountsByArea } from "@/data";
import { AREA_PALETTE, colorName, suggestAreaColor } from "@/lib/areas";
import { OTHER_AREA_ID } from "@/lib/ids";
import { reorderSubset } from "@/lib/order";
import { archiveArea, createArea, recolorArea, renameArea, reorderAreas, restoreArea } from "@/repo";
import type { Area } from "@/types";
import { Button } from "@/components/ui/Button";
import { controlClass, TextField } from "@/components/ui/Field";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { Sheet } from "@/components/ui/Sheet";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/Sortable";

type Editing = { kind: "new" } | { kind: "edit"; area: Area } | { kind: "archive"; area: Area } | null;

/** Settings → Areas (§5.2, §6.7): create, rename, recolor, reorder, archive. */
export function AreasSettings() {
  const all = useAreas(true);
  const counts = useOpenCountsByArea();
  const [editing, setEditing] = useState<Editing>(null);
  if (!all) return null;
  const live = all.filter((a) => !a.archived_at);
  const archived = all.filter((a) => a.archived_at);

  return (
    <SettingsGroup title="Areas">
      <SortableList
        ids={live.map((a) => a.id)}
        onReorder={(ids) => void reorderAreas(reorderSubset(all.map((a) => a.id), ids))}
      >
        {live.map((a) => (
          <SortableItem key={a.id} id={a.id} className="border-b border-border last:border-b-0">
            {(s) => (
              <div className="flex min-h-12 items-center gap-1 pr-2 pl-1">
                <DragHandle label={`Reorder ${a.name}`} handleProps={s.handleProps} />
                <button
                  type="button"
                  onClick={() => setEditing({ kind: "edit", area: a })}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`Edit ${a.name}, ${colorName(a.color)}`}
                >
                  <span aria-hidden="true" className="size-4 shrink-0 rounded-full" style={{ background: a.color }} />
                  <span className="truncate">{a.name}</span>
                  <span className="text-caption text-text-muted">{counts?.get(a.id) ?? 0} open</span>
                </button>
                {a.id === OTHER_AREA_ID ? (
                  <span className="px-2 text-caption text-text-muted">Default</span>
                ) : (
                  <Button variant="ghost" className="px-3" onClick={() => setEditing({ kind: "archive", area: a })}>
                    Archive
                  </Button>
                )}
              </div>
            )}
          </SortableItem>
        ))}
      </SortableList>
      <div className="px-4 py-2">
        <Button block onClick={() => setEditing({ kind: "new" })}>
          Add an area
        </Button>
      </div>
      {archived.length ? (
        <details className="px-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-caption text-text-muted">Archived ({archived.length})</summary>
          <ul>
            {archived.map((a) => (
              <li key={a.id} className="flex min-h-12 items-center gap-3">
                <span aria-hidden="true" className="size-4 rounded-full opacity-60" style={{ background: a.color }} />
                <span className="flex-1 text-text-muted">{a.name}</span>
                <Button variant="ghost" onClick={() => void restoreArea(a.id)}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <AreaSheet editing={editing?.kind === "new" || editing?.kind === "edit" ? editing : null} suggested={suggestAreaColor(all)} onClose={() => setEditing(null)} />
      <ArchiveSheet
        area={editing?.kind === "archive" ? editing.area : null}
        openCount={editing?.kind === "archive" ? (counts?.get(editing.area.id) ?? 0) : 0}
        targets={live.filter((a) => editing?.kind === "archive" && a.id !== editing.area.id)}
        onClose={() => setEditing(null)}
      />
    </SettingsGroup>
  );
}

function AreaSheet({
  editing,
  suggested,
  onClose,
}: {
  editing: { kind: "new" } | { kind: "edit"; area: Area } | null;
  suggested: string;
  onClose: () => void;
}) {
  const key = editing ? (editing.kind === "new" ? "new" : editing.area.id) : "closed";
  return (
    <Sheet open={editing !== null} onClose={onClose} title={editing?.kind === "edit" ? "Edit area" : "New area"}>
      {editing ? <AreaForm key={key} area={editing.kind === "edit" ? editing.area : null} suggested={suggested} onClose={onClose} /> : null}
    </Sheet>
  );
}

function AreaForm({ area, suggested, onClose }: { area: Area | null; suggested: string; onClose: () => void }) {
  const [name, setName] = useState(area?.name ?? "");
  const [color, setColor] = useState(area?.color ?? suggested);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          if (area) {
            if (name !== area.name) await renameArea(area.id, name);
            if (color !== area.color) await recolorArea(area.id, color);
          } else {
            await createArea(name, color);
          }
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That could not be saved.");
        }
      }}
    >
      <TextField id="area-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} example="e.g. Teaching" />
      <fieldset className="mb-4">
        <legend className="mb-2 text-caption text-text-muted">Color</legend>
        <div className="grid grid-cols-4 gap-2">
          {AREA_PALETTE.map((c) => (
            <label key={c.hex} className="relative flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-3 has-checked:border-text">
              <input type="radio" name="area-color" value={c.hex} checked={color === c.hex} onChange={() => setColor(c.hex)} className="sr-only" />
              <span aria-hidden="true" className="size-4 shrink-0 rounded-full" style={{ background: c.hex }} />
              <span className="truncate text-caption">{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error ? (
        <p role="alert" className="mb-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" block>
        Save
      </Button>
    </form>
  );
}

function ArchiveSheet({ area, openCount, targets, onClose }: { area: Area | null; openCount: number; targets: Area[]; onClose: () => void }) {
  const [target, setTarget] = useState(OTHER_AREA_ID);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet
      open={area !== null}
      onClose={onClose}
      title={area ? `Archive ${area.name}?` : "Archive"}
      footer={
        <div className="flex gap-3">
          <Button block onClick={onClose}>
            Cancel
          </Button>
          <Button
            block
            variant="primary"
            onClick={async () => {
              if (!area) return;
              setError(null);
              try {
                await archiveArea(area.id, openCount > 0 ? target : undefined);
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : "That could not be archived.");
              }
            }}
          >
            {openCount > 0 ? "Move and archive" : "Archive"}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-text-muted">It disappears from pickers. Its history stays.</p>
      {openCount > 0 ? (
        <div className="mb-2">
          <label htmlFor="archive-target" className="mb-1 block">
            First, move its {openCount} open {openCount === 1 ? "task" : "tasks"} to
          </label>
          <select id="archive-target" value={target} onChange={(e) => setTarget(e.target.value)} className={`${controlClass} min-h-11`}>
            {targets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}
