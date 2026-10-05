"use client";

import { useMemo, useState } from "react";
import { updateSettings } from "@/repo";
import { FOCUS_LIMITS } from "@/lib/settings";
import type { Settings } from "@/types";
import { SettingsGroup, SettingsRow } from "@/components/ui/SettingsGroup";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";

/** Settings → Focus (§6.7). Every change is written immediately through `repo/`. */
export function FocusSettings({ settings }: { settings: Settings }) {
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => timeZoneOptions(settings.timezone), [settings.timezone]);

  const save = (patch: Parameters<typeof updateSettings>[0]) => {
    setError(null);
    updateSettings(patch).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "That change could not be saved.");
    });
  };

  return (
    <SettingsGroup title="Focus">
      <SettingsRow label="Pomodoros per block" hint={`Longest block: ${formatHours(settings.max_pomodoros_per_block * 30)}`}>
        <Stepper
          label="pomodoros per block"
          value={settings.max_pomodoros_per_block}
          {...FOCUS_LIMITS.max_pomodoros_per_block}
          onChange={(v) => save({ max_pomodoros_per_block: v })}
        />
      </SettingsRow>
      <SettingsRow label="Daily cap" hint="Pomodoros a day before a warning">
        <Stepper
          label="daily cap"
          value={settings.daily_pomodoro_cap}
          {...FOCUS_LIMITS.daily_pomodoro_cap}
          onChange={(v) => save({ daily_pomodoro_cap: v })}
        />
      </SettingsRow>
      <SettingsRow label="Buffer after a block" hint="Default for new blocks">
        <Stepper
          label="buffer after a block"
          value={settings.default_buffer_minutes}
          unit="min"
          {...FOCUS_LIMITS.default_buffer_minutes}
          onChange={(v) => save({ default_buffer_minutes: v })}
        />
      </SettingsRow>
      <SettingsRow label="Auto-start next phase" hint="Begin the break and next pomodoro without a tap">
        <Switch
          label="Auto-start next phase"
          checked={settings.auto_start_next_phase}
          onChange={(v) => save({ auto_start_next_phase: v })}
        />
      </SettingsRow>
      <SettingsRow label="Time zone" hint="Days and weeks follow this zone" htmlFor="timezone">
        <select
          id="timezone"
          value={settings.timezone}
          onChange={(e) => save({ timezone: e.target.value })}
          className="min-h-11 max-w-44 rounded-block border border-border bg-surface-raised px-2 text-body"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </SettingsRow>
      {error ? (
        <p role="alert" className="px-4 py-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </SettingsGroup>
  );
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The browser's list of zones, always including the current one (some engines omit "UTC"). */
function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["Asia/Jakarta", "UTC"];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}
