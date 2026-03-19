'use client';

import { useMemo, useState } from 'react';
import { type StrategyRecord, type StrategySymbolMarket } from '@/services/StrategiesService';

type SymbolFilter = 'ALL' | StrategySymbolMarket;

function SymbolIcon({ iconUrl, ticker }: { iconUrl: string | null; ticker: string }) {
  if (iconUrl) {
    return <img src={iconUrl} alt={ticker} className="h-9 w-9 rounded-md object-cover" />;
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-semibold text-zinc-300">
      {ticker.slice(0, 3)}
    </div>
  );
}

interface StrategySymbolsViewProps {
  strategy: StrategyRecord;
  enabledTickers: string[];
  symbolIconByTicker?: Record<string, string | null>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onToggleTicker: (ticker: string) => void;
  onRetry: () => void;
}

export default function StrategySymbolsView({
  strategy,
  enabledTickers,
  symbolIconByTicker = {},
  isLoading,
  isSaving,
  error,
  onToggleTicker,
  onRetry,
}: StrategySymbolsViewProps) {
  const [filter, setFilter] = useState<SymbolFilter>('ALL');

  const enabledSet = useMemo(
    () => new Set(enabledTickers.map((item) => item.toUpperCase())),
    [enabledTickers]
  );

  const visibleSymbols = useMemo(() => {
    if (filter === 'ALL') return strategy.symbols;
    return strategy.symbols.filter((item) => item.market === filter);
  }, [filter, strategy.symbols]);

  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-sm text-zinc-400">{strategy.name}</p>
        <p className="mt-1 text-xs text-zinc-500">Enabled {enabledSet.size} of {strategy.symbols.length}</p>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'ALL', label: 'All' },
          { key: 'STOCKS', label: 'Stocks' },
          { key: 'FOREX', label: 'Forex' },
          { key: 'CRYPTO', label: 'Crypto' },
        ].map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key as SymbolFilter)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-300'}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-sm text-zinc-400">Loading symbols...</div>
        ) : visibleSymbols.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-sm text-zinc-400">No symbols available.</div>
        ) : (
          visibleSymbols.map((item) => {
            const selected = enabledSet.has(item.ticker.toUpperCase());
            const fallbackIcon = symbolIconByTicker[item.ticker.toUpperCase()] ?? null;
            return (
              <div key={`${item.market}-${item.ticker}`} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                <SymbolIcon iconUrl={item.icon_url ?? fallbackIcon} ticker={item.ticker} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">{item.ticker}</p>
                  <p className="truncate text-xs text-zinc-400">{item.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleTicker(item.ticker)}
                  disabled={isSaving}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none ${selected ? 'border-red-900 bg-red-950/60 text-red-300' : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'} disabled:opacity-60`}
                  aria-label={selected ? `Disable ${item.ticker}` : `Enable ${item.ticker}`}
                >
                  {selected ? '−' : '+'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
