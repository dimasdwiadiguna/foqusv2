/** Desktop keyboard shortcuts (§6.11): N quick add, F focus, T today, ← → change day, Space pause/resume in Focus. Pure. */
export type Shortcut = "quickAdd" | "focus" | "today" | "prevDay" | "nextDay" | "pauseResume";

export interface KeyInput {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  /** The focused element's tag name, and whether it is editable. */
  targetTag?: string;
  editable?: boolean;
  /** A sheet or dialog is open: shortcuts stay out of its way. */
  dialogOpen?: boolean;
}

export function shortcutFor(e: KeyInput, screen: "focus" | "other"): Shortcut | null {
  if (e.metaKey || e.ctrlKey || e.altKey || e.dialogOpen) return null;
  const tag = (e.targetTag ?? "").toUpperCase();
  if (e.editable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return null;
  if (screen === "focus") return e.key === " " || e.key === "Spacebar" ? "pauseResume" : null;
  switch (e.key) {
    case "n":
    case "N":
      return "quickAdd";
    case "f":
    case "F":
      return "focus";
    case "t":
    case "T":
      return "today";
    case "ArrowLeft":
      return "prevDay";
    case "ArrowRight":
      return "nextDay";
    default:
      return null;
  }
}
