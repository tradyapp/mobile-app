/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import { StockDataService, CandleData, RealtimeMeta } from "@/services/StockDataService";
import { useChartStore } from "@/stores/chartStore";
import { useChartSettingsStore, type MovingAverageIndicator, type RsiIndicator } from "@/stores/chartSettingsStore";
import {
  buildChartPanelLayout,
  getRequiredSecondaryPanels,
  MAX_SECONDARY_PANEL_HEIGHT,
  MIN_SECONDARY_PANEL_HEIGHT,
  type SecondaryPanelId,
} from "./panels/layout";
import ChartSkeleton from "./ChartSkeleton";
import DrawingManager from "./DrawingManager";

interface ChartCandle {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface ChartProps {
  width: number;
  height: number;
}

const candleToChart = (candle: CandleData): ChartCandle => ({
  time: (Date.parse(candle.datetime.replace(' ', 'T')) / 1000) as any,
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
  volume: candle.volume,
});

const formatPrice = (value: number, symbolType: string): string => {
  if (symbolType === 'FOREX') return value.toFixed(5);
  if (symbolType === 'CRYPTO') return value >= 10 ? value.toFixed(3) : value.toFixed(5);
  return value.toFixed(2);
};

const formatVolume = (value: number): string => {
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + 'B';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
  return value.toLocaleString();
};

interface HoveredCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const INITIAL_CANDLE_LIMIT = 600;
const PAGINATION_BATCH_LIMIT = 200;

function calculateSmaData(candles: ChartCandle[], period: number) {
  const data: { time: ChartCandle["time"]; value: number }[] = [];
  if (period <= 0 || candles.length < period) return data;

  let rollingSum = 0;
  for (let i = 0; i < candles.length; i++) {
    rollingSum += candles[i].close;
    if (i >= period) {
      rollingSum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      data.push({
        time: candles[i].time,
        value: rollingSum / period,
      });
    }
  }
  return data;
}

function calculateRsiData(candles: ChartCandle[], period: number) {
  const data: { time: ChartCandle["time"]; value: number }[] = [];
  if (period <= 0 || candles.length <= period) return data;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const delta = candles[i].close - candles[i - 1].close;
    if (delta >= 0) gainSum += delta;
    else lossSum += Math.abs(delta);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const firstRs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
  const firstRsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + firstRs));
  data.push({ time: candles[period].time, value: firstRsi });

  for (let i = period + 1; i < candles.length; i++) {
    const delta = candles[i].close - candles[i - 1].close;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;

    if (avgLoss === 0) {
      data.push({ time: candles[i].time, value: 100 });
      continue;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    data.push({ time: candles[i].time, value: rsi });
  }

  return data;
}

const Chart = ({ width, height }: ChartProps) => {
  const { symbol, symbolType, timeframe } = useChartStore();
  const activeColors = useChartSettingsStore((s) => s.activeColors);
  const activeFilledUpCandle = useChartSettingsStore((s) => s.activeFilledUpCandle);
  const activeFilledDownCandle = useChartSettingsStore((s) => s.activeFilledDownCandle);
  const showVolume = useChartSettingsStore((s) => s.preferences.showVolume);
  const showMaNameLabels = useChartSettingsStore((s) => s.preferences.showMaNameLabels);
  const showMaPriceLabels = useChartSettingsStore((s) => s.preferences.showMaPriceLabels);
  const showLastPriceLine = useChartSettingsStore((s) => s.preferences.showLastPriceLine);
  const secondaryPanelHeight = useChartSettingsStore((s) => s.preferences.secondaryPanelHeight);
  const setPreferences = useChartSettingsStore((s) => s.setPreferences);
  const activeIndicators = useChartSettingsStore((s) => s.preferences.indicators);
  const activeSecondaryPanels = getRequiredSecondaryPanels(activeIndicators, showVolume, symbolType);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const movingAverageSeriesRef = useRef<Map<string, any>>(new Map());
  const rsiSeriesRef = useRef<Map<string, any>>(new Map());
  const rsiLevel70SeriesRef = useRef<any>(null);
  const rsiLevel30SeriesRef = useRef<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [chartVersion, setChartVersion] = useState(0);
  const [hoveredCandle, setHoveredCandle] = useState<HoveredCandle | null>(null);
  const [panelHeightDraft, setPanelHeightDraft] = useState<number | null>(null);
  const [isResizingPanels, setIsResizingPanels] = useState(false);

  // Post-market price line ref
  const priceLineRef = useRef<any>(null);

  // Pagination refs
  const allCandlesRef = useRef<ChartCandle[]>([]);
  const isLoadingMoreRef = useRef(false);
  const hasMoreDataRef = useRef(true);
  const earliestDatetimeRef = useRef<string | null>(null);
  const symbolRef = useRef(symbol);
  const symbolTypeRef = useRef(symbolType);
  const timeframeRef = useRef(timeframe);
  const activeSecondaryPanelsRef = useRef<SecondaryPanelId[]>(activeSecondaryPanels);
  const secondaryPanelHeightRef = useRef(secondaryPanelHeight);
  const resizeStartRef = useRef<{ active: boolean }>({ active: false });

  // Refs for latest colors/fill (read during chart creation without adding to deps)
  const activeColorsRef = useRef(activeColors);
  const filledUpRef = useRef(activeFilledUpCandle);
  const filledDownRef = useRef(activeFilledDownCandle);
  const activeIndicatorsRef = useRef(activeIndicators);
  const showMaNameLabelsRef = useRef(showMaNameLabels);
  const showMaPriceLabelsRef = useRef(showMaPriceLabels);
  const showLastPriceLineRef = useRef(showLastPriceLine);

  // Keep refs in sync with current values
  useEffect(() => {
    symbolRef.current = symbol;
    symbolTypeRef.current = symbolType;
    timeframeRef.current = timeframe;
    activeSecondaryPanelsRef.current = activeSecondaryPanels;
    secondaryPanelHeightRef.current = panelHeightDraft ?? secondaryPanelHeight;
    activeColorsRef.current = activeColors;
    filledUpRef.current = activeFilledUpCandle;
    filledDownRef.current = activeFilledDownCandle;
    activeIndicatorsRef.current = activeIndicators;
    showMaNameLabelsRef.current = showMaNameLabels;
    showMaPriceLabelsRef.current = showMaPriceLabels;
    showLastPriceLineRef.current = showLastPriceLine;
  }, [symbol, symbolType, timeframe, activeSecondaryPanels, secondaryPanelHeight, panelHeightDraft, activeColors, activeFilledUpCandle, activeFilledDownCandle, activeIndicators, showMaNameLabels, showMaPriceLabels, showLastPriceLine]);

  const getSecondaryHeightFromPointer = useCallback((clientY: number) => {
    const container = chartContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    if (rect.height <= 0) return null;

    const raw = (rect.bottom - clientY) / rect.height;
    const clamped = Math.min(MAX_SECONDARY_PANEL_HEIGHT, Math.max(MIN_SECONDARY_PANEL_HEIGHT, raw));
    return clamped;
  }, []);

  const handleResizePointerMove = useCallback((event: PointerEvent) => {
    if (!resizeStartRef.current.active) return;
    const value = getSecondaryHeightFromPointer(event.clientY);
    if (value == null) return;
    setPanelHeightDraft(value);
  }, [getSecondaryHeightFromPointer]);

  const stopResizePanels = useCallback(() => {
    if (!resizeStartRef.current.active) return;
    resizeStartRef.current.active = false;
    setIsResizingPanels(false);

    if (panelHeightDraft != null) {
      setPreferences({ secondaryPanelHeight: panelHeightDraft });
      setPanelHeightDraft(null);
    }
  }, [panelHeightDraft, setPreferences]);

  useEffect(() => {
    window.addEventListener("pointermove", handleResizePointerMove);
    window.addEventListener("pointerup", stopResizePanels);
    window.addEventListener("pointercancel", stopResizePanels);
    return () => {
      window.removeEventListener("pointermove", handleResizePointerMove);
      window.removeEventListener("pointerup", stopResizePanels);
      window.removeEventListener("pointercancel", stopResizePanels);
    };
  }, [handleResizePointerMove, stopResizePanels]);

  const applyPanelLayout = useCallback(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    const layout = buildChartPanelLayout(activeSecondaryPanelsRef.current, secondaryPanelHeightRef.current);
    chart.applyOptions({ rightPriceScale: { borderColor: activeColorsRef.current.scaleBorder } });

    const hasRsi = activeSecondaryPanelsRef.current.includes("rsi");
    const hasVolume = activeSecondaryPanelsRef.current.includes("volume");
    const panes = chart.panes();
    const mainPane = panes[0];
    if (!mainPane) return;

    const mainFactor = Math.max(0.05, 1 - secondaryPanelHeightRef.current);
    const secondarySpace = Math.max(0.05, 1 - mainFactor);
    const rsiWeight = hasRsi ? 0.28 : 0;
    const volumeWeight = hasVolume ? 0.16 : 0;
    const totalWeight = Math.max(0.0001, rsiWeight + volumeWeight);

    mainPane.setStretchFactor(mainFactor);

    if (hasRsi) {
      const rsiPane = panes[1];
      if (rsiPane) {
        rsiPane.setStretchFactor(secondarySpace * (rsiWeight / totalWeight));
      }
    }

    if (hasVolume) {
      const volumePane = panes[hasRsi ? 2 : 1];
      if (volumePane) {
        volumePane.setStretchFactor(secondarySpace * (volumeWeight / totalWeight));
      }
    }
  }, []);

  const syncMovingAverageSeries = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const seriesMap = movingAverageSeriesRef.current;
    const indicators = activeIndicatorsRef.current.filter((indicator) => indicator.visible && indicator.type === 'sma');
    const activeIds = new Set(indicators.map((indicator) => indicator.id));

    for (const [id, series] of seriesMap) {
      if (!activeIds.has(id)) {
        chart.removeSeries(series);
        seriesMap.delete(id);
      }
    }

    indicators.forEach((indicator) => {
      const movingAverage = indicator as MovingAverageIndicator;
      let lineSeries = seriesMap.get(movingAverage.id);
      if (!lineSeries) {
        lineSeries = chart.addSeries(LineSeries, {
          color: movingAverage.color,
          lineWidth: movingAverage.lineWidth,
          title: showMaNameLabelsRef.current ? `SMA ${movingAverage.period}` : '',
          lastValueVisible: showMaPriceLabelsRef.current,
          priceLineVisible: false,
        });
        seriesMap.set(movingAverage.id, lineSeries);
      } else {
        lineSeries.applyOptions({
          color: movingAverage.color,
          lineWidth: movingAverage.lineWidth,
          title: showMaNameLabelsRef.current ? `SMA ${movingAverage.period}` : '',
          lastValueVisible: showMaPriceLabelsRef.current,
        });
      }

      lineSeries.setData(calculateSmaData(allCandlesRef.current, movingAverage.period));
    });
  }, []);

  const syncRsiSeries = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const seriesMap = rsiSeriesRef.current;
    const indicators = activeIndicatorsRef.current.filter((indicator) => indicator.visible && indicator.type === 'rsi') as RsiIndicator[];
    const activeIds = new Set(indicators.map((indicator) => indicator.id));

    for (const [id, series] of seriesMap) {
      if (!activeIds.has(id)) {
        chart.removeSeries(series);
        seriesMap.delete(id);
      }
    }

    if (indicators.length === 0) {
      if (rsiLevel70SeriesRef.current) {
        chart.removeSeries(rsiLevel70SeriesRef.current);
        rsiLevel70SeriesRef.current = null;
      }
      if (rsiLevel30SeriesRef.current) {
        chart.removeSeries(rsiLevel30SeriesRef.current);
        rsiLevel30SeriesRef.current = null;
      }
      return;
    }

    const levelData70 = allCandlesRef.current.map((candle) => ({ time: candle.time, value: 70 }));
    const levelData30 = allCandlesRef.current.map((candle) => ({ time: candle.time, value: 30 }));

    if (!rsiLevel70SeriesRef.current) {
      rsiLevel70SeriesRef.current = chart.addSeries(LineSeries, {
        priceScaleId: 'rsi',
        color: '#6b7280',
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      }, 1);
    }
    rsiLevel70SeriesRef.current.setData(levelData70);

    if (!rsiLevel30SeriesRef.current) {
      rsiLevel30SeriesRef.current = chart.addSeries(LineSeries, {
        priceScaleId: 'rsi',
        color: '#6b7280',
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      }, 1);
    }
    rsiLevel30SeriesRef.current.setData(levelData30);

    indicators.forEach((indicator) => {
      let lineSeries = seriesMap.get(indicator.id);
      if (!lineSeries) {
        lineSeries = chart.addSeries(LineSeries, {
          priceScaleId: 'rsi',
          color: indicator.color,
          lineWidth: indicator.lineWidth,
          title: `RSI ${indicator.period}`,
          lastValueVisible: true,
          priceLineVisible: false,
        }, 1);
        seriesMap.set(indicator.id, lineSeries);
      } else {
        lineSeries.applyOptions({
          color: indicator.color,
          lineWidth: indicator.lineWidth,
          title: `RSI ${indicator.period}`,
        });
      }

      lineSeries.setData(calculateRsiData(allCandlesRef.current, indicator.period));
    });
  }, []);

  const onLogicalChange = useCallback(() => {
    if (!chartRef.current) return;

    const logicalRange = chartRef.current.timeScale().getVisibleLogicalRange();
    if (!logicalRange || logicalRange.from >= 0) return;

    // Guards
    if (isLoadingMoreRef.current || !hasMoreDataRef.current || !earliestDatetimeRef.current) return;

    isLoadingMoreRef.current = true;

    StockDataService.getOlderCandles(
      symbolRef.current,
      timeframeRef.current,
      earliestDatetimeRef.current,
      PAGINATION_BATCH_LIMIT,
      symbolTypeRef.current
    )
      .then((olderCandles) => {
        if (olderCandles.length === 0) {
          hasMoreDataRef.current = false;
          return;
        }

        const olderChartCandles = olderCandles.map(candleToChart);

        // Prepend older data to existing buffer
        allCandlesRef.current = [...olderChartCandles, ...allCandlesRef.current];

        // Update cursor to the new earliest candle
        earliestDatetimeRef.current = olderCandles[0].datetime;

        // Update chart data
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(allCandlesRef.current);
        }
        // Update volume series if present
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(
            allCandlesRef.current
              .filter((c) => c.volume != null)
              .map((c) => ({ time: c.time, value: c.volume!, color: c.close >= c.open ? activeColorsRef.current.candleUp + '40' : activeColorsRef.current.candleDown + '40' }))
          );
        }
        syncMovingAverageSeries();
        syncRsiSeries();
      })
      .catch((error) => {
        console.error("Error loading older candles:", error);
      })
      .finally(() => {
        isLoadingMoreRef.current = false;
      });
  }, [syncMovingAverageSeries, syncRsiSeries]);

  // Effect 1: Crear el chart (solo cuando cambian width/height)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    const colors = activeColorsRef.current;

    const chart = createChart(container, {
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      width,
      height,
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: colors.crosshairLine, labelBackgroundColor: colors.crosshairLabel },
        horzLine: { color: colors.crosshairLine, labelBackgroundColor: colors.crosshairLabel },
      },
      rightPriceScale: { borderColor: colors.scaleBorder },
      timeScale: { borderColor: colors.scaleBorder },
      localization: {
        timeFormatter: (timestamp: number) => {
          // Formatear para el crosshair tooltip en zona horaria de NY
          const date = new Date(timestamp * 1000);

          // Para mes (mo): mostrar mes y año en el crosshair
          if (timeframe === "mo") {
            return date.toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              month: 'short',
              year: 'numeric',
            });
          }

          // Para día (d) y semana (w): mostrar día, mes y año
          if (timeframe === "d" || timeframe === "w") {
            return date.toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }

          // Para timeframes intradía (1m, 5m, 15m, 30m, h): mostrar fecha y hora
          return date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
        },
      },
    });

    chartRef.current = chart;
    setChartVersion((v) => v + 1);

    chart.timeScale().applyOptions({
      timeVisible: true,
    });

    // on logical range change
    chart.timeScale().subscribeVisibleLogicalRangeChange(onLogicalChange);

    // OHLCV overlay on crosshair hover
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        setHoveredCandle(null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current) as any;
      if (data) {
        const candle = allCandlesRef.current.find((c) => c.time === param.time);
        setHoveredCandle({ open: data.open, high: data.high, low: data.low, close: data.close, volume: candle?.volume });
      }
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: filledUpRef.current ? colors.candleUp : 'transparent',
      downColor: filledDownRef.current ? colors.candleDown : 'transparent',
      borderUpColor: colors.candleUp,
      borderDownColor: colors.candleDown,
      wickUpColor: colors.candleUp,
      wickDownColor: colors.candleDown,
      priceLineVisible: showLastPriceLineRef.current,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    candleSeriesRef.current = candlestickSeries;
    applyPanelLayout();
    syncMovingAverageSeries();
    syncRsiSeries();

    return () => {
      movingAverageSeriesRef.current.clear();
      rsiSeriesRef.current.clear();
      rsiLevel70SeriesRef.current = null;
      rsiLevel30SeriesRef.current = null;
      volumeSeriesRef.current = null;
      if (candleSeriesRef.current) {
        candleSeriesRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [timeframe, syncMovingAverageSeries, syncRsiSeries]);

  // Effect: Resize chart when dimensions change (without recreating it)
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ width, height });
    }
  }, [width, height]);

  // Effect: Apply color/fill changes reactively (without recreating the chart)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: activeColors.background },
        textColor: activeColors.text,
      },
      grid: {
        vertLines: { color: activeColors.grid },
        horzLines: { color: activeColors.grid },
      },
      crosshair: {
        vertLine: { color: activeColors.crosshairLine, labelBackgroundColor: activeColors.crosshairLabel },
        horzLine: { color: activeColors.crosshairLine, labelBackgroundColor: activeColors.crosshairLabel },
      },
      rightPriceScale: { borderColor: activeColors.scaleBorder },
      timeScale: { borderColor: activeColors.scaleBorder },
    });
    applyPanelLayout();

    candleSeriesRef.current.applyOptions({
      upColor: activeFilledUpCandle ? activeColors.candleUp : 'transparent',
      downColor: activeFilledDownCandle ? activeColors.candleDown : 'transparent',
      borderUpColor: activeColors.candleUp,
      borderDownColor: activeColors.candleDown,
      wickUpColor: activeColors.candleUp,
      wickDownColor: activeColors.candleDown,
      priceLineVisible: showLastPriceLine,
    });

    // Re-color volume bars with new template colors
    if (volumeSeriesRef.current && allCandlesRef.current.length > 0) {
      volumeSeriesRef.current.setData(
        allCandlesRef.current
          .filter((c) => c.volume != null)
          .map((c) => ({ time: c.time, value: c.volume!, color: c.close >= c.open ? activeColors.candleUp + '40' : activeColors.candleDown + '40' }))
      );
    }

    if (!showLastPriceLine && priceLineRef.current && candleSeriesRef.current) {
      candleSeriesRef.current.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    syncMovingAverageSeries();
    syncRsiSeries();
  }, [activeColors, activeFilledUpCandle, activeFilledDownCandle, showLastPriceLine, showMaNameLabels, showMaPriceLabels, applyPanelLayout, syncMovingAverageSeries, syncRsiSeries]);

  // Effect: manage indicator overlays
  useEffect(() => {
    syncMovingAverageSeries();
    syncRsiSeries();
    applyPanelLayout();
  }, [activeIndicators, showMaNameLabels, showMaPriceLabels, chartVersion, applyPanelLayout, syncMovingAverageSeries, syncRsiSeries]);

  // Effect: react to panel height resize changes
  useEffect(() => {
    applyPanelLayout();
  }, [activeSecondaryPanels, secondaryPanelHeight, panelHeightDraft, chartVersion, applyPanelLayout]);

  // Effect: Manage volume histogram series (stocks only)
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    const shouldShow = showVolume && symbolType === 'STOCK';

    if (shouldShow && !volumeSeriesRef.current) {
      const volumePaneIndex = activeSecondaryPanelsRef.current.includes("rsi") ? 2 : 1;
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      }, volumePaneIndex);
      volumeSeriesRef.current = volSeries;

      // Feed existing candle data into volume series
      const volData = allCandlesRef.current
        .filter((c) => c.volume != null)
        .map((c) => ({ time: c.time, value: c.volume!, color: c.close >= c.open ? activeColors.candleUp + '40' : activeColors.candleDown + '40' }));
      if (volData.length > 0) volSeries.setData(volData);
    } else if (!shouldShow && volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    applyPanelLayout();
  }, [showVolume, symbolType, activeColors.candleUp, activeColors.candleDown, chartVersion, applyPanelLayout]);

  // Effect 2: Actualizar localization cuando cambia el timeframe
  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.applyOptions({
      localization: {
        timeFormatter: (timestamp: number) => {
          // Formatear para el crosshair tooltip en zona horaria de NY
          const date = new Date(timestamp * 1000);

          // Para mes (mo): mostrar mes y año en el crosshair
          if (timeframe === "mo") {
            return date.toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              month: 'short',
              year: 'numeric',
            });
          }

          // Para día (d) y semana (w): mostrar día, mes y año
          if (timeframe === "d" || timeframe === "w") {
            return date.toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }

          // Para timeframes intradía (1m, 5m, 15m, 30m, h): mostrar fecha y hora
          return date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
        },
      },
    });
  }, [timeframe]);

  // Effect 3: Cargar datos y suscribirse (cuando cambian symbol/timeframe)
  useEffect(() => {
    if (!candleSeriesRef.current || !chartRef.current) return;

    let isSubscribed = true;

    // Reset pagination state on symbol/timeframe change
    allCandlesRef.current = [];
    hasMoreDataRef.current = true;
    earliestDatetimeRef.current = null;
    isLoadingMoreRef.current = false;

    // Set price format based on symbol type
    const series = candleSeriesRef.current;
    if (symbolType === 'FOREX') {
      series.applyOptions({
        priceFormat: { type: "price", precision: 5, minMove: 0.00001 },
      });
    } else if (symbolType === 'STOCK') {
      series.applyOptions({
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      });
    }
    // For CRYPTO, we set it dynamically once we see the price level

    let cryptoPrecisionSet = false;

    const unsubscribe = StockDataService.subscribeToStockDataWithRealtimePrice(
      symbol,
      timeframe,
      (newData, meta?: RealtimeMeta) => {
        if (!isSubscribed || !candleSeriesRef.current) return;

        const s = candleSeriesRef.current;

        if (newData.length > 0) {
          // Set crypto precision based on price level (once)
          if (symbolType === 'CRYPTO' && !cryptoPrecisionSet) {
            const lastClose = newData[newData.length - 1].close;
            const precision = lastClose >= 10 ? 3 : 5;
            const minMove = lastClose >= 10 ? 0.001 : 0.00001;
            s.applyOptions({
              priceFormat: { type: "price", precision, minMove },
            });
            cryptoPrecisionSet = true;
          }

          const subscriptionChartData = newData.map(candleToChart);

          if (allCandlesRef.current.length === 0) {
            // First load: initialize the buffer
            allCandlesRef.current = subscriptionChartData;
            earliestDatetimeRef.current = newData[0].datetime;
          } else {
            // Subsequent updates: replace only the subscription portion (tail)
            // Keep the older candles that were loaded via pagination
            const oldestSubscriptionTime = subscriptionChartData[0].time;
            const olderCandles = allCandlesRef.current.filter(
              (c) => c.time < oldestSubscriptionTime
            );
            allCandlesRef.current = [...olderCandles, ...subscriptionChartData];
          }

          s.setData(allCandlesRef.current);

          // Update volume series if present
          if (volumeSeriesRef.current) {
            const colors = activeColorsRef.current;
            volumeSeriesRef.current.setData(
              allCandlesRef.current
                .filter((c) => c.volume != null)
                .map((c) => ({ time: c.time, value: c.volume!, color: c.close >= c.open ? colors.candleUp + '40' : colors.candleDown + '40' }))
            );
          }
          syncMovingAverageSeries();
          syncRsiSeries();

          setLoading(false);
        }

        // Post-market price line management
        if (meta?.postMarketPrice != null && showLastPriceLineRef.current) {
          if (priceLineRef.current) {
            priceLineRef.current.applyOptions({ price: meta.postMarketPrice });
          } else {
            priceLineRef.current = s.createPriceLine({
              price: meta.postMarketPrice,
              color: '#888888',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'PM',
            });
          }
        } else if (priceLineRef.current) {
          s.removePriceLine(priceLineRef.current);
          priceLineRef.current = null;
        }
      },
      INITIAL_CANDLE_LIMIT,
      symbolType
    );

    return () => {
      isSubscribed = false;
      unsubscribe();
      // Only remove price line if series is still alive (not disposed by Effect 1)
      if (priceLineRef.current && candleSeriesRef.current) {
        candleSeriesRef.current.removePriceLine(priceLineRef.current);
      }
      priceLineRef.current = null;
      setLoading(true);
    };
  }, [symbol, symbolType, timeframe, syncMovingAverageSeries, syncRsiSeries]);

  const effectiveSecondaryPanelHeight = panelHeightDraft ?? secondaryPanelHeight;
  const currentPanelLayout = buildChartPanelLayout(activeSecondaryPanels, effectiveSecondaryPanelHeight);
  const dividerTopPercent = `${(1 - currentPanelLayout.main.bottom) * 100}%`;

  return (
    <div className="absolute inset-0 ">
      <div ref={chartContainerRef} className="w-full h-full" />
      {activeSecondaryPanels.length > 0 && (
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            resizeStartRef.current.active = true;
            setIsResizingPanels(true);
            const value = getSecondaryHeightFromPointer(e.clientY);
            if (value != null) setPanelHeightDraft(value);
          }}
          className={[
            "absolute left-0 right-0 z-30 cursor-row-resize [touch-action:none]",
            isResizingPanels ? "h-6 -mt-3" : "h-5 -mt-2.5",
          ].join(" ")}
          style={{ top: dividerTopPercent }}
          aria-label="Resize panels"
          role="separator"
        >
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-zinc-500/60" />
        </div>
      )}
      <DrawingManager
        chartRef={chartRef}
        seriesRef={candleSeriesRef}
        allCandlesRef={allCandlesRef}
        chartVersion={chartVersion}
      />
      {hoveredCandle && (
        <div
          className="absolute top-0 left-0 z-10 pointer-events-none pl-4 pt-10"
          style={{ color: activeColors.text, fontSize: 15 }}
        >
          <div>
            O: {formatPrice(hoveredCandle.open, symbolType)}
            &nbsp;&nbsp;H: {formatPrice(hoveredCandle.high, symbolType)}
            &nbsp;&nbsp;L: {formatPrice(hoveredCandle.low, symbolType)}
            &nbsp;&nbsp;C: {formatPrice(hoveredCandle.close, symbolType)}
          </div>
          {hoveredCandle.volume != null && (
            <div>V: {formatVolume(hoveredCandle.volume)}</div>
          )}
        </div>
      )}
      <ChartSkeleton show={loading} />
    </div>
  );
};

export default Chart;
