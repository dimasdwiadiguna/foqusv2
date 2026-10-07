/**
 * The local database (IndexedDB via Dexie). Only `db/`, `repo/`, and `data/` may import this module;
 * components read through `data/` hooks and write through `repo/` (§3.2.1). ESLint enforces it.
 */
import Dexie, { type Table } from "dexie";
import type { TableName, Tables } from "@/types";
import { SCHEMA_V1, SCHEMA_V2 } from "./schema";

export const DB_NAME = "foqus";

export class FoqusDb extends Dexie {
  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    // Never edit a shipped version: changes go in a new one (CLAUDE.md, convention 9).
    this.version(2)
      .stores(SCHEMA_V2)
      .upgrade((tx) =>
        tx
          .table("actions")
          .toCollection()
          .modify((a: { session_pomodoros?: number | null }) => {
            if (a.session_pomodoros === undefined) a.session_pomodoros = null;
          }),
      );
  }

  /** A typed handle on one table. */
  t<N extends TableName>(name: N): Table<Tables[N], string> {
    return this.table(name);
  }
}

let instance: FoqusDb | null = null;

/** The app's database, created on first use so nothing touches IndexedDB during server rendering. */
export function getDb(): FoqusDb {
  instance ??= new FoqusDb();
  return instance;
}
