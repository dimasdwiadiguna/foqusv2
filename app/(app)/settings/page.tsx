"use client";

import { useSettings } from "@/data";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { FocusSettings } from "@/components/settings/FocusSettings";
import { AreasSettings } from "@/components/settings/AreasSettings";
import { ScheduleSettings } from "@/components/settings/ScheduleSettings";
import { DataSettings } from "@/components/settings/DataSettings";

export default function SettingsPage() {
  const settings = useSettings();
  if (!settings) return <ScreenSkeleton />;

  return (
    <>
      <ScreenHeader title="Settings" />
      <ScheduleSettings />
      <FocusSettings settings={settings} />
      <AreasSettings />
      <DataSettings timeZone={settings.timezone} />
    </>
  );
}
