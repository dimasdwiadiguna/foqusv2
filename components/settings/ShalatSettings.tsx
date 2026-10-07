"use client";

import { useState } from "react";
import { usePrayerSettings, useToday } from "@/data";
import { PRAYER_LABEL, PRAYER_NAMES, prayerTimes } from "@/lib/prayer";
import { toLocalTime } from "@/lib/time";
import { updatePrayerSettings, type PrayerEdit } from "@/repo";
import type { PrayerName, PrayerSettings } from "@/types";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { SettingsGroup, SettingsRow } from "@/components/ui/SettingsGroup";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";

/**
 * Settings → Shalat (Stage 2 exit): shalat times as fixed spans on the timeline, kept free by the
 * draft and the slot picker, from a few minutes before adzan to a few after. Times follow the
 * Kemenag RI convention for the stored location, which stays on this device (and later, in the
 * owner's own account).
 */
export function ShalatSettings({ timeZone }: { timeZone: string }) {
  const prayer = usePrayerSettings();
  const today = useToday();
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [manual, setManual] = useState(false);
  if (!prayer || !today) return null;

  const save = async (edit: PrayerEdit) => {
    setError(null);
    try {
      await updatePrayerSettings(edit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be saved.");
    }
  };
  const hasLocation = prayer.latitude !== null && prayer.longitude !== null;
  const locate = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("This browser cannot share its location. Enter the coordinates instead.");
      setManual(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const latitude = Math.round(pos.coords.latitude * 10_000) / 10_000;
        const longitude = Math.round(pos.coords.longitude * 10_000) / 10_000;
        void save({ latitude, longitude, location_label: prayer.location_label ?? "My location", enabled: true });
      },
      () => {
        setLocating(false);
        setError("The location could not be read. Allow it for this app, or enter the coordinates.");
        setManual(true);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 3_600_000 },
    );
  };
  const times = hasLocation ? prayerTimes(today, prayer) : [];

  return (
    <SettingsGroup title="Shalat">
      <SettingsRow label="Keep shalat times free" hint={hasLocation ? (prayer.location_label ?? "Location set") : "Set your location first"}>
        <Switch label="Keep shalat times free" checked={prayer.enabled} onChange={(on) => void save({ enabled: on })} />
      </SettingsRow>
      <div className="flex flex-wrap gap-2 px-3 py-2">
        <Button onClick={locate} disabled={locating}>
          {locating ? "Locating…" : hasLocation ? "Update my location" : "Use my location"}
        </Button>
        <Button variant="ghost" onClick={() => setManual(!manual)}>
          {manual ? "Hide coordinates" : "Enter coordinates"}
        </Button>
      </div>
      {manual ? <Coordinates prayer={prayer} onSave={save} /> : null}
      {times.length ? (
        <p className="px-3 py-2 text-caption text-text-muted" aria-label="Today's adzan times">
          Today: {times.map((t) => `${t.label} ${toLocalTime(t.adzan, timeZone)}`).join(" · ")}
        </p>
      ) : null}
      <SettingsRow label="Before adzan" hint="Minutes kept free before">
        <Stepper label="minutes before adzan" value={prayer.before_minutes} min={0} max={60} unit="min" onChange={(v) => void save({ before_minutes: v })} />
      </SettingsRow>
      <SettingsRow label="After adzan" hint="Minutes kept free after">
        <Stepper label="minutes after adzan" value={prayer.after_minutes} min={0} max={120} step={5} unit="min" onChange={(v) => void save({ after_minutes: v })} />
      </SettingsRow>
      <SettingsRow label="Jumat" hint="On Fridays, in place of Dzuhur">
        <Switch label="Jumat" checked={prayer.jumat.enabled} onChange={(on) => void save({ jumat: { ...prayer.jumat, enabled: on } })} />
      </SettingsRow>
      {prayer.jumat.enabled ? (
        <SettingsRow label="Jumat, after adzan" hint={`${prayer.jumat.before_minutes} minutes before`}>
          <Stepper label="Jumat minutes after adzan" value={prayer.jumat.after_minutes} min={0} max={180} step={5} unit="min" onChange={(v) => void save({ jumat: { ...prayer.jumat, after_minutes: v } })} />
        </SettingsRow>
      ) : null}
      <details className="px-3 py-1">
        <summary className="flex min-h-11 cursor-pointer items-center text-caption text-text-muted">Each prayer (on/off, ± minutes to match your masjid)</summary>
        <ul className="pb-2">
          {PRAYER_NAMES.map((n) => (
            <PrayerRow key={n} name={n} prayer={prayer} onSave={save} />
          ))}
        </ul>
      </details>
      {error ? (
        <p role="alert" className="px-3 pb-3 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </SettingsGroup>
  );
}

function PrayerRow({ name, prayer, onSave }: { name: PrayerName; prayer: PrayerSettings; onSave: (e: PrayerEdit) => Promise<void> }) {
  const p = prayer.prayers[name];
  const set = (patch: Partial<typeof p>) => void onSave({ prayers: { ...prayer.prayers, [name]: { ...p, ...patch } } });
  return (
    <li className="flex min-h-12 items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <Switch label={PRAYER_LABEL[name]} checked={p.enabled} onChange={(on) => set({ enabled: on })} />
        {PRAYER_LABEL[name]}
      </span>
      <Stepper label={`${PRAYER_LABEL[name]} adjustment`} value={p.adjust_minutes} min={-30} max={30} unit="min" onChange={(v) => set({ adjust_minutes: v })} />
    </li>
  );
}

function Coordinates({ prayer, onSave }: { prayer: PrayerSettings; onSave: (e: PrayerEdit) => Promise<void> }) {
  const [lat, setLat] = useState(prayer.latitude?.toString() ?? "");
  const [lng, setLng] = useState(prayer.longitude?.toString() ?? "");
  const [label, setLabel] = useState(prayer.location_label ?? "");
  return (
    <form
      className="grid grid-cols-2 gap-2 px-3 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ latitude: lat === "" ? null : Number(lat), longitude: lng === "" ? null : Number(lng), location_label: label });
      }}
    >
      <label className="text-caption text-text-muted">
        Latitude
        <input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-6.2088" className={`${controlClass} mt-1 min-h-11`} />
      </label>
      <label className="text-caption text-text-muted">
        Longitude
        <input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="106.8456" className={`${controlClass} mt-1 min-h-11`} />
      </label>
      <label className="col-span-2 text-caption text-text-muted">
        Name
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Jakarta" className={`${controlClass} mt-1 min-h-11`} />
      </label>
      <Button type="submit" className="col-span-2">
        Save location
      </Button>
    </form>
  );
}
