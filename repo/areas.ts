import { getDb } from "@/db";
import { OTHER_AREA_ID } from "@/db/seed";
import { cleanAreaName, isPaletteColor } from "@/lib/areas";
import { nextOrder } from "@/lib/order";
import type { Area } from "@/types";
import { nowInstant } from "./clock";
import { createRow, updateRow } from "./rows";
import { liveWhere, writeTx } from "./tx";

function checkColor(color: string): string {
  if (!isPaletteColor(color)) throw new Error("Pick one of the eight area colors.");
  return color;
}

async function liveAreas(): Promise<Area[]> {
  return (await getDb().t("areas").toArray()).filter((a) => !a.deleted_at);
}

export async function createArea(name: string, color: string): Promise<Area> {
  const clean = cleanAreaName(name);
  checkColor(color);
  return writeTx(["areas"], async () => {
    const areas = await liveAreas();
    return createRow("areas", {
      name: clean,
      color,
      sort_order: nextOrder(areas.map((a) => a.sort_order)),
      is_default: false,
      archived_at: null,
    });
  });
}

export async function renameArea(id: string, name: string): Promise<Area> {
  return updateRow("areas", id, { name: cleanAreaName(name) });
}

export async function recolorArea(id: string, color: string): Promise<Area> {
  return updateRow("areas", id, { color: checkColor(color) });
}

/** Set sort orders to match `orderedIds` (all live areas, archived included or not). */
export async function reorderAreas(orderedIds: readonly string[]): Promise<void> {
  await writeTx(["areas"], async () => {
    for (const [i, id] of orderedIds.entries()) {
      const a = await getDb().t("areas").get(id);
      if (a && !a.deleted_at && a.sort_order !== i) await updateRow("areas", id, { sort_order: i });
    }
  });
}

/** Open (todo) actions that belong directly to the area. */
export async function openAreaActionCount(areaId: string): Promise<number> {
  return (await liveWhere("actions", "area_id", areaId)).filter((a) => a.status === "todo").length;
}

/**
 * Archive an area (§5.2). "Other" cannot be archived. If the area has open actions, `moveTo` must
 * name a live, unarchived area to move them to first; otherwise this throws.
 */
export async function archiveArea(id: string, moveTo?: string): Promise<void> {
  if (id === OTHER_AREA_ID) throw new Error("\"Other\" cannot be archived.");
  await writeTx(["areas", "actions"], async () => {
    const area = await getDb().t("areas").get(id);
    if (!area || area.deleted_at) throw new Error("That area no longer exists.");
    if (area.is_default) throw new Error("The default area cannot be archived.");
    const open = (await liveWhere("actions", "area_id", id)).filter((a) => a.status === "todo");
    if (open.length > 0) {
      const target = moveTo ? await getDb().t("areas").get(moveTo) : undefined;
      if (!target || target.deleted_at || target.archived_at || target.id === id) {
        throw new Error("Move this area's open tasks to another area first.");
      }
      for (const a of open) await updateRow("actions", a.id, { area_id: target.id });
    }
    await updateRow("areas", id, { archived_at: nowInstant() });
  });
}

export async function restoreArea(id: string): Promise<Area> {
  return updateRow("areas", id, { archived_at: null });
}
