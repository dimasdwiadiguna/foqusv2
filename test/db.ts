import { vi } from "vitest";
import { getDb } from "@/db";
import { ensureSeed } from "@/db/seed";

/** Fresh, seeded in-memory database with the clock frozen at `at`. */
export async function freshDb(at = "2026-10-05T00:00:00.000Z") {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(at));
  await getDb().delete();
  await getDb().open();
  await ensureSeed(getDb(), at);
}

export function setNow(at: string) {
  vi.setSystemTime(new Date(at));
}
