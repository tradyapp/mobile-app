import { useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogButton, List, ListItem, Toggle } from "konsta/react";
import type { ChartIndicator } from "@/stores/chartSettingsStore";
import { ScreenHeader, ChevronRight } from "./shared";

interface IndicatorAttributesScreenProps {
  onBack: () => void;
  onClose: () => void;
  indicator: ChartIndicator;
  onOpenColorPicker: () => void;
  onUpdate: (partial: Partial<ChartIndicator>) => void;
  onRemove: () => void;
}

export default function IndicatorAttributesScreen({
  onBack,
  onClose,
  indicator,
  onOpenColorPicker,
  onUpdate,
  onRemove,
}: IndicatorAttributesScreenProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Indicator attributes" />

      <div className="space-y-4 pb-6">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onOpenColorPicker();
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full border border-zinc-700"
                style={{ backgroundColor: indicator.color }}
              />
              <div>
                <div className="text-sm text-zinc-400">Color</div>
                <div className="text-base text-white font-mono">{indicator.color}</div>
              </div>
            </div>
            <ChevronRight />
          </div>
        </button>

        <div className="rounded-lg bg-zinc-800 p-4">
          <div className="text-zinc-400 text-sm mb-2">Period</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={200}
              value={indicator.period}
              onChange={(e) => onUpdate({ period: Number(e.target.value) })}
              className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-400 [&::-webkit-slider-thumb]:shadow"
            />
            <input
              type="number"
              min={2}
              max={200}
              value={indicator.period}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                onUpdate({ period: Math.min(200, Math.max(2, value)) });
              }}
              className="w-18 px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm"
            />
          </div>
        </div>

        <div className="rounded-lg bg-zinc-800 p-4">
          <div className="text-zinc-400 text-sm mb-2">Line width</div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((width) => (
              <button
                key={width}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onUpdate({ lineWidth: width });
                }}
                onClick={(e) => e.preventDefault()}
                className={[
                  "flex-1 py-2 rounded-lg border-2 transition-all text-sm [touch-action:manipulation]",
                  indicator.lineWidth === width
                    ? "bg-zinc-700 text-white border-white"
                    : "bg-zinc-900 text-zinc-400 border-transparent",
                ].join(" ")}
              >
                {width}px
              </button>
            ))}
          </div>
        </div>

        <List strong className="rounded-xl overflow-hidden">
          <ListItem
            title="Visible"
            after={
              <Toggle
                checked={indicator.visible}
                onChange={() => onUpdate({ visible: !indicator.visible })}
              />
            }
          />
        </List>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setIsRemoveDialogOpen(true);
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-red-950/50 text-red-300 hover:bg-red-950 [touch-action:manipulation]"
        >
          Remove indicator
        </button>
      </div>

      {typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-9999 pointer-events-none">
          <div className="pointer-events-auto">
            <Dialog
              backdrop
              opened={isRemoveDialogOpen}
              onBackdropClick={(e) => {
                e?.stopPropagation?.();
                setIsRemoveDialogOpen(false);
              }}
              title="Remove Indicator"
              content="Are you sure you want to remove this indicator?"
              buttons={
                <>
                  <DialogButton
                    onClick={(e) => {
                      e?.stopPropagation?.();
                      setIsRemoveDialogOpen(false);
                    }}
                  >
                    Cancel
                  </DialogButton>
                  <DialogButton
                    strong
                    className="text-red-500"
                    onClick={(e) => {
                      e?.stopPropagation?.();
                      setIsRemoveDialogOpen(false);
                      onRemove();
                    }}
                  >
                    Remove
                  </DialogButton>
                </>
              }
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
