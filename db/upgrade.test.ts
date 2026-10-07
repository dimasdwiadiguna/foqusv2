import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { FoqusDb } from "./index";
import { SCHEMA_V1 } from "./schema";
import { ensureSeed } from "./seed";

const NAME = "foqus-upgrade-test";
afterEach(async () => {
  await Dexie.delete(NAME);
});

describe("Dexie version 2 (Stage 2 exit)", () => {
  it("upgrades a version 1 database without losing rows, filling session_pomodoros and adding the new tables", async () => {
    // A device still on version 1, with one action.
    const v1 = new Dexie(NAME);
    v1.version(1).stores(SCHEMA_V1);
    await v1.open();
    const meta = { created_at: "2026-10-05T00:00:00Z", updated_at: "2026-10-05T00:00:00Z", deleted_at: null, _dirty: 1 };
    await v1.table("actions").add({ id: "a1", title: "Write", estimate_pomodoros: 6, status: "todo", goal_id: null, area_id: "area-other", ...meta });
    v1.close();

    const db = new FoqusDb(NAME);
    await db.open();
    expect(db.verno).toBe(2);
    expect(await db.t("actions").get("a1")).toMatchObject({ title: "Write", estimate_pomodoros: 6, session_pomodoros: null, updated_at: "2026-10-05T00:00:00Z" });
    expect(await db.t("habits").count()).toBe(0);
    await ensureSeed(db, "2026-10-07T00:00:00Z");
    expect(await db.t("prayer_settings").get("prayer")).toMatchObject({ enabled: false, before_minutes: 5, after_minutes: 10, ihtiyat_minutes: 2 });
    db.close();
  });
});
