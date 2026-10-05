import { getDb } from "@/db";
import { parseSeasonId, quarterBounds } from "@/lib/time";
import type { Season } from "@/types";
import { createRow } from "./rows";
import { writeTx } from "./tx";

/** Return the season with this id (`2026-Q4`), creating it on first need (§5.3). */
export async function ensureSeason(id: string): Promise<Season> {
  const { year, quarter } = parseSeasonId(id);
  return writeTx(["seasons"], async () => {
    const existing = await getDb().t("seasons").get(id);
    if (existing) return existing;
    const { startsOn, endsOn } = quarterBounds(year, quarter);
    return createRow("seasons", {
      id,
      year,
      quarter,
      starts_on: startsOn,
      ends_on: endsOn,
      theme: null,
      review_note: null,
      reviewed_at: null,
    });
  });
}
