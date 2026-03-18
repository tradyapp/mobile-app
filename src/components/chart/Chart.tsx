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
import { useChartSettingsStore, type MovingAverageIndicator } from "@/stores/chartSettingsStore";
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

const Chart = ({ width, height }: ChartProps) => {
  const { symbol, symbolType, timeframe } = useChartStore();
  const activeColors = useChartSettingsStore((s) => s.activeColors);
  const activeFilledUpCandle = useChartSettingsStore((s) => s.activeFilledUpCandle);
  const activeFilledDownCandle = useChartSettingsStore((s) => s.activeFilledDownCandle);
  const showVolume = useChartSettingsStore((s) => s.preferences.showVolume);
  const activeIndicators = useChartSettingsStore((s) => s.preferences.indicators);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const indicatorSeriesRef = useRef<Map<string, any>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [chartVersion, setChartVersion] = useState(0);
  const [hoveredCandle, setHoveredCandle] = useState<HoveredCandle | null>(null);

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

  // Refs for latest colors/fill (read during chart creation without adding to deps)
  const activeColorsRef = useRef(activeColors);
  const filledUpRef = useRef(activeFilledUpCandle);
  const filledDownRef = useRef(activeFilledDownCandle);
  const activeIndicatorsRef = useRef(activeIndicators);

  // Keep refs in sync with current values
  useEffect(() => {
    symbolRef.current = symbol;
    symbolTypeRef.current = symbolType;
    timeframeRef.current = timeframe;
    activeColorsRef.current = activeColors;
    filledUpRef.current = activeFilledUpCandle;
    filledDownRef.current = activeFilledDownCandle;
    activeIndicatorsRef.current = activeIndicators;
  }, [symbol, symbolType, timeframe, activeColors, activeFilledUpCandle, activeFilledDownCandle, activeIndicators]);

  const syncIndicatorSeries = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const seriesMap = indicatorSeriesRef.current;
    const indicators = activeIndicatorsRef.current.filter((indicator) => indicator.visible);
    const activeIds = new Set(indicators.map((indicator) => indicator.id));

    for (const [id, series] of seriesMap) {
      if (!activeIds.has(id)) {
        chart.removeSeries(series);
        seriesMap.delete(id);
      }
    }

    indicators.forEach((indicator) => {
      if (indicator.type !== 'sma') return;

      const movingAverage = indicator as MovingAverageIndicator;
      let lineSeries = seriesMap.get(movingAverage.id);
      if (!lineSeries) {
        lineSeries = chart.addSeries(LineSeries, {
          color: movingAverage.color,
          lineWidth: movingAverage.lineWidth,
          title: `SMA ${movingAverage.period}`,
          lastValueVisible: true,
          priceLineVisible: false,
        });
        seriesMap.set(movingAverage.id, lineSeries);
      } else {
        lineSeries.applyOptions({
          color: movingAverage.color,
          lineWidth: movingAverage.lineWidth,
          title: `SMA ${movingAverage.period}`,
        });
      }

      lineSeries.setData(calculateSmaData(allCandlesRef.current, movingAverage.period));
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
      200,
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
        syncIndicatorSeries();
      })
      .catch((error) => {
        console.error("Error loading older candles:", error);
      })
      .finally(() => {
        isLoadingMoreRef.current = false;
      });
  }, []);

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
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    candleSeriesRef.current = candlestickSeries;
    syncIndicatorSeries();

    return () => {
      indicatorSeriesRef.current.clear();
      volumeSeriesRef.current = null;
      if (candleSeriesRef.current) {
        candleSeriesRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [timeframe]);

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

    candleSeriesRef.current.applyOptions({
      upColor: activeFilledUpCandle ? activeColors.candleUp : 'transparent',
      downColor: activeFilledDownCandle ? activeColors.candleDown : 'transparent',
      borderUpColor: activeColors.candleUp,
      borderDownColor: activeColors.candleDown,
      wickUpColor: activeColors.candleUp,
      wickDownColor: activeColors.candleDown,
    });

    // Re-color volume bars with new template colors
    if (volumeSeriesRef.current && allCandlesRef.current.length > 0) {
      volumeSeriesRef.current.setData(
        allCandlesRef.current
          .filter((c) => c.volume != null)
          .map((c) => ({ time: c.time, value: c.volume!, color: c.close >= c.open ? activeColors.candleUp + '40' : activeColors.candleDown + '40' }))
      );
    }

    syncIndicatorSeries();
  }, [activeColors, activeFilledUpCandle, activeFilledDownCandle]);

  // Effect: manage indicator overlays
  useEffect(() => {
    syncIndicatorSeries();
  }, [activeIndicators, chartVersion, syncIndicatorSeries]);

  // Effect: Manage volume histogram series (stocks only)
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    const shouldShow = showVolume && symbolType === 'STOCK';

    if (shouldShow && !volumeSeriesRef.current) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
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
  }, [showVolume, symbolType, activeColors.candleUp, activeColors.candleDown, chartVersion]);

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
          syncIndicatorSeries();

          setLoading(false);
        }

        // Post-market price line management
        if (meta?.postMarketPrice != null) {
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
      200,
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
  }, [symbol, symbolType, timeframe, syncIndicatorSeries]);

  return (
    <div className="absolute inset-0 ">
      <div ref={chartContainerRef} className="w-full h-full" />
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
