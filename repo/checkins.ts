/** The daily check-in (§5.14). One row per date; the id is the date. */
import { getDb } from "@/db";
import { getSettings } from "@/data/queries";
import { isCheckinEditable, NOTE_MAX } from "@/lib/checkin";
import { todayIn } from "@/lib/time";
import type { DailyCheckin, DateString } from "@/types";
import { nowInstant } from "./clock";
import { createRow, updateRow } from "./rows";
import { refreshCoach } from "./reflection";
import { writeTx } from "./tx";

export interface CheckinInput {
  energy?: number | null;
  focus?: number | null;
  note?: string | null;
}

function rating(v: number | null | undefined, field: string): number | null | undefined {
  if (v === undefined || v === null) return v;
  if (!Number.isInteger(v) || v < 1 || v > 5) throw new Error(`${field} is rated 1 to 5.`);
  return v;
}

async function assertEditable(date: DateString): Promise<void> {
  const settings = await getSettings();
  if (!settings) throw new Error("Settings are missing.");
  if (!isCheckinEditable(date, todayIn(nowInstant(), settings.timezone))) {
    throw new Error("A check-in can only be changed until the end of the next day.");
  }
}

/** Save ratings and the note as the owner goes; creates the day's row on first save. */
export async function saveCheckin(date: DateString, input: CheckinInput): Promise<DailyCheckin> {
  await assertEditable(date);
  const patch: Partial<Pick<DailyCheckin, "energy" | "focus" | "note">> = {};
  if (input.energy !== undefined) patch.energy = rating(input.energy, "Energy");
  if (input.focus !== undefined) patch.focus = rating(input.focus, "Focus");
  if (input.note !== undefined) {
    const note = input.note?.trim() ?? "";
    if (note.length > NOTE_MAX) throw new Error(`The note is limited to ${NOTE_MAX} characters.`);
    patch.note = note || null;
  }
  return writeTx(["daily_checkins"], async () => {
    const t = getDb().t("daily_checkins");
    const current = await t.get(date);
    if (!current) return createRow("daily_checkins", { id: date, date, energy: null, focus: null, note: null, completed_at: null, ...patch });
    if (current.deleted_at) {
      // A row removed by an import comes back fresh rather than failing on the existing id.
      const revived: DailyCheckin = { ...current, energy: null, focus: null, note: null, completed_at: null, ...patch, deleted_at: null, updated_at: nowInstant(), _dirty: 1 };
      await t.put(revived);
      return revived;
    }
    return updateRow("daily_checkins", date, patch);
  });
}

/**
 * Complete the check-in. Resolves true the first time (the streak moves), false when an already
 * completed check-in is edited again.
 */
export async function completeCheckin(date: DateString, input: CheckinInput = {}): Promise<boolean> {
  const row = await saveCheckin(date, input);
  if (row.completed_at) return false;
  await updateRow("daily_checkins", date, { completed_at: nowInstant() });
  // The coach re-evaluates after each check-in (§5.18).
  await refreshCoach().catch(() => undefined);
  return true;
}
