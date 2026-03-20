'use client';

import { createPortal } from 'react-dom';
import { Dialog, DialogButton } from 'konsta/react';

interface OrionDeleteDialogsProps {
  isDeleteSelectionDialogOpen: boolean;
  onCloseDeleteSelectionDialog: () => void;
  onConfirmDeleteSelection: () => void;
  isDeleteStrategyDialogOpen: boolean;
  isDeletingStrategy: boolean;
  strategyName: string;
  deleteStrategyConfirmInput: string;
  deleteStrategyError: string | null;
  onDeleteStrategyConfirmInputChange: (value: string) => void;
  onCloseDeleteStrategyDialog: () => void;
  onConfirmDeleteStrategy: () => void;
}

export default function OrionDeleteDialogs({
  isDeleteSelectionDialogOpen,
  onCloseDeleteSelectionDialog,
  onConfirmDeleteSelection,
  isDeleteStrategyDialogOpen,
  isDeletingStrategy,
  strategyName,
  deleteStrategyConfirmInput,
  deleteStrategyError,
  onDeleteStrategyConfirmInputChange,
  onCloseDeleteStrategyDialog,
  onConfirmDeleteStrategy,
}: OrionDeleteDialogsProps) {
  return (
    <>
      {typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10040] pointer-events-none">
          <div className="pointer-events-auto">
            <Dialog
              backdrop
              opened={isDeleteSelectionDialogOpen}
              onBackdropClick={(event) => {
                event?.stopPropagation?.();
                onCloseDeleteSelectionDialog();
              }}
              title="Eliminar selección"
              content="Se eliminarán los nodos o conexiones seleccionadas. ¿Deseas continuar?"
              buttons={(
                <>
                  <DialogButton
                    onClick={(event) => {
                      event?.stopPropagation?.();
                      onCloseDeleteSelectionDialog();
                    }}
                  >
                    Cancelar
                  </DialogButton>
                  <DialogButton
                    strong
                    className="text-red-400"
                    onClick={(event) => {
                      event?.stopPropagation?.();
                      onConfirmDeleteSelection();
                    }}
                  >
                    Eliminar
                  </DialogButton>
                </>
              )}
            />
          </div>
        </div>,
        document.body
      )}

      {typeof window !== 'undefined' && isDeleteStrategyDialogOpen && createPortal(
        <div className="fixed inset-0 z-[10060] pointer-events-none">
          <div className="pointer-events-auto">
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              onClick={() => {
                if (isDeletingStrategy) return;
                onCloseDeleteStrategyDialog();
              }}
              aria-label="Close delete strategy dialog"
            />
            <div className="absolute left-1/2 top-1/2 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-red-900 bg-zinc-950 p-4">
              <h3 className="text-sm font-semibold text-red-300">Delete Strategy</h3>
              <p className="mt-1 text-xs text-zinc-400">
                This action will delete the strategy and all related data in cascade.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Type <span className="font-semibold text-zinc-300">{strategyName}</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteStrategyConfirmInput}
                onChange={(event) => onDeleteStrategyConfirmInputChange(event.target.value)}
                className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                autoFocus
              />
              {deleteStrategyError && (
                <div className="mt-3 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  {deleteStrategyError}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseDeleteStrategyDialog}
                  disabled={isDeletingStrategy}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirmDeleteStrategy}
                  disabled={isDeletingStrategy}
                  className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                >
                  {isDeletingStrategy ? 'Deleting...' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
