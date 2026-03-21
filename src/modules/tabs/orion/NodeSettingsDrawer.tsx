'use client';

import { createPortal } from 'react-dom';
import { List, ListItem, Toggle } from 'konsta/react';
import { useEffect, useMemo, useState } from 'react';
import AppDrawer from '@/components/uiux/AppDrawer';
import {
  strategiesService,
  type StrategyCompileResult,
  type StrategyCompilePlan,
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

type MiniCandle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

function buildMockCandles(size = 40): MiniCandle[] {
  const now = Date.now();
  let last = 190;
  const out: MiniCandle[] = [];
  for (let i = 0; i < size; i += 1) {
    const drift = Math.sin(i / 4) * 0.9 + (Math.cos(i / 6) * 0.6);
    const open = last;
    const close = Math.max(20, open + drift + (i % 2 === 0 ? 0.3 : -0.2));
    const high = Math.max(open, close) + 0.8 + ((i % 3) * 0.15);
    const low = Math.min(open, close) - 0.7 - ((i % 4) * 0.12);
    const datetime = new Date(now - ((size - i) * 60 * 60 * 1000)).toISOString();
    out.push({ datetime, open, high, low, close });
    last = close;
  }
  return out;
}

function formatStars(value: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
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
  onRunCompiledSingleExecutionBenchmark: (compiledPlan: StrategyCompilePlan, ticker: string) => Promise<{ durationMs: number; status: 'completed' | 'failed'; error: string | null }>;
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
  onRunCompiledSingleExecutionBenchmark,
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
  const [isBacktestPaused, setIsBacktestPaused] = useState(false);
  const [isBacktestExitDialogOpen, setIsBacktestExitDialogOpen] = useState(false);
  const [benchmarkSymbol, setBenchmarkSymbol] = useState('');
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<StrategyCompileResult | null>(null);
  const [compiledSingleRunMs, setCompiledSingleRunMs] = useState<number | null>(null);
  const [isLegacyBenchmarkRunning, setIsLegacyBenchmarkRunning] = useState(false);
  const [legacySingleRunMs, setLegacySingleRunMs] = useState<number | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  const selectedTickerSet = useMemo(
    () => new Set(trackedSymbols.map((item) => item.ticker.toUpperCase())),
    [trackedSymbols]
  );

  const visibleSymbolCatalog = useMemo(() => {
    if (activeMarketFilter === 'ALL') return availableSymbols;
    return availableSymbols.filter((item) => item.market === activeMarketFilter);
  }, [activeMarketFilter, availableSymbols]);

  const previewCandles = useMemo(() => buildMockCandles(42), []);
  const processedCandleCount = useMemo(() => {
    if (typeof backtestResult?.progress === 'number') {
      return Math.max(0, Math.min(previewCandles.length, Math.round((backtestResult.progress / 100) * previewCandles.length)));
    }
    if (isBacktestRunning) return Math.max(1, Math.floor(previewCandles.length * 0.35));
    return 0;
  }, [backtestResult?.progress, isBacktestRunning, previewCandles.length]);

  const timelineEvents = useMemo(() => {
    if (backtestResult?.events?.length) return backtestResult.events;
    return [
      { anchor_time: new Date().toISOString(), signal_kind: 'rating' as const, rating: 4, output_node_id: 'mock-a', output_node_type: 'output.rating', output: { percentage: 73.4 } },
      { anchor_time: new Date(Date.now() - 3600000).toISOString(), signal_kind: 'rating' as const, rating: 3, output_node_id: 'mock-b', output_node_type: 'output.rating', output: { rating: 3 } },
      { anchor_time: new Date(Date.now() - 7200000).toISOString(), signal_kind: 'true' as const, rating: null, output_node_id: 'mock-c', output_node_type: 'output.true', output: { result: true } },
    ];
  }, [backtestResult?.events]);

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

  const requestExitBacktesting = () => {
    setIsBacktestExitDialogOpen(true);
  };

  const confirmExitBacktesting = () => {
    setIsBacktestExitDialogOpen(false);
    setIsBacktestPaused(false);
    onSettingsPanelChange('menu');
  };

  const runBenchmark = async () => {
    const strategyId = resolveStrategyIdFromPath();
    if (!strategyId) {
      setBenchmarkError('Strategy ID not found in route.');
      return;
    }

    setBenchmarkError(null);
    setIsBenchmarkRunning(true);
    setCompiledSingleRunMs(null);
    try {
      const result = await strategiesService.compileStrategy({
        strategy_id: strategyId,
        benchmark_iterations: 1,
      });
      setBenchmarkResult(result);
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
      const started = performance.now();
      await strategiesService.runStrategyRunner({
        strategy_id: strategyId,
        mode: 'preview',
        symbol: benchmarkSymbol,
        execution_time: new Date().toISOString(),
      });
      setLegacySingleRunMs(Number((performance.now() - started).toFixed(3)));
    } catch (error) {
      setBenchmarkError(error instanceof Error ? error.message : 'Failed to run legacy comparison');
    } finally {
      setIsLegacyBenchmarkRunning(false);
    }
  };

  const runCompiledSingleExecution = async () => {
    if (!benchmarkResult?.plan) {
      setBenchmarkError('Compile first, then run single execution.');
      return;
    }
    if (!benchmarkSymbol.trim()) {
      setBenchmarkError('Select a symbol for compiled execution.');
      return;
    }
    setBenchmarkError(null);
    setIsBenchmarkRunning(true);
    try {
      const result = await onRunCompiledSingleExecutionBenchmark(benchmarkResult.plan, benchmarkSymbol);
      if (result.status === 'failed') {
        throw new Error(result.error || 'Compiled execution failed');
      }
      setCompiledSingleRunMs(result.durationMs);
    } catch (error) {
      setBenchmarkError(error instanceof Error ? error.message : 'Failed to run compiled execution');
    } finally {
      setIsBenchmarkRunning(false);
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
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-100">Backtesting Live UI</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsBacktestPaused((prev) => !prev)}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-zinc-200"
                  >
                    {isBacktestPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={requestExitBacktesting}
                    className="rounded-lg border border-amber-800 bg-amber-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-300"
                  >
                    Stop
                  </button>
                  <button
                    type="button"
                    onClick={requestExitBacktesting}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-zinc-300"
                    aria-label="Close backtesting"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <select
                  value={backtestSymbol}
                  onChange={(event) => setBacktestSymbol(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                >
                  {trackedSymbols.length === 0 ? (
                    <option value="">No symbols configured</option>
                  ) : (
                    trackedSymbols.map((item) => (
                      <option key={item.ticker} value={item.ticker}>{item.ticker}</option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => { void runBacktest(); }}
                  disabled={isBacktestRunning || trackedSymbols.length === 0 || isBacktestPaused}
                  className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-60"
                >
                  {isBacktestRunning ? 'Running...' : 'Run'}
                </button>
              </div>

              <div className="mt-3 h-40 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                <div className="flex h-full items-end gap-1 overflow-hidden">
                  {previewCandles.map((candle, index) => {
                    const min = Math.min(...previewCandles.map((item) => item.low));
                    const max = Math.max(...previewCandles.map((item) => item.high));
                    const range = Math.max(0.0001, max - min);
                    const bodyTop = ((Math.max(candle.open, candle.close) - min) / range) * 100;
                    const bodyBottom = ((Math.min(candle.open, candle.close) - min) / range) * 100;
                    const wickTop = ((candle.high - min) / range) * 100;
                    const wickBottom = ((candle.low - min) / range) * 100;
                    const isBull = candle.close >= candle.open;
                    const isProcessed = index < processedCandleCount;
                    return (
                      <div key={candle.datetime} className={`relative h-full flex-1 ${isProcessed ? 'opacity-95' : 'opacity-30'}`}>
                        <div
                          className={`absolute left-1/2 w-px -translate-x-1/2 ${isBull ? 'bg-emerald-400' : 'bg-red-400'}`}
                          style={{ bottom: `${wickBottom}%`, height: `${Math.max(1, wickTop - wickBottom)}%` }}
                        />
                        <div
                          className={`absolute left-[22%] right-[22%] rounded-[2px] ${isBull ? 'bg-emerald-500/90' : 'bg-red-500/90'}`}
                          style={{ bottom: `${bodyBottom}%`, height: `${Math.max(2, bodyTop - bodyBottom)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                <p>Processed candles: {processedCandleCount}/{previewCandles.length}</p>
                <p>{isBacktestPaused ? 'Paused' : isBacktestRunning ? 'Running' : 'Idle'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-100">Found Moments</p>
                <p className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-200">
                  {timelineEvents.length}
                </p>
              </div>
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {timelineEvents.map((event, idx) => {
                  const outputObj = event.output && typeof event.output === 'object' ? event.output as Record<string, unknown> : null;
                  const percentage = outputObj && typeof outputObj.percentage === 'number' ? outputObj.percentage : null;
                  const rating = typeof event.rating === 'number' ? event.rating : (outputObj && typeof outputObj.rating === 'number' ? outputObj.rating : null);
                  return (
                    <div key={`${event.anchor_time}-${event.output_node_id}-${idx}`} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <p className="truncate text-[11px] text-zinc-400">{new Date(event.anchor_time).toLocaleString()}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-zinc-200">{event.output_node_type}</p>
                        {percentage !== null ? (
                          <span className="rounded-md bg-blue-950/60 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
                            {percentage.toFixed(2)}%
                          </span>
                        ) : rating !== null ? (
                          <span className="rounded-md bg-amber-950/60 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                            {formatStars(rating)}
                          </span>
                        ) : (
                          <span className="rounded-md bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                            POSITIVE
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { void runBenchmark(); }}
                  disabled={isBenchmarkRunning}
                  className="flex-1 rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-60"
                >
                  {isBenchmarkRunning ? 'Compiling...' : 'Compile'}
                </button>
                <button
                  type="button"
                  onClick={() => { void runCompiledSingleExecution(); }}
                  disabled={isBenchmarkRunning || !benchmarkResult?.plan}
                  className="flex-1 rounded-lg border border-blue-800 bg-blue-950/50 px-3 py-2 text-xs font-semibold text-blue-300 disabled:opacity-60"
                >
                  {isBenchmarkRunning ? 'Running...' : 'Run Compiled (1x)'}
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => { void runLegacyComparison(); }}
                  disabled={isLegacyBenchmarkRunning}
                  className="flex-1 rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs font-semibold text-amber-300 disabled:opacity-60"
                >
                  {isLegacyBenchmarkRunning ? 'Running...' : 'Run Legacy (1x)'}
                </button>
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
                <p><span className="text-zinc-500">Compile time:</span> {benchmarkResult.benchmark.compile_ms} ms</p>
                <p><span className="text-zinc-500">Compiled run (1x, real data):</span> {compiledSingleRunMs ?? 'N/A'} ms</p>
                <p><span className="text-zinc-500">Legacy run (1x):</span> {legacySingleRunMs ?? 'N/A'} ms</p>
                {compiledSingleRunMs !== null && legacySingleRunMs !== null && (
                  <p><span className="text-zinc-500">Speedup:</span> {(legacySingleRunMs / Math.max(compiledSingleRunMs, 0.0001)).toFixed(2)}x</p>
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

        {isBacktestExitDialogOpen && (
          <div className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/70 p-4">
            <div className="w-[min(92vw,420px)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-sm font-semibold text-zinc-100">Exit Backtesting?</p>
              <p className="mt-1 text-xs text-zinc-400">
                Do you want to exit before backtesting finishes? This will cancel the process.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBacktestExitDialogOpen(false)}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={confirmExitBacktesting}
                  className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-xs font-semibold text-red-300"
                >
                  Exit and Cancel
                </button>
              </div>
            </div>
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
