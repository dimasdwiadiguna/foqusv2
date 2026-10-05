/** Areas (§5.2) and their colors (§6.2). Pure. */
import type { Area, Goal } from "@/types";

export const AREA_PALETTE = [
  { name: "Blue", hex: "#5B8DEF" },
  { name: "Green", hex: "#3DDC97" },
  { name: "Violet", hex: "#B07CFF" },
  { name: "Pink", hex: "#FF7AA2" },
  { name: "Teal", hex: "#4DD0E1" },
  { name: "Yellow", hex: "#FFD166" },
  { name: "Coral", hex: "#FF8A65" },
  { name: "Grey", hex: "#9AA3B2" },
] as const;

/** The accent color, used by goals with no area (§5.2). */
export const ACCENT = "#FFB020";

export const MAX_AREA_NAME = 40;

export function isPaletteColor(hex: string): boolean {
  return AREA_PALETTE.some((c) => c.hex.toLowerCase() === hex.toLowerCase());
}

export function colorName(hex: string): string {
  return AREA_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? "Custom";
}

/** A goal inherits its area's color; a goal with no area uses the accent. */
export function goalColor(goal: Pick<Goal, "area_id">, areas: ReadonlyMap<string, Pick<Area, "color">>): string {
  return (goal.area_id && areas.get(goal.area_id)?.color) || ACCENT;
}

/** The first palette color not yet used by a live area, or the first color if all are taken. */
export function suggestAreaColor(areas: Pick<Area, "color" | "archived_at">[]): string {
  const used = new Set(areas.filter((a) => !a.archived_at).map((a) => a.color.toLowerCase()));
  return (AREA_PALETTE.find((c) => !used.has(c.hex.toLowerCase())) ?? AREA_PALETTE[0]).hex;
}

/** Trimmed name, or throws a plain sentence. */
export function cleanAreaName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw new Error("Give the area a name.");
  if (trimmed.length > MAX_AREA_NAME) throw new Error(`Keep the name under ${MAX_AREA_NAME} characters.`);
  return trimmed;
}
