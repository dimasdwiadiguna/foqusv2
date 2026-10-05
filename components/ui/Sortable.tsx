"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveItem } from "@/lib/order";

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/**
 * A vertical list reordered by long-press and drag on touch (§6.8), by dragging with a mouse, or
 * from the keyboard via each item's handle. A short touch or a scroll never starts a drag.
 */
export function SortableList({
  ids,
  onReorder,
  children,
  disabled = false,
}: {
  ids: string[];
  onReorder: (ids: string[]) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(moveItem(ids, String(active.id), String(over.id)));
  };

  if (disabled) return <ul>{children}</ul>;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "To reorder, press space or enter, use the arrow keys, then press space or enter again.",
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul>{children}</ul>
      </SortableContext>
    </DndContext>
  );
}

export interface SortableRenderProps {
  isDragging: boolean;
  /** Spread on a small handle button: keyboard reordering. */
  handleProps: React.HTMLAttributes<HTMLElement> & { ref: (el: HTMLElement | null) => void };
}

/** One row of a `SortableList`. Long-press anywhere on the row drags it. */
export function SortableItem({
  id,
  className = "",
  disabled = false,
  children,
}: {
  id: string;
  className?: string;
  disabled?: boolean;
  children: (props: SortableRenderProps) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const { onKeyDown, ...pointer } = listeners ?? {};
  return (
    <li
      ref={setNodeRef}
      {...(disabled ? {} : pointer)}
      className={`select-none [-webkit-touch-callout:none] ${isDragging ? "relative z-10 opacity-90 shadow-xl" : ""} ${className}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children({
        isDragging,
        handleProps: { ...attributes, onKeyDown, ref: setActivatorNodeRef } as SortableRenderProps["handleProps"],
      })}
    </li>
  );
}

/** A small grip that is the keyboard entry point for reordering. */
export function DragHandle({ label, handleProps }: { label: string; handleProps: SortableRenderProps["handleProps"] }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...handleProps}
      className="flex h-11 w-6 shrink-0 cursor-grab items-center justify-center text-text-muted"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true" fill="currentColor">
        {[2, 8, 14].flatMap((y) => [<circle key={`a${y}`} cx="2.5" cy={y} r="1.5" />, <circle key={`b${y}`} cx="7.5" cy={y} r="1.5" />])}
      </svg>
    </button>
  );
}
