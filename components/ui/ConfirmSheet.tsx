"use client";

import { Button } from "./Button";
import { Sheet } from "./Sheet";

/** A yes/no question in a sheet. */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button block onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button block variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {body ? <div className="text-text-muted">{body}</div> : null}
    </Sheet>
  );
}
