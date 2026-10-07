/** Settings → Data: import a backup (Step 1.5). Export is a read and lives in `data/`. */
import { getDb } from "@/db";
import { BACKUP_TABLES, type Backup } from "@/lib/backup";
import type { Tables } from "@/types";
import { nowInstant } from "./clock";
import { ALL_TABLES, writeTx } from "./tx";

/**
 * Replace this device's data with a validated backup, atomically. Rows from the file are written
 * as they are, stamped as fresh changes so a later sync carries them; rows on the device that are
 * not in the file are soft-deleted (not removed), so the replacement can sync later too. Tables a
 * file does not have at all (made before they existed) are left as they are on the device.
 */
export async function importBackup(backup: Backup): Promise<void> {
  await writeTx(ALL_TABLES, async () => {
    const now = nowInstant();
    const absent = new Set(backup.absent ?? []);
    for (const name of BACKUP_TABLES) {
      if (absent.has(name)) continue;
      const table = getDb().t(name);
      const incoming = backup.tables[name];
      const keep = new Set(incoming.map((r) => r.id));
      for (const row of await table.toArray()) {
        if (!keep.has(row.id) && !row.deleted_at) await table.put({ ...row, deleted_at: now, updated_at: now, _dirty: 1 });
      }
      for (const raw of incoming) {
        // Rows from before Dexie version 2 lack the newer fields.
        const row = name === "actions" && !("session_pomodoros" in raw) ? { ...raw, session_pomodoros: null } : raw;
        await table.put({ ...row, updated_at: now, _dirty: 1 } as unknown as Tables[typeof name]);
      }
    }
  });
}
