"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getActiveSessionRow, getBlocksForDays, getRow, useSettings } from "@/data";
import { blockSpan, occupies } from "@/lib/availability";
import { MINUTE, overlaps } from "@/lib/intervals";
import { addDays, todayIn, toLocalTime } from "@/lib/time";
import { startSession } from "@/repo";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";

export type FocusTarget = { blockId: string; pomodoros: number } | { actionId: string; pomodoros: number };

/**
 * Start a focus session (§5.9) and open the Focus screen. If starting now would run into another
 * scheduled block, ask whether to move that block back to the tray first. Render `dialog`.
 */
export function useStartFocus() {
  const router = useRouter();
  const settings = useSettings();
  const [ask, setAsk] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (target: FocusTarget) => {
    setError(null);
    if (await getActiveSessionRow()) {
      router.push("/focus");
      return;
    }
    if (!settings) return;
    const tz = settings.timezone;
    const now = Math.floor(Date.now() / MINUTE) * MINUTE;
    const span = { start: now, end: now + target.pomodoros * 30 * MINUTE };
    const today = todayIn(now, tz);
    const ownId = "blockId" in target ? target.blockId : null;
    const clashes = (await getBlocksForDays(addDays(today, -1), addDays(today, 1), tz)).filter(
      (b) => b.id !== ownId && occupies(b) && overlaps(span, blockSpan(b)),
    );
    if (clashes.some((b) => b.status !== "scheduled")) {
      setError("That time overlaps a block that is already running or done.");
      return;
    }
    if (clashes.length > 0) {
      const first = clashes[0];
      const title = (await getRow("actions", first.action_id))?.title ?? "another block";
      const more = clashes.length > 1 ? ` and ${clashes.length - 1} more` : "";
      const ok = await new Promise<boolean>((resolve) =>
        setAsk({ message: `This runs into ${title} at ${toLocalTime(first.starts_at, tz)}${more}. Move that block back to the tray?`, resolve }),
      );
      setAsk(null);
      if (!ok) return;
    }
    try {
      await startSession({ ...target, moveToTray: clashes.map((b) => b.id) });
      router.push("/focus");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The session could not start.");
    }
  };

  const dialog = (
    <>
      <ConfirmSheet
        open={ask !== null}
        title="Move that block?"
        body={ask?.message}
        confirmLabel="Move it"
        onConfirm={() => ask?.resolve(true)}
        onClose={() => ask?.resolve(false)}
      />
      {error ? (
        <p role="alert" className="mt-2 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </>
  );

  return { start, dialog };
}
