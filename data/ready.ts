"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/db";
import { ensureSeed } from "@/db/seed";

let opening: Promise<void> | null = null;

/** Open the database and seed it once per page load. */
function openOnce(): Promise<void> {
  opening ??= ensureSeed(getDb(), new Date().toISOString()).then(() => undefined);
  return opening;
}

export type DbState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/** Whether the local database is open and seeded. Screens render once this is ready. */
export function useDbReady(): DbState {
  const [state, setState] = useState<DbState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    openOnce().then(
      () => live && setState({ status: "ready" }),
      (err: unknown) => {
        opening = null;
        if (live) setState({ status: "error", message: describeOpenError(err) });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

function describeOpenError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "MissingAPIError" || name === "InvalidStateError") {
    return "This browser is not letting FOQUS store data. Private browsing can cause this.";
  }
  return "FOQUS could not open its local data.";
}
