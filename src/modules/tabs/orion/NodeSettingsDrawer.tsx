'use client';

import { createPortal } from 'react-dom';
import { List, ListItem, Toggle } from 'konsta/react';
import { useEffect, useMemo, useState } from 'react';
import AppDrawer from '@/components/uiux/AppDrawer';
import {
  strategiesService,
  type StrategyCompileResult,
  type StrategyBacktestMetadataResult,
  type StrategyBacktestRunResult,
  type StrategyNodeVersionRecord,
  type StrategySymbolMarket,
  type StrategyTrackedSymbol,
} from '@/services/StrategiesService';

function BackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function SymbolIcon({ iconUrl, ticker }: { iconUrl: string | null; ticker: string }) {
  if (iconUrl) {
    return <img src={iconUrl} alt={ticker} className="h-8 w-8 rounded-md object-cover" />;
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-semibold text-zinc-300">
      {ticker.slice(0, 3)}
    </div>
  );
}

function SymbolRow({
  ticker,
  name,
  iconUrl,
  selected,
  onToggle,
  disabled,
}: {
  ticker: string;
  name: string;
  iconUrl: string | null;
  selected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
      <SymbolIcon iconUrl={iconUrl} ticker={ticker} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-100">{ticker}</p>
        <p className="truncate text-xs text-zinc-400">{name}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none ${selected ? 'border-red-900 bg-red-950/60 text-red-300' : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'} disabled:opacity-60`}
        aria-label={selected ? `Remove ${ticker}` : `Add ${ticker}`}
      >
        {selected ? '−' : '+'}
      </button>
    </div>
  );
}

export interface StrategySymbolCatalogItem {
  ticker: string;
  name: string;
  icon_url: string | null;
  market: StrategySymbolMarket;
}

interface NodeSettingsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  settingsPanel: 'menu' | 'versions' | 'symbols' | 'symbols-library' | 'backtesting' | 'benchmark' | 'danger';
  onSettingsPanelChange: (panel: 'menu' | 'versions' | 'symbols' | 'symbols-library' | 'backtesting' | 'benchmark' | 'danger') => void;
  isPreviewMode: boolean;
  isPublishingVersion: boolean;
  previewVersion: StrategyNodeVersionRecord | null;
  onActivateButtonClick: () => Promise<void>;
  onOpenVersions: () => void;
  isNodeVersionsLoading: boolean;
  nodeVersions: StrategyNodeVersionRecord[];
  onEnterPreviewVersion: (version: StrategyNodeVersionRecord) => void;
  nodeVersionsError: string | null;
  isLive: boolean;
  onToggleLive: () => void;
  onOpenBacktesting: () => void;
  isOwner: boolean;
  trackedSymbols: StrategyTrackedSymbol[];
  availableSymbols: StrategySymbolCatalogItem[];
  isSymbolsLoading: boolean;
  isSymbolsSaving: boolean;
  symbolsError: string | null;
  onOpenSymbols: () => void;
  onOpenSymbolsLibrary: () => void;
  onRetryLoadSymbols: () => void;
  onToggleSymbol: (symbol: StrategySymbolCatalogItem | StrategyTrackedSymbol) => void;
  strategyName: string;
  isDeletingStrategy: boolean;
  onDeleteStrategyRequest: () => void;
}

export function NodeSettingsDrawer({
  isOpen,
  onOpenChange,
  settingsPanel,
  onSettingsPanelChange,
  isPreviewMode,
  isPublishingVersion,
  previewVersion,
  onActivateButtonClick,
  onOpenVersions,
  isNodeVersionsLoading,
  nodeVersions,
  onEnterPreviewVersion,
  nodeVersionsError,
  isLive,
  onToggleLive,
  onOpenBacktesting,
  isOwner,
  trackedSymbols,
  availableSymbols,
  isSymbolsLoading,
  isSymbolsSaving,
  symbolsError,
  onOpenSymbols,
  onOpenSymbolsLibrary,
  onRetryLoadSymbols,
  onToggleSymbol,
  strategyName,
  isDeletingStrategy,
  onDeleteStrategyRequest,
}: NodeSettingsDrawerProps) {
  const [activeMarketFilter, setActiveMarketFilter] = useState<'ALL' | StrategySymbolMarket>('ALL');
  const [backtestSymbol, setBacktestSymbol] = useState('');
  const [backtestFromDate, setBacktestFromDate] = useState('');
  const [backtestToDate, setBacktestToDate] = useState('');
  const [backtestMaxBars, setBacktestMaxBars] = useState(5000);
  const [isBacktestLoadingMetadata, setIsBacktestLoadingMetadata] = useState(false);
  const [isBacktestRunning, setIsBacktestRunning] = useState(false);
  const [backtestMetadata, setBacktestMetadata] = useState<StrategyBacktestMetadataResult | null>(null);
  const [backtestResult, setBacktestResult] = useState<StrategyBacktestRunResult | null>(null);
  const [backtestJobId, setBacktestJobId] = useState<string | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [benchmarkSymbol, setBenchmarkSymbol] = useState('');
  const [benchmarkIterations, setBenchmarkIterations] = useState(5000);
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<StrategyCompileResult | null>(null);
  const [benchmarkClientRunMs, setBenchmarkClientRunMs] = useState<number | null>(null);
  const [legacyBenchmarkRuns, setLegacyBenchmarkRuns] = useState(3);
  const [isLegacyBenchmarkRunning, setIsLegacyBenchmarkRunning] = useState(false);
  const [legacyBenchmarkMs, setLegacyBenchmarkMs] = useState<{ samples: number[]; avg: number; min: number; max: number } | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  const selectedTickerSet = useMemo(
    () => new Set(trackedSymbols.map((item) => item.ticker.toUpperCase())),
    [trackedSymbols]
  );

  const visibleSymbolCatalog = useMemo(() => {
    if (activeMarketFilter === 'ALL') return availableSymbols;
    return availableSymbols.filter((item) => item.market === activeMarketFilter);
  }, [activeMarketFilter, availableSymbols]);

  const resolveStrategyIdFromPath = (): string | null => {
    if (typeof window === 'undefined') return null;
    const normalized = window.location.pathname.replace(/\/+$/, '');
    const match = normalized.match(/^\/orion\/marketplace\/my-strategies\/([^/]+)\/nodes$/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  };

  const formatDateInputValue = (iso: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const makeStartISO = (dateInput: string): string => {
    return `${dateInput}T00:00:00.000Z`;
  };

  const makeEndISO = (dateInput: string): string => {
    return `${dateInput}T23:59:59.999Z`;
  };

  const loadBacktestMetadata = async () => {
    if (!backtestSymbol.trim()) {
      setBacktestError('Select a symbol first.');
      return;
    }
    const strategyId = resolveStrategyIdFromPath();
    if (!strategyId) {
      setBacktestError('Strategy ID not found in route.');
      return;
    }

    setBacktestError(null);
    setIsBacktestLoadingMetadata(true);
    try {
      const metadata = await strategiesService.getStrategyBacktestMetadata({
        strategy_id: strategyId,
        symbol: backtestSymbol,
      });
      setBacktestMetadata(metadata);
      setBacktestResult(null);
      if (!backtestFromDate) {
        setBacktestFromDate(formatDateInputValue(metadata.timeframe_stats.find((item) => item.timeframe === metadata.base_timeframe)?.oldest ?? null));
      }
      if (!backtestToDate) {
        setBacktestToDate(formatDateInputValue(metadata.timeframe_stats.find((item) => item.timeframe === metadata.base_timeframe)?.newest ?? null));
      }
    } catch (error) {
      setBacktestError(error instanceof Error ? error.message : 'Failed to load backtest metadata');
    } finally {
      setIsBacktestLoadingMetadata(false);
    }
  };

  const runBacktest = async () => {
    if (!backtestSymbol.trim()) {
      setBacktestError('Select a symbol first.');
      return;
    }
    if (!backtestFromDate || !backtestToDate) {
      setBacktestError('Select both start and end dates.');
      return;
    }
    const strategyId = resolveStrategyIdFromPath();
    if (!strategyId) {
      setBacktestError('Strategy ID not found in route.');
      return;
    }

    setBacktestError(null);
    setIsBacktestRunning(true);
    try {
      let result = await strategiesService.startStrategyBacktestJob({
        strategy_id: strategyId,
        symbol: backtestSymbol,
        from: makeStartISO(backtestFromDate),
        to: makeEndISO(backtestToDate),
        max_bars: backtestMaxBars,
        mode: 'preview',
        chunk_bars: 300,
        events_limit: 200,
      });
      setBacktestJobId(result.job_id ?? null);
      setBacktestResult(result);

      const terminalStates = new Set(['completed', 'failed', 'canceled']);
      let guard = 0;
      while (!terminalStates.has(result.status) && result.job_id && guard < 120) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        result = await strategiesService.stepStrategyBacktestJob(result.job_id, 300, 200);
        setBacktestResult(result);
        guard += 1;
      }

      if (result.status === 'failed') {
        throw new Error(result.last_error || 'Backtest job failed');
      }
    } catch (error) {
      setBacktestError(error instanceof Error ? error.message : 'Failed to run backtest');
    } finally {
      setIsBacktestRunning(false);
    }
  };

  const runBenchmark = async () => {
    const strategyId = resolveStrategyIdFromPath();
    if (!strategyId) {
      setBenchmarkError('Strategy ID not found in route.');
      return;
    }

    setBenchmarkError(null);
    setIsBenchmarkRunning(true);
    setBenchmarkClientRunMs(null);
    try {
      const result = await strategiesService.compileStrategy({
        strategy_id: strategyId,
        benchmark_iterations: Math.max(1, Math.min(50000, Math.floor(benchmarkIterations))),
      });
      setBenchmarkResult(result);

      const perfStart = performance.now();
      const moduleObj = new Function(`return ${result.runner_code}`)() as {
        createRunner: (runtime: { exec: (_node: unknown, attrs: Record<string, unknown>) => unknown }) => (_ctx: unknown) => unknown;
      };
      const runner = moduleObj.createRunner({
        exec: (_node: unknown, attrs: Record<string, unknown>) => attrs.value ?? attrs.left_value ?? attrs.condition ?? null,
      });
      const totalIters = Math.max(1, Math.min(50000, Math.floor(benchmarkIterations)));
      for (let i = 0; i < totalIters; i += 1) {
        runner({
          execution_symbol: benchmarkSymbol ? { ticker: benchmarkSymbol } : null,
          index: i,
        });
      }
      const perfMs = Number((performance.now() - perfStart).toFixed(3));
      setBenchmarkClientRunMs(perfMs);
    } catch (error) {
      setBenchmarkError(error instanceof Error ? error.message : 'Failed to run benchmark');
    } finally {
      setIsBenchmarkRunning(false);
    }
  };

  const logBenchmarkRunner = () => {
    if (!benchmarkResult?.runner_code) {
      setBenchmarkError('Run benchmark first to generate runner code.');
      return;
    }
    // eslint-disable-next-line no-console
    console.log('[strategy-compile] runner_code\n', benchmarkResult.runner_code);
    // eslint-disable-next-line no-console
    console.log('[strategy-compile] plan\n', benchmarkResult.plan);
  };

  const runLegacyComparison = async () => {
    const strategyId = resolveStrategyIdFromPath();
    if (!strategyId) {
      setBenchmarkError('Strategy ID not found in route.');
      return;
    }
    if (!benchmarkSymbol.trim()) {
      setBenchmarkError('Select a symbol for legacy comparison.');
      return;
    }

    setBenchmarkError(null);
    setIsLegacyBenchmarkRunning(true);
    try {
      const runs = Math.max(1, Math.min(10, Math.floor(legacyBenchmarkRuns)));
      const samples: number[] = [];
      for (let i = 0; i < runs; i += 1) {
        const started = performance.now();
        await strategiesService.runStrategyRunner({
          strategy_id: strategyId,
          mode: 'preview',
          symbol: benchmarkSymbol,
          execution_time: new Date().toISOString(),
        });
        samples.push(Number((performance.now() - started).toFixed(3)));
      }
      const avg = Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(3));
      const min = Number(Math.min(...samples).toFixed(3));
      const max = Number(Math.max(...samples).toFixed(3));
      setLegacyBenchmarkMs({ samples, avg, min, max });
    } catch (error) {
      setBenchmarkError(error instanceof Error ? error.message : 'Failed to run legacy comparison');
    } finally {
      setIsLegacyBenchmarkRunning(false);
    }
  };

  useEffect(() => {
    if (settingsPanel !== 'backtesting') return;
    if (!backtestSymbol && trackedSymbols.length > 0) {
      setBacktestSymbol(trackedSymbols[0].ticker);
    }
  }, [backtestSymbol, settingsPanel, trackedSymbols]);

  useEffect(() => {
    if (settingsPanel !== 'benchmark') return;
    if (!benchmarkSymbol && trackedSymbols.length > 0) {
      setBenchmarkSymbol(trackedSymbols[0].ticker);
    }
  }, [benchmarkSymbol, settingsPanel, trackedSymbols]);

  useEffect(() => {
    if (settingsPanel !== 'backtesting') return;
    if (!backtestSymbol) return;
    if (backtestMetadata?.symbol === backtestSymbol) return;
    void loadBacktestMetadata();
  }, [settingsPanel, backtestSymbol]);

  const title =
    settingsPanel === 'menu'
      ? 'Node Settings'
      : settingsPanel === 'versions'
        ? 'Versiones anteriores'
        : settingsPanel === 'backtesting'
          ? 'Back Testing'
        : settingsPanel === 'benchmark'
          ? 'Benchmark'
        : settingsPanel === 'danger'
          ? 'Danger Zone'
        : settingsPanel === 'symbols'
          ? 'Symbols'
          : 'Add Symbols';

  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      height="full"
      showHeader
      headerLeft={settingsPanel === 'menu' ? null : (
        <button
          type="button"
          onClick={() => onSettingsPanelChange(settingsPanel === 'symbols-library' ? 'symbols' : 'menu')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300"
          aria-label="Volver"
        >
          <BackIcon />
        </button>
      )}
    >
      <div className="pb-4">
        {settingsPanel === 'menu' && (
          <div className="space-y-4">
            <List strong className="overflow-hidden rounded-xl">
              <ListItem
                title="Live"
                after={(
                  <Toggle
                    checked={isLive}
                    onChange={onToggleLive}
                  />
                )}
              />
              <ListItem
                link
                title="Back Testing"
                after={<span className="text-[11px] text-zinc-500">MVP</span>}
                onClick={onOpenBacktesting}
              />
              <ListItem
                link
                title="Benchmark"
                after={<span className="text-[11px] text-zinc-500">Compile</span>}
                onClick={() => onSettingsPanelChange('benchmark')}
              />
              <ListItem
                link
                title="Symbols"
                after={<span className="text-[11px] text-zinc-500">{trackedSymbols.length}</span>}
                onClick={onOpenSymbols}
                disabled={!isOwner}
              />
              <ListItem
                link
                title="Activar version"
                after={(
                  <span className="text-[11px] text-zinc-500">
                    {isPublishingVersion
                      ? 'Activando...'
                      : isPreviewMode
                        ? (previewVersion?.is_active ? 'Ya activa' : 'Activar esta versión')
                        : 'Publicar y activar'}
                  </span>
                )}
                onClick={() => void onActivateButtonClick()}
                disabled={isPublishingVersion || (isPreviewMode && Boolean(previewVersion?.is_active))}
              />
              <ListItem
                link
                title="Versiones anteriores"
                onClick={onOpenVersions}
              />
              {isOwner && (
                <ListItem
                  link
                  title={<span className="text-red-300">Danger Zone</span>}
                  onClick={() => onSettingsPanelChange('danger')}
                />
              )}
            </List>
          </div>
        )}

        {settingsPanel === 'versions' && (
          <div>
            {isNodeVersionsLoading ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                Loading versions...
              </div>
            ) : nodeVersions.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                No hay versiones anteriores.
              </div>
            ) : (
              <List strong className="overflow-hidden rounded-xl">
                {nodeVersions.map((version) => (
                  <ListItem
                    key={version.id}
                    link
                    title={`v${version.version_number} · ${version.name}`}
                    subtitle={new Date(version.created_at).toLocaleString('en-US')}
                    after={
                      version.is_active ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-medium text-emerald-300">Active</span>
                      ) : undefined
                    }
                    onClick={() => onEnterPreviewVersion(version)}
                  />
                ))}
              </List>
            )}
          </div>
        )}

        {settingsPanel === 'symbols' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onOpenSymbolsLibrary}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100"
              disabled={!isOwner}
            >
              Add Symbols
            </button>

            {trackedSymbols.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-4 text-sm text-zinc-400">
                No symbols configured for this strategy.
              </div>
            ) : (
              <div className="space-y-2">
                {trackedSymbols.map((item) => (
                  <SymbolRow
                    key={item.ticker}
                    ticker={item.ticker}
                    name={item.name}
                    iconUrl={item.icon_url}
                    selected
                    onToggle={() => onToggleSymbol(item)}
                    disabled={isSymbolsSaving || !isOwner}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {settingsPanel === 'symbols-library' && (
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'STOCKS', label: 'Stocks' },
                { key: 'FOREX', label: 'Forex' },
                { key: 'CRYPTO', label: 'Crypto' },
              ].map((filter) => {
                const isActive = activeMarketFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveMarketFilter(filter.key as 'ALL' | StrategySymbolMarket)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${isActive ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-300'}`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {isSymbolsLoading ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                Loading symbols...
              </div>
            ) : visibleSymbolCatalog.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                No symbols available.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleSymbolCatalog.map((item) => {
                  const selected = selectedTickerSet.has(item.ticker.toUpperCase());
                  return (
                    <SymbolRow
                      key={`${item.market}-${item.ticker}`}
                      ticker={item.ticker}
                      name={item.name}
                      iconUrl={item.icon_url}
                      selected={selected}
                      onToggle={() => onToggleSymbol(item)}
                      disabled={isSymbolsSaving || !isOwner}
                    />
                  );
                })}
              </div>
            )}

            {!isSymbolsLoading && (
              <button
                type="button"
                onClick={onRetryLoadSymbols}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100"
              >
                Reload Symbols
              </button>
            )}
          </div>
        )}

        {settingsPanel === 'danger' && (
          <div className="rounded-xl border border-red-900/70 bg-red-950/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-red-300">Danger Zone</p>
            <p className="mt-1 text-xs text-red-200/80">Eliminar la estrategia y todos sus datos asociados.</p>
            <button
              type="button"
              onClick={onDeleteStrategyRequest}
              disabled={isDeletingStrategy}
              className="mt-3 w-full rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-300 disabled:opacity-60"
            >
              {isDeletingStrategy ? 'Eliminando...' : `Delete "${strategyName}"`}
            </button>
          </div>
        )}

        {settingsPanel === 'backtesting' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs font-semibold text-zinc-100">Symbol</p>
              <select
                value={backtestSymbol}
                onChange={(event) => setBacktestSymbol(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                {trackedSymbols.length === 0 ? (
                  <option value="">No symbols configured</option>
                ) : (
                  trackedSymbols.map((item) => (
                    <option key={item.ticker} value={item.ticker}>{item.ticker} · {item.name}</option>
                  ))
                )}
              </select>

              <div className="mt-3 grid grid-cols-1 gap-2">
                <label className="text-xs text-zinc-400">
                  From
                  <input
                    type="date"
                    value={backtestFromDate}
                    onChange={(event) => setBacktestFromDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  To
                  <input
                    type="date"
                    value={backtestToDate}
                    onChange={(event) => setBacktestToDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Max Bars
                  <input
                    type="number"
                    min={100}
                    max={20000}
                    step={100}
                    value={backtestMaxBars}
                    onChange={(event) => setBacktestMaxBars(Math.max(100, Number(event.target.value) || 5000))}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { void loadBacktestMetadata(); }}
                  disabled={isBacktestLoadingMetadata || trackedSymbols.length === 0}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-60"
                >
                  {isBacktestLoadingMetadata ? 'Loading...' : 'Refresh Range'}
                </button>
                <button
                  type="button"
                  onClick={() => { void runBacktest(); }}
                  disabled={isBacktestRunning || trackedSymbols.length === 0}
                  className="flex-1 rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-60"
                >
                  {isBacktestRunning ? 'Running...' : 'Run Backtest'}
                </button>
              </div>
            </div>

            {backtestMetadata && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
                <p><span className="text-zinc-500">Base TF:</span> {backtestMetadata.base_timeframe}</p>
                {backtestMetadata.timeframe_stats.map((item) => (
                  <p key={item.timeframe}>
                    <span className="text-zinc-500">{item.timeframe}:</span> {item.count} candles
                  </p>
                ))}
              </div>
            )}

            {backtestResult && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
                <p><span className="text-zinc-500">Status:</span> {backtestResult.status}{typeof backtestResult.progress === 'number' ? ` (${backtestResult.progress}%)` : ''}</p>
                {backtestJobId && <p><span className="text-zinc-500">Job:</span> {backtestJobId}</p>}
                <p><span className="text-zinc-500">Evaluated:</span> {backtestResult.bars_evaluated} / {backtestResult.bars_available}</p>
                <p><span className="text-zinc-500">Events:</span> {backtestResult.stats.events_total}</p>
                <p><span className="text-zinc-500">True:</span> {backtestResult.stats.true_events}</p>
                <p><span className="text-zinc-500">Rating:</span> {backtestResult.stats.rating_events}</p>
                <p><span className="text-zinc-500">Avg rating:</span> {backtestResult.stats.avg_rating ?? 'N/A'}</p>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                  {backtestResult.events.slice(0, 40).map((event, idx) => (
                    <p key={`${event.anchor_time}-${event.output_node_id}-${idx}`} className="truncate">
                      {event.anchor_time} · {event.signal_kind}{event.rating !== null ? ` (${event.rating})` : ''}
                    </p>
                  ))}
                  {backtestResult.events.length === 0 && (
                    <p className="text-zinc-500">No events in selected range.</p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-[11px] text-amber-200/90">
              Backtesting can differ from live behavior, especially with multi-timeframe nodes and unfinished candles.
            </div>
          </div>
        )}

        {settingsPanel === 'benchmark' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs font-semibold text-zinc-100">Benchmark Inputs</p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <label className="text-xs text-zinc-400">
                  Symbol
                  <select
                    value={benchmarkSymbol}
                    onChange={(event) => setBenchmarkSymbol(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    {trackedSymbols.length === 0 ? (
                      <option value="">No symbols configured</option>
                    ) : (
                      trackedSymbols.map((item) => (
                        <option key={item.ticker} value={item.ticker}>{item.ticker} · {item.name}</option>
                      ))
                    )}
                  </select>
                </label>
                <label className="text-xs text-zinc-400">
                  Iterations
                  <input
                    type="number"
                    min={100}
                    max={50000}
                    step={100}
                    value={benchmarkIterations}
                    onChange={(event) => setBenchmarkIterations(Math.max(100, Number(event.target.value) || 5000))}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Legacy Runs
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={legacyBenchmarkRuns}
                    onChange={(event) => setLegacyBenchmarkRuns(Math.max(1, Math.min(10, Number(event.target.value) || 3)))}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { void runBenchmark(); }}
                  disabled={isBenchmarkRunning}
                  className="flex-1 rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-60"
                >
                  {isBenchmarkRunning ? 'Benchmarking...' : 'Run Benchmark'}
                </button>
                <button
                  type="button"
                  onClick={() => { void runLegacyComparison(); }}
                  disabled={isLegacyBenchmarkRunning}
                  className="flex-1 rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs font-semibold text-amber-300 disabled:opacity-60"
                >
                  {isLegacyBenchmarkRunning ? 'Comparing...' : 'Compare Legacy'}
                </button>
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={logBenchmarkRunner}
                  disabled={!benchmarkResult?.runner_code}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-60"
                >
                  Log Runner Code
                </button>
              </div>
            </div>

            {benchmarkResult && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
                <p><span className="text-zinc-500">Nodes:</span> {benchmarkResult.plan.node_count}</p>
                <p><span className="text-zinc-500">Edges:</span> {benchmarkResult.plan.edge_count}</p>
                <p><span className="text-zinc-500">Iterations:</span> {benchmarkResult.benchmark.iterations}</p>
                <p><span className="text-zinc-500">Edge compile:</span> {benchmarkResult.benchmark.compile_ms} ms</p>
                <p><span className="text-zinc-500">Edge run:</span> {benchmarkResult.benchmark.run_ms} ms</p>
                <p><span className="text-zinc-500">Client run:</span> {benchmarkClientRunMs ?? 'N/A'} ms</p>
                <p><span className="text-zinc-500">Per iter (client):</span> {benchmarkClientRunMs !== null ? `${(benchmarkClientRunMs / Math.max(1, benchmarkResult.benchmark.iterations)).toFixed(6)} ms` : 'N/A'}</p>
                {legacyBenchmarkMs && (
                  <>
                    <p><span className="text-zinc-500">Legacy avg:</span> {legacyBenchmarkMs.avg} ms</p>
                    <p><span className="text-zinc-500">Legacy min/max:</span> {legacyBenchmarkMs.min} / {legacyBenchmarkMs.max} ms</p>
                    {benchmarkClientRunMs !== null && (
                      <p><span className="text-zinc-500">Speedup (legacy avg / client run):</span> {(legacyBenchmarkMs.avg / Math.max(benchmarkClientRunMs, 0.0001)).toFixed(2)}x</p>
                    )}
                  </>
                )}
                <p><span className="text-zinc-500">Unsupported node types:</span> {benchmarkResult.plan.unsupported_node_types.length === 0 ? 'None' : benchmarkResult.plan.unsupported_node_types.join(', ')}</p>
              </div>
            )}
          </div>
        )}

        {(!isOwner && settingsPanel === 'menu') && (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
            Solo el dueño de la estrategia puede editar Symbols.
          </div>
        )}

        {(nodeVersionsError || symbolsError || backtestError || benchmarkError) && (
          <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {nodeVersionsError || symbolsError || backtestError || benchmarkError}
          </div>
        )}
      </div>
    </AppDrawer>
  );
}

interface VersionNameDialogProps {
  isOpen: boolean;
  versionNameInput: string;
  onVersionNameInputChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isPublishingVersion: boolean;
}

export function VersionNameDialog({
  isOpen,
  versionNameInput,
  onVersionNameInputChange,
  onClose,
  onConfirm,
  isPublishingVersion,
}: VersionNameDialogProps) {
  if (typeof window === 'undefined' || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] pointer-events-none">
      <div className="pointer-events-auto">
        <button
          type="button"
          className="absolute inset-0 bg-black/70"
          onClick={onClose}
          aria-label="Close version name dialog"
        />
        <div className="absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-sm font-semibold text-white">Activar version</h3>
          <p className="mt-1 text-xs text-zinc-400">Nombre de la nueva versión</p>
          <input
            type="text"
            value={versionNameInput}
            onChange={(event) => onVersionNameInputChange(event.target.value)}
            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={isPublishingVersion}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50"
            >
              {isPublishingVersion ? 'Activando...' : 'Activar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
