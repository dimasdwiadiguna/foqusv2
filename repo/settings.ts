import { SETTINGS_ID } from "@/db/seed";
import { validateSettingsPatch, type SettingsPatch } from "@/lib/settings";
import type { Settings } from "@/types";
import { updateRow } from "./rows";

/** Change settings. Validates first; throws with a plain sentence if a value is not accepted. */
export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return updateRow("settings", SETTINGS_ID, validateSettingsPatch(patch));
}
