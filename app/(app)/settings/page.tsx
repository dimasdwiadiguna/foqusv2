"use client";

import { useSettings } from "@/data";
import { ScreenSkeleton } from "@/components/shell/AppShell";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { FocusSettings } from "@/components/settings/FocusSettings";
import { AreasSettings } from "@/components/settings/AreasSettings";

export default function SettingsPage() {
  const settings = useSettings();
  if (!settings) return <ScreenSkeleton />;

  return (
    <>
      <ScreenHeader title="Settings" />
      <FocusSettings settings={settings} />
      <AreasSettings />
    </>
  );
}
