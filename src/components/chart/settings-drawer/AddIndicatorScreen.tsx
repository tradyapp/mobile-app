import type { ChartIndicator } from "@/stores/chartSettingsStore";
import { ScreenHeader, ChevronRight } from "./shared";

interface AddIndicatorScreenProps {
  onBack: () => void;
  onClose: () => void;
  activeIndicators: ChartIndicator[];
  onAddMovingAverage: () => void;
  onAddRsi: () => void;
}

export default function AddIndicatorScreen({
  onBack,
  onClose,
  activeIndicators: _activeIndicators,
  onAddMovingAverage,
  onAddRsi,
}: AddIndicatorScreenProps) {
  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Add indicator" />

      <div className="space-y-2 pb-6">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onAddMovingAverage();
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors [touch-action:manipulation] bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-white">Moving Average</div>
              <div className="text-xs text-zinc-400">Simple Moving Average (SMA)</div>
            </div>
            <ChevronRight />
          </div>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onAddRsi();
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors [touch-action:manipulation] bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-white">RSI</div>
              <div className="text-xs text-zinc-400">Relative Strength Index</div>
            </div>
            <ChevronRight />
          </div>
        </button>
      </div>
    </>
  );
}
