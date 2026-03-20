'use client';

import { Searchbar, Segmented, SegmentedButton } from 'konsta/react';
import AppDrawer from '@/components/uiux/AppDrawer';
import { type StrategyTrackedSymbol } from '@/services/StrategiesService';
import { SymbolAvatar } from '@/modules/tabs/orion/OrionValueView';

type NodeSymbolFilter = 'ALL' | StrategyTrackedSymbol['market'];

interface OrionExecutionSymbolDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filter: NodeSymbolFilter;
  onFilterChange: (value: NodeSymbolFilter) => void;
  trackedSymbols: StrategyTrackedSymbol[];
  filteredSymbols: StrategyTrackedSymbol[];
  selectedExecutionTicker: string;
  onSelectSymbol: (ticker: string) => void;
}

export default function OrionExecutionSymbolDrawer({
  isOpen,
  onOpenChange,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  trackedSymbols,
  filteredSymbols,
  selectedExecutionTicker,
  onSelectSymbol,
}: OrionExecutionSymbolDrawerProps) {
  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Select Test Symbol"
      height="full"
    >
      <div className="mb-3 -mx-4 px-4 [&_input]:rounded-xl!">
        <Searchbar
          placeholder="Search symbols..."
          value={search}
          onInput={(event) => onSearchChange((event.target as HTMLInputElement).value)}
          onClear={() => onSearchChange('')}
        />
      </div>

      <div className="mb-3">
        <Segmented strong className="w-full [&_button]:py-1.5 [&_button]:text-[11px]">
          {[
            { key: 'ALL', label: 'All' },
            { key: 'STOCKS', label: 'NYSE' },
            { key: 'FOREX', label: 'Forex' },
            { key: 'CRYPTO', label: 'Crypto' },
          ].map((item) => (
            <SegmentedButton
              key={item.key}
              active={filter === item.key}
              onClick={() => onFilterChange(item.key as NodeSymbolFilter)}
            >
              {item.label}
            </SegmentedButton>
          ))}
        </Segmented>
      </div>

      <div className="space-y-1.5 pb-6">
        {trackedSymbols.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-center text-sm text-zinc-500">
            No symbols configured for this strategy.
          </div>
        ) : filteredSymbols.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-center text-sm text-zinc-500">
            No symbols found.
          </div>
        ) : (
          filteredSymbols.map((item) => {
            const active = selectedExecutionTicker.toUpperCase() === item.ticker.toUpperCase();
            return (
              <button
                key={item.ticker}
                type="button"
                onClick={() => onSelectSymbol(item.ticker)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${active ? 'border-emerald-600 bg-emerald-900/20' : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800/80'}`}
              >
                <div className="flex items-center gap-2.5">
                  <SymbolAvatar iconUrl={item.icon_url} ticker={item.ticker} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{item.ticker}</p>
                    <p className="truncate text-xs text-zinc-400">{item.name}</p>
                  </div>
                  {active && (
                    <span className="rounded-full border border-emerald-600 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Selected
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </AppDrawer>
  );
}
