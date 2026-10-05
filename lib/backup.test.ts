import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, buildBackup, parseBackup, validateBackup } from "./backup";

const T = "2026-10-06T00:00:00.000Z";
const meta = (id: string) => ({ id, created_at: T, updated_at: T, deleted_at: null });
const good = () =>
  buildBackup(
    {
      settings: [{ ...meta("settings"), _dirty: 1, timezone: "Asia/Jakarta", max_pomodoros_per_block: 4, daily_pomodoro_cap: 10, default_buffer_minutes: 10 }],
      actions: [{ ...meta("a1"), title: "A", estimate_pomodoros: 1, status: "todo" }],
    } as never,
    T,
  );

describe("backup files", () => {
  it("builds a file with every table and no _dirty flag", () => {
    const b = good();
    expect(Object.keys(b.tables).sort()).toEqual([...BACKUP_TABLES].sort());
    expect(b.tables.settings[0]).not.toHaveProperty("_dirty");
    expect(b.tables.goals).toEqual([]);
  });

  it("accepts a good file and counts its rows", () => {
    const r = parseBackup(JSON.stringify(good()));
    expect(r).toMatchObject({ ok: true, rows: 2 });
  });

  it("treats a missing table as empty", () => {
    const b = good() as unknown as { tables: Record<string, unknown> };
    delete b.tables.goals;
    expect(validateBackup(b)).toMatchObject({ ok: true });
  });

  it.each([
    ["not JSON", "{oops", /not valid JSON/],
    ["another app's file", JSON.stringify({ hello: 1 }), /not a FOQUS backup/],
    ["a future format", JSON.stringify({ ...good(), version: 2 }), /different version/],
    ["an unknown table", JSON.stringify({ ...good(), tables: { ...good().tables, nope: [] } }), /does not know: nope/],
    ["a row without an id", JSON.stringify({ ...good(), tables: { ...good().tables, actions: [{ title: "x" }] } }), /Row 1 of actions has no id/],
    ["a duplicate id", JSON.stringify({ ...good(), tables: { ...good().tables, actions: [good().tables.actions[0], good().tables.actions[0]] } }), /repeats the id a1/],
    ["bad dates", JSON.stringify({ ...good(), tables: { ...good().tables, actions: [{ ...good().tables.actions[0], updated_at: "soon" }] } }), /invalid dates/],
    ["a missing field", JSON.stringify({ ...good(), tables: { ...good().tables, actions: [{ ...meta("a2"), title: "x", status: "todo" }] } }), /missing estimate_pomodoros/],
  ])("rejects %s with a plain sentence", (_, text, message) => {
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });
});
