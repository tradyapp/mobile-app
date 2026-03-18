import type { ChartIndicator } from "@/stores/chartSettingsStore";
import { ScreenHeader, ChevronRight } from "./shared";

interface IndicatorsScreenProps {
  onBack: () => void;
  onClose: () => void;
  indicators: ChartIndicator[];
  onAddIndicator: () => void;
  onOpenAttributes: (id: string) => void;
}

function getIndicatorLabel(indicator: ChartIndicator): string {
  if (indicator.type === 'sma') {
    return `Moving Average (${indicator.period})`;
  }
  if (indicator.type === 'ema') {
    return `EMA (${indicator.period})`;
  }
  if (indicator.type === 'rsi') {
    return `RSI (${indicator.period})`;
  }
  if (indicator.type === 'macd') {
    return `MACD (${indicator.fastPeriod}, ${indicator.slowPeriod}, ${indicator.signalPeriod})`;
  }
  return indicator.name;
}

function getIndicatorSubLabel(indicator: ChartIndicator): string {
  if (indicator.type === 'sma') return indicator.source.toUpperCase();
  if (indicator.type === 'ema') return indicator.source.toUpperCase();
  if (indicator.type === 'rsi') return 'Oscillator';
  if (indicator.type === 'macd') return 'Oscillator';
  return '';
}

export default function IndicatorsScreen({
  onBack,
  onClose,
  indicators,
  onAddIndicator,
  onOpenAttributes,
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
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onOpenAttributes(indicator.id);
                }}
                onClick={(e) => e.preventDefault()}
                className="w-full text-left [touch-action:manipulation]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border border-zinc-700"
                      style={{ backgroundColor: indicator.color }}
                    />
                    <div>
                      <div className="text-base text-white">{getIndicatorLabel(indicator)}</div>
                      <div className="text-xs text-zinc-400">{getIndicatorSubLabel(indicator)}</div>
                    </div>
                  </div>
                  <ChevronRight />
                </div>
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
