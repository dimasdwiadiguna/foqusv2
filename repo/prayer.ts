/** Shalat settings (Stage 2 exit). One row, id `prayer`. */
import { getDb } from "@/db";
import { DEFAULT_PRAYER } from "@/db/seed";
import { PRAYER_ID } from "@/lib/ids";
import { checkPrayer, type PrayerConfig } from "@/lib/prayer";
import type { PrayerSettings } from "@/types";
import { nowInstant } from "./clock";
import { createRow, updateRow } from "./rows";
import { writeTx } from "./tx";

export type PrayerEdit = Partial<PrayerConfig>;

/** Change shalat settings. Turning them on needs a location. */
export async function updatePrayerSettings(edit: PrayerEdit): Promise<PrayerSettings> {
  return writeTx(["prayer_settings"], async () => {
    const t = getDb().t("prayer_settings");
    const current = await t.get(PRAYER_ID);
    const base: PrayerConfig = current && !current.deleted_at ? current : DEFAULT_PRAYER;
    const next = checkPrayer({
      ...base,
      ...edit,
      prayers: { ...base.prayers, ...(edit.prayers ?? {}) },
      jumat: { ...base.jumat, ...(edit.jumat ?? {}) },
      location_label: edit.location_label !== undefined ? edit.location_label?.trim() || null : base.location_label,
    });
    const fields: PrayerConfig = {
      enabled: next.enabled,
      latitude: next.latitude,
      longitude: next.longitude,
      location_label: next.location_label,
      before_minutes: next.before_minutes,
      after_minutes: next.after_minutes,
      ihtiyat_minutes: next.ihtiyat_minutes,
      prayers: next.prayers,
      jumat: next.jumat,
    };
    if (!current) return createRow("prayer_settings", { id: PRAYER_ID, ...fields });
    if (current.deleted_at) {
      const revived = { ...current, ...fields, deleted_at: null, updated_at: nowInstant(), _dirty: 1 as const };
      await t.put(revived);
      return revived;
    }
    return updateRow("prayer_settings", PRAYER_ID, fields);
  });
}
