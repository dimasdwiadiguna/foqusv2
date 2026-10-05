/**
 * The capacity meter (§5.12). Pure.
 *
 *   free_hours    = Σ over remaining days of free time, before FOQUS blocks
 *   planned_hours = Σ (block length + buffer) of scheduled and draft blocks still ahead
 *   load          = planned_hours ÷ free_hours
 */
import type { Block, DateString, Instant } from "@/types";
import { freeMinutes, type BusyEvent, type DayWindow, type FreeInput } from "./availability";
import { MINUTE } from "./intervals";
import { toLocalDate, weekdayOf } from "./time";
import type { Weekday } from "@/types";

export type CapacityBand = "room" | "full" | "over";

export interface Capacity {
  freeHours: number;
  plannedHours: number;
  /** planned ÷ free; Infinity when something is planned with no free time; 0 when neither. */
  load: number;
  band: CapacityBand;
  goalPomodoros: number;
  areaPomodoros: number;
}

export const CAPACITY_LABEL: Record<CapacityBand, string> = { room: "Room to spare", full: "Full week", over: "Overbooked" };

export function capacityBand(load: number): CapacityBand {
  if (load > 0.9) return "over";
  if (load >= 0.7) return "full";
  return "room";
}

type CapBlock = Pick<Block, "action_id" | "starts_at" | "ends_at" | "buffer_minutes" | "status" | "planned_pomodoros" | "deleted_at">;

export function capacity(input: {
  /** The week's remaining days (from today). */
  days: readonly DateString[];
  timeZone: string;
  now: Instant;
  windows: (weekday: Weekday) => { availability: DayWindow | undefined };
  personal: FreeInput["personal"];
  events: readonly BusyEvent[];
  blocks: readonly CapBlock[];
  goalActionIds: ReadonlySet<string>;
}): Capacity {
  const days = new Set(input.days);
  let free = 0;
  for (const d of input.days) {
    free += freeMinutes({ date: d, timeZone: input.timeZone, availability: input.windows(weekdayOf(d)).availability, personal: input.personal, events: input.events, blocks: [], now: input.now });
  }
  const nowMs = Date.parse(input.now);
  let planned = 0;
  let goalPomodoros = 0;
  let areaPomodoros = 0;
  for (const b of input.blocks) {
    if (b.deleted_at || (b.status !== "scheduled" && b.status !== "draft" && b.status !== "active")) continue;
    if (!days.has(toLocalDate(b.starts_at, input.timeZone)) || Date.parse(b.ends_at) <= nowMs) continue;
    planned += (Date.parse(b.ends_at) - Date.parse(b.starts_at)) / MINUTE + b.buffer_minutes;
    if (input.goalActionIds.has(b.action_id)) goalPomodoros += b.planned_pomodoros;
    else areaPomodoros += b.planned_pomodoros;
  }
  const load = free === 0 ? (planned > 0 ? Infinity : 0) : planned / free;
  const round = (m: number) => Math.round((m / 60) * 10) / 10;
  return { freeHours: round(free), plannedHours: round(planned), load, band: capacityBand(load), goalPomodoros, areaPomodoros };
}
