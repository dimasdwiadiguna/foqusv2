"use client";

import { useEffect, useRef, useState } from "react";
import { getBackup, useToday } from "@/data";
import { backupFileName, parseBackup, type Backup } from "@/lib/backup";
import { formatDayHeader, toLocalDate, toLocalTime } from "@/lib/time";
import { importBackup } from "@/repo";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { SettingsGroup } from "@/components/ui/SettingsGroup";

/** Settings → Data (Step 1.5): export, import, storage use. */
export function DataSettings({ timeZone }: { timeZone: string }) {
  const today = useToday();
  const file = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<{ used: number | null; persisted: boolean | null }>({ used: null, persisted: null });
  const [pending, setPending] = useState<{ backup: Backup; rows: number } | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refreshStorage = () => {
    if (typeof navigator === "undefined" || !navigator.storage) return;
    void Promise.all([navigator.storage.estimate?.().catch(() => undefined), navigator.storage.persisted?.().catch(() => null)]).then(([e, p]) =>
      setStorage({ used: e?.usage ?? null, persisted: p ?? null }),
    );
  };
  useEffect(refreshStorage, []);

  const exportNow = async () => {
    setMessage(null);
    const backup = await getBackup(new Date().toISOString());
    const name = backupFileName(today ?? toLocalDate(Date.now(), timeZone));
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: "application/json" });
    const asFile = new File([blob], name, { type: "application/json" });
    // On a phone, the share sheet is the reliable way to save a file ("Save to Files").
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.canShare?.({ files: [asFile] })) {
      try {
        await navigator.share({ files: [asFile], title: name });
        setMessage({ kind: "ok", text: "Backup ready to save." });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setMessage({ kind: "error", text: "The backup could not be shared." });
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setMessage({ kind: "ok", text: `Saved ${name}.` });
  };

  const pick = async (f: File | undefined) => {
    setMessage(null);
    if (!f) return;
    const result = parseBackup(await f.text());
    if (!result.ok) {
      setMessage({ kind: "error", text: `${result.error} Nothing was changed.` });
      return;
    }
    setPending({ backup: result.backup, rows: result.rows });
  };

  return (
    <SettingsGroup title="Data">
      <p className="px-4 py-3 text-text-muted">Until an account is connected, your data lives only on this device. Export a backup now and then.</p>
      <div className="flex gap-2 px-4 pb-3">
        <Button className="flex-1" onClick={() => void exportNow()}>
          Export backup
        </Button>
        <Button className="flex-1" onClick={() => file.current?.click()}>
          Import backup
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Backup file to import"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p className="px-4 py-3 text-caption text-text-muted">
        {storage.used !== null ? `Using ${formatBytes(storage.used)} on this device.` : "Storage use is not available in this browser."}{" "}
        {storage.persisted === true
          ? "The browser keeps it even when space runs low."
          : storage.persisted === false
            ? "The browser may clear it if space runs low; install the app to the home screen to keep it."
            : ""}
      </p>
      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} className={`px-4 pb-3 ${message.kind === "error" ? "text-danger" : "text-success"}`}>
          {message.text}
        </p>
      ) : null}
      <ConfirmSheet
        open={pending !== null}
        title="Replace everything on this device?"
        body={
          pending
            ? `This backup is from ${formatDayHeader(toLocalDate(pending.backup.exported_at, timeZone))}, ${toLocalTime(pending.backup.exported_at, timeZone)}, with ${pending.rows} rows. Everything on this device is replaced by it.`
            : undefined
        }
        confirmLabel="Replace"
        danger
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          const backup = pending.backup;
          setPending(null);
          try {
            await importBackup(backup);
            setMessage({ kind: "ok", text: "Backup imported." });
            refreshStorage();
          } catch {
            setMessage({ kind: "error", text: "The backup could not be imported. Nothing was changed." });
          }
        }}
      />
    </SettingsGroup>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
