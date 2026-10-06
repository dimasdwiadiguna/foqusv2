"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToday } from "@/data";
import { shortcutFor, type KeyInput } from "@/lib/shortcuts";
import { addDays } from "@/lib/time";
import { useQuickAdd } from "@/components/actions/QuickAdd";

/** The key event as `lib/shortcuts` sees it. */
export function keyInput(e: KeyboardEvent): KeyInput {
  const t = e.target as HTMLElement | null;
  // A read-only field (like the hidden input that primes the iPhone keyboard) is not being typed in.
  const readOnly = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement ? t.readOnly : false;
  return {
    key: e.key,
    metaKey: e.metaKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    targetTag: readOnly ? undefined : t?.tagName,
    editable: Boolean(t?.isContentEditable),
    dialogOpen: Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')),
  };
}

/** N quick add, F focus, T today, ← → previous or next day (§6.11). */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const today = useToday();
  const quickAdd = useQuickAdd();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = shortcutFor(keyInput(e), "other");
      if (!action) return;
      e.preventDefault();
      if (action === "quickAdd") quickAdd();
      else if (action === "focus") router.push("/focus");
      else if (action === "today") router.push("/today");
      else if (today && (pathname === "/plan" || pathname === "/today")) {
        const current = pathname === "/plan" ? (new URLSearchParams(window.location.search).get("date") ?? today) : today;
        const next = addDays(current, action === "prevDay" ? -1 : 1);
        if (pathname === "/plan") router.replace(`/plan?date=${next}`, { scroll: false });
        else router.push(`/plan?date=${next}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname, today, quickAdd]);
  return null;
}
