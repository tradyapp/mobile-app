import type { ChartIndicator } from "@/stores/chartSettingsStore";
import { ScreenHeader } from "./shared";

interface IndicatorsScreenProps {
  onBack: () => void;
  onClose: () => void;
  indicators: ChartIndicator[];
  onAddIndicator: () => void;
  onRemoveIndicator: (id: string) => void;
}

function getIndicatorLabel(indicator: ChartIndicator): string {
  if (indicator.type === 'sma') {
    return `Moving Average (${indicator.period})`;
  }
  return indicator.name;
}

export default function IndicatorsScreen({
  onBack,
  onClose,
  indicators,
  onAddIndicator,
  onRemoveIndicator,
}: IndicatorsScreenProps) {
  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Indicators" />

      <div className="space-y-2 pb-6">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onAddIndicator();
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-dashed border-zinc-600 [touch-action:manipulation]"
        >
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-zinc-500 flex items-center justify-center">
              <span className="text-zinc-400 text-xs leading-none">+</span>
            </div>
            <span className="text-base">Add indicator</span>
          </div>
        </button>

        {indicators.length === 0 ? (
          <div className="px-4 py-6 rounded-lg bg-zinc-900 text-zinc-500 text-sm">
            No active indicators.
          </div>
        ) : (
          indicators.map((indicator) => (
            <div
              key={indicator.id}
              className="w-full px-4 py-4 rounded-lg bg-zinc-800 text-zinc-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full border border-zinc-700"
                    style={{ backgroundColor: indicator.color }}
                  />
                  <div>
                    <div className="text-base text-white">{getIndicatorLabel(indicator)}</div>
                    <div className="text-xs text-zinc-400">{indicator.source.toUpperCase()}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onRemoveIndicator(indicator.id);
                  }}
                  onClick={(e) => e.preventDefault()}
                  className="text-red-400 hover:text-red-300 text-sm [touch-action:manipulation]"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
