/**
 * Read queries. Every read filters out soft-deleted rows (§3.2.3). Hooks in this folder wrap these
 * in live queries so screens update when the data changes.
 */
import { getDb } from "@/db";
import { SETTINGS_ID } from "@/db/seed";
import type { Settings, TableName, Tables } from "@/types";

export async function getRow<N extends TableName>(table: N, id: string): Promise<Tables[N] | undefined> {
  const row = await getDb().t(table).get(id);
  return row && !row.deleted_at ? row : undefined;
}

export async function getAllRows<N extends TableName>(table: N): Promise<Tables[N][]> {
  return getDb()
    .t(table)
    .filter((row) => !row.deleted_at)
    .toArray();
}

export function getSettings(): Promise<Settings | undefined> {
  return getRow("settings", SETTINGS_ID);
}
