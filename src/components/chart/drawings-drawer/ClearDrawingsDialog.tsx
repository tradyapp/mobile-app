"use client";

import { createPortal } from "react-dom";
import { Dialog, DialogButton } from "konsta/react";

interface ClearDrawingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ClearDrawingsDialog({
  isOpen,
  onClose,
  onConfirm,
}: ClearDrawingsDialogProps) {
  if (typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 pointer-events-none">
      <div className="pointer-events-auto">
        <Dialog
          backdrop
          opened={isOpen}
          onBackdropClick={(e) => {
            e?.stopPropagation?.();
            onClose();
          }}
          title="Clear Drawings"
          content="Are you sure you want to clear all drawings for this symbol?"
          buttons={
            <>
              <DialogButton
                onClick={(e) => {
                  e?.stopPropagation?.();
                  onClose();
                }}
              >
                Cancel
              </DialogButton>
              <DialogButton
                strong
                className="text-red-500"
                onClick={(e) => {
                  e?.stopPropagation?.();
                  onConfirm();
                }}
              >
                Clear All
              </DialogButton>
            </>
          }
        />
      </div>
    </div>,
    document.body,
  );
}
