"use client";

import { useSettings } from "@/data";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { FocusSettings } from "@/components/settings/FocusSettings";
import { AreasSettings } from "@/components/settings/AreasSettings";
import { ScheduleSettings } from "@/components/settings/ScheduleSettings";
import { DataSettings } from "@/components/settings/DataSettings";
import { ReflectionSettings } from "@/components/settings/ReflectionSettings";

export default function SettingsPage() {
  const settings = useSettings();
  if (!settings) return <ScreenSkeleton />;

  return (
    <>
      <ScreenHeader title="Settings" />
      <ReflectionSettings />
      <ScheduleSettings />
      <FocusSettings settings={settings} />
      <AreasSettings />
      <DataSettings timeZone={settings.timezone} />
    </>
  );
}
