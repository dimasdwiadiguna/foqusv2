import type { Instant } from "@/types";

/** The instant `repo/` stamps on writes. The one place outside UI code that reads the clock. */
export function nowInstant(): Instant {
  return new Date().toISOString();
}
