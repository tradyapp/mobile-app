'use client';

import { Dialog, DialogButton, List, ListItem } from 'konsta/react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { SymbolAvatar } from '@/modules/tabs/orion/OrionValueView';
import { type StrategyTrackedSymbol } from '@/services/StrategiesService';

type MiniCandle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type BacktestHit = {
  id: string;
  anchorTime: string;
  nodeType: string;
  rating: number | null;
  percentage: number | null;
};

interface OrionBacktestingViewProps {
  isOpen: boolean;
  safeHorizontalInsetStyle: CSSProperties;
  selectedExecutionSymbol: { ticker: string; name: string; icon_url: string | null } | null;
  trackedSymbols: StrategyTrackedSymbol[];
  onClose: () => void;
}

function buildMockCandles(size = 64): MiniCandle[] {
  const now = Date.now();
  let last = 190;
  const out: MiniCandle[] = [];
  for (let i = 0; i < size; i += 1) {
    const drift = Math.sin(i / 5) * 1.1 + Math.cos(i / 8) * 0.5;
    const open = last;
    const close = Math.max(20, open + drift + (i % 2 === 0 ? 0.25 : -0.2));
    const high = Math.max(open, close) + 0.9 + ((i % 4) * 0.16);
    const low = Math.min(open, close) - 0.8 - ((i % 3) * 0.14);
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

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function ClockIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path d="M12 7v5l3 2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 19h16" strokeWidth={2} strokeLinecap="round" />
      <path d="M7 15V9" strokeWidth={2} strokeLinecap="round" />
      <path d="M12 15V6" strokeWidth={2} strokeLinecap="round" />
      <path d="M17 15v-3" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export default function OrionBacktestingView({
  isOpen,
  safeHorizontalInsetStyle,
  selectedExecutionSymbol,
  trackedSymbols,
  onClose,
}: OrionBacktestingViewProps) {
  const candles = useMemo(() => buildMockCandles(), []);
  const [processedCount, setProcessedCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hits, setHits] = useState<BacktestHit[]>([]);
  const [confirmAction, setConfirmAction] = useState<'close' | 'stop' | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDateControls, setShowDateControls] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);

  const activeSymbol = useMemo(() => {
    const selectedTicker = selectedExecutionSymbol?.ticker?.toUpperCase();
    if (selectedTicker) {
      const match = trackedSymbols.find((item) => item.ticker.toUpperCase() === selectedTicker);
      if (match) return match;
    }
    return trackedSymbols[0] ?? null;
  }, [selectedExecutionSymbol?.ticker, trackedSymbols]);
  const hasDateRange = Boolean(fromDate && toDate);
  const availableFromDate = useMemo(() => candles[0]?.datetime.slice(0, 10) ?? '', [candles]);
  const availableToDate = useMemo(() => candles[candles.length - 1]?.datetime.slice(0, 10) ?? '', [candles]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(orientation: landscape)');
    const update = () => setIsLandscape(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setProcessedCount(0);
    setHits([]);
    setIsRunning(false);
    setIsPaused(false);
    setShowDateControls(!hasDateRange);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isRunning || isPaused) return;
    const timer = window.setInterval(() => {
      setProcessedCount((prev) => {
        const next = Math.min(candles.length, prev + 1);
        if (next >= candles.length) {
          setIsRunning(false);
          setIsPaused(false);
        }
        return next;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [candles.length, hasDateRange, isOpen, isPaused, isRunning]);

  useEffect(() => {
    if (processedCount <= 0) return;
    if (processedCount % 7 !== 0) return;
    const candle = candles[Math.max(0, processedCount - 1)];
    if (!candle) return;
    const hitIndex = Math.floor(processedCount / 7);
    const rating = hitIndex % 2 === 0 ? (2 + (hitIndex % 4)) : null;
    const percentage = rating === null ? Number((58 + ((hitIndex * 3.4) % 38)).toFixed(2)) : null;
    setHits((prev) => [{
      id: `${candle.datetime}-${hitIndex}`,
      anchorTime: candle.datetime,
      nodeType: rating === null ? 'output.percentage' : 'output.rating',
      rating,
      percentage,
    }, ...prev]);
  }, [candles, processedCount]);

  if (!isOpen) return null;

  const min = Math.min(...candles.map((item) => item.low));
  const max = Math.max(...candles.map((item) => item.high));
  const range = Math.max(0.0001, max - min);

  const handlePlayPause = () => {
    if (!hasDateRange) return;
    if (!isRunning) {
      setProcessedCount(0);
      setHits([]);
      setIsRunning(true);
      setIsPaused(false);
      return;
    }
    setIsPaused((prev) => !prev);
  };

  const requestStop = () => {
    if (!isRunning && processedCount === 0) return;
    setConfirmAction('stop');
  };

  const handleFromDateChange = (value: string) => {
    const bounded = value < availableFromDate ? availableFromDate : (value > availableToDate ? availableToDate : value);
    setFromDate(bounded);
    if (toDate && bounded && bounded <= toDate) setShowDateControls(false);
  };

  const handleToDateChange = (value: string) => {
    const bounded = value < availableFromDate ? availableFromDate : (value > availableToDate ? availableToDate : value);
    setToDate(bounded);
    if (fromDate && bounded && fromDate <= bounded) setShowDateControls(false);
  };

  const requestClose = () => {
    if (isRunning) {
      setConfirmAction('close');
      return;
    }
    onClose();
  };

  const confirmExit = () => {
    if (confirmAction === 'stop') {
      setIsRunning(false);
      setIsPaused(false);
      setProcessedCount(0);
      setHits([]);
    }
    if (confirmAction === 'close') {
      setIsRunning(false);
      setIsPaused(false);
      setProcessedCount(0);
      setHits([]);
      onClose();
    }
    setConfirmAction(null);
  };

  return (
    <div className="absolute inset-0 z-[320] flex flex-col bg-zinc-950">
      <header
        className="flex items-center gap-3 border-b border-zinc-800 pb-3 pt-[max(16px,env(safe-area-inset-top))]"
        style={safeHorizontalInsetStyle}
      >
        <button
          type="button"
          onClick={requestClose}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-200"
          aria-label="Close backtesting view"
        >
          <CloseIcon />
        </button>

        <button
          type="button"
          className="flex min-w-[178px] max-w-[56vw] items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/95 px-2.5 py-2 text-left shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
          aria-label="Backtesting symbol"
        >
          <SymbolAvatar
            iconUrl={activeSymbol?.icon_url ?? selectedExecutionSymbol?.icon_url ?? null}
            ticker={activeSymbol?.ticker ?? selectedExecutionSymbol?.ticker ?? '---'}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-zinc-100">
              {activeSymbol?.ticker ?? selectedExecutionSymbol?.ticker ?? 'Select symbol'}
            </p>
            <p className="truncate text-[10px] text-zinc-400">
              {activeSymbol?.name ?? selectedExecutionSymbol?.name ?? 'Backtesting symbol'}
            </p>
          </div>
        </button>

      </header>

      <div className="min-h-0 flex-1" style={safeHorizontalInsetStyle}>
        <div className={`min-h-0 h-full pt-3 pb-[max(16px,env(safe-area-inset-bottom))] ${isLandscape ? 'flex gap-3' : 'block'}`}>
          <div className={`min-h-0 ${isLandscape ? 'w-1/2 border-r border-zinc-800 pr-3' : 'h-[34dvh] min-h-[220px] border-b border-zinc-800'}`}>
            <div className="mb-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handlePlayPause}
                disabled={!hasDateRange}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-600 bg-emerald-950/70 text-emerald-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] disabled:opacity-45"
                aria-label={isRunning && !isPaused ? 'Pause backtesting' : 'Play backtesting'}
                title={isRunning && !isPaused ? 'Pause' : 'Play'}
              >
                {isRunning && !isPaused ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button
                type="button"
                onClick={requestStop}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-red-800 bg-red-950/60 text-red-300"
                aria-label="Stop backtesting"
                title="Stop"
              >
                <StopIcon />
              </button>
            </div>
            <div className={`relative ${isLandscape ? 'h-[calc(100%-48px)]' : 'h-[calc(100%-48px)]'}`}>
              {hasDateRange && !showDateControls && (
                <button
                  type="button"
                  onClick={() => setShowDateControls(true)}
                  className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/85 text-zinc-300"
                  aria-label="Edit date range"
                  title="Edit date range"
                >
                  <ClockIcon />
                </button>
              )}

              {showDateControls || !hasDateRange ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-2">
                  <div className="flex w-full items-center justify-center gap-3">
                    <label className="relative flex w-[42%] cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-semibold">{fromDate || 'From'}</span>
                      </div>
                      <input
                        type="date"
                        value={fromDate}
                        min={availableFromDate || undefined}
                        max={(toDate || availableToDate) || undefined}
                        onChange={(event) => handleFromDateChange(event.target.value)}
                        className="absolute inset-0 opacity-0"
                        aria-label="From date"
                      />
                    </label>
                    <label className="relative flex w-[42%] cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-semibold">{toDate || 'To'}</span>
                      </div>
                      <input
                        type="date"
                        value={toDate}
                        min={(fromDate || availableFromDate) || undefined}
                        max={availableToDate || undefined}
                        onChange={(event) => handleToDateChange(event.target.value)}
                        className="absolute inset-0 opacity-0"
                        aria-label="To date"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Disponible: {availableFromDate || '--'} a {availableToDate || '--'}
                  </p>
                  {hasDateRange && (
                    <button
                      type="button"
                      onClick={() => setShowDateControls(false)}
                      className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100"
                    >
                      <ChartIcon className="h-4 w-4" />
                      Ver gráfica
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-end gap-1 overflow-hidden">
                  {candles.map((candle, index) => {
                    const bodyTop = ((Math.max(candle.open, candle.close) - min) / range) * 100;
                    const bodyBottom = ((Math.min(candle.open, candle.close) - min) / range) * 100;
                    const wickTop = ((candle.high - min) / range) * 100;
                    const wickBottom = ((candle.low - min) / range) * 100;
                    const isBull = candle.close >= candle.open;
                    const isProcessed = index < processedCount;
                    return (
                      <div key={candle.datetime} className={`relative h-full flex-1 ${isProcessed ? 'opacity-95' : 'opacity-20'}`}>
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
              )}
            </div>
          </div>

          <div className={`min-h-0 overflow-hidden ${isLandscape ? 'w-1/2 pl-1' : 'h-[calc(66dvh-max(16px,env(safe-area-inset-bottom))-56px)] pt-3'}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">Aciertos</p>
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <span>{processedCount}/{candles.length}</span>
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-200">{hits.length}</span>
              </div>
            </div>

            <div className="h-full overflow-y-auto pb-4">
              <List strong inset>
                {hits.map((hit) => (
                  <ListItem
                    key={hit.id}
                    title={hit.nodeType}
                    subtitle={new Date(hit.anchorTime).toLocaleString()}
                    after={hit.percentage !== null
                      ? <span className="text-[12px] font-semibold text-blue-300">{hit.percentage.toFixed(2)}%</span>
                      : <span className="text-[12px] font-semibold text-amber-300">{formatStars(hit.rating ?? 0)}</span>}
                  />
                ))}
                {hits.length === 0 && (
                  <ListItem
                    title="No hay aciertos todavía"
                    subtitle="Presiona Play para iniciar backtesting"
                  />
                )}
              </List>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        opened={confirmAction !== null}
        onBackdropClick={() => setConfirmAction(null)}
        title={confirmAction === 'stop' ? 'Detener backtesting' : 'Salir de backtesting'}
        text={confirmAction === 'stop'
          ? 'Esto detendrá el proceso actual y limpiará el progreso mostrado.'
          : '¿Quieres salir antes de que termine el backtesting? Esto cancelará el proceso.'}
      >
        <DialogButton onClick={() => setConfirmAction(null)}>Cancelar</DialogButton>
        <DialogButton danger onClick={confirmExit}>Confirmar</DialogButton>
      </Dialog>
    </div>
  );
}
