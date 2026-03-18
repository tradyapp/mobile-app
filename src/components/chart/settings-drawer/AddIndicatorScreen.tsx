import type { ChartIndicator } from "@/stores/chartSettingsStore";
import { ScreenHeader, ChevronRight } from "./shared";

interface AddIndicatorScreenProps {
  onBack: () => void;
  onClose: () => void;
  activeIndicators: ChartIndicator[];
  onAddMovingAverage: () => void;
}

export default function AddIndicatorScreen({
  onBack,
  onClose,
  activeIndicators,
  onAddMovingAverage,
}: AddIndicatorScreenProps) {
  const hasMovingAverage = activeIndicators.some((indicator) => indicator.type === 'sma');

  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Add indicator" />

      <div className="space-y-2 pb-6">
        <button
          type="button"
          disabled={hasMovingAverage}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!hasMovingAverage) onAddMovingAverage();
          }}
          onClick={(e) => e.preventDefault()}
          className={[
            "w-full px-4 py-4 rounded-lg text-left transition-colors [touch-action:manipulation]",
            hasMovingAverage
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base text-white">Moving Average</div>
              <div className="text-xs text-zinc-400">Simple Moving Average (SMA)</div>
            </div>
            {hasMovingAverage ? (
              <span className="text-xs text-zinc-500">Added</span>
            ) : (
              <ChevronRight />
            )}
          </div>
        </button>
      </div>
    </>
  );
}
