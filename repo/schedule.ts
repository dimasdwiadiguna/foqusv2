/** Settings → Schedule: availability and peak windows per weekday, personal blocks (§5.6). */
import { availabilityId, peakId } from "@/lib/ids";
import { checkWeekdays, checkWindow } from "@/lib/schedule";
import { cleanTitle } from "@/lib/actions";
import type { PersonalBlock, Weekday } from "@/types";
import { createRow, softDelete, updateRow } from "./rows";
import { writeTx } from "./tx";

type WindowKind = "availability" | "peak";

const table = (kind: WindowKind) => (kind === "availability" ? "availability_windows" : "peak_windows");
const idFor = (kind: WindowKind, weekday: Weekday) => (kind === "availability" ? availabilityId(weekday) : peakId(weekday));

export async function updateWindow(kind: WindowKind, weekday: Weekday, start: string, end: string): Promise<void> {
  checkWindow(start, end, kind === "availability" ? "Available hours" : "The peak window");
  await updateRow(table(kind), idFor(kind, weekday), { start_time: start, end_time: end });
}

/** "Copy to all days": every weekday gets this window. */
export async function copyWindowToAllDays(kind: WindowKind, start: string, end: string): Promise<void> {
  checkWindow(start, end, kind === "availability" ? "Available hours" : "The peak window");
  await writeTx([table(kind)], async () => {
    for (const d of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) await updateRow(table(kind), idFor(kind, d), { start_time: start, end_time: end });
  });
}

export interface PersonalBlockInput {
  label: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
  active: boolean;
}

function cleanPersonal(input: PersonalBlockInput) {
  checkWindow(input.start_time, input.end_time, "A personal block");
  return {
    label: cleanTitle(input.label),
    weekdays: checkWeekdays(input.weekdays),
    start_time: input.start_time,
    end_time: input.end_time,
    active: input.active,
  };
}

export async function createPersonalBlock(input: PersonalBlockInput): Promise<PersonalBlock> {
  return createRow("personal_blocks", cleanPersonal(input));
}

export async function updatePersonalBlock(id: string, input: PersonalBlockInput): Promise<PersonalBlock> {
  return updateRow("personal_blocks", id, cleanPersonal(input));
}

export async function deletePersonalBlock(id: string): Promise<void> {
  return softDelete("personal_blocks", id);
}
