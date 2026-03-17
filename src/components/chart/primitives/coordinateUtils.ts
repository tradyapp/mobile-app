/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Drawing, DrawingPoint } from '@/stores/drawingStore';
import type { SymbolType } from '@/stores/chartStore';
import { getTimeframeConversionFactor, snapDatetimeToTimeframe } from './timeframeConversion';

export interface ChartCandle {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export function parseAnchorToTimestamp(anchorDatetime: string): number {
  return Date.parse(anchorDatetime.replace(' ', 'T')) / 1000;
}

/**
 * Find the candle whose time is closest to targetTime.
 * Uses binary search for O(log n) performance.
 * Returns -1 only if the array is empty.
 */
function findAnchorIndex(candles: ChartCandle[], targetTime: number): number {
  const len = candles.length;
  if (len === 0) return -1;

  let lo = 0;
  let hi = len - 1;

  // Binary search: narrow to the two candidates bracketing targetTime
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (candles[mid].time < targetTime) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  // lo === hi → first candle with time >= targetTime (or last candle if all < target)
  if (lo === 0) return 0;
  if (candles[lo].time === targetTime) return lo;

  // Compare the candidate (lo) with the one before it (lo-1)
  const diffBefore = targetTime - candles[lo - 1].time;
  const diffAfter = candles[lo].time - targetTime;
  return diffBefore <= diffAfter ? lo - 1 : lo;
}

export function drawingToScreen(
  drawing: Drawing,
  chart: any,
  series: any,
  allCandles: ChartCandle[],
  currentTimeframe: string,
  symbolType: SymbolType,
): ScreenPoint[] | null {
  const snappedDatetime = snapDatetimeToTimeframe(drawing.anchorDatetime, currentTimeframe);
  const anchorTime = parseAnchorToTimestamp(snappedDatetime);
  const anchorIndex = findAnchorIndex(allCandles, anchorTime);
  if (anchorIndex === -1) return null;

  const factor = getTimeframeConversionFactor(drawing.timeframe, currentTimeframe, symbolType);
  const timeScale = chart.timeScale();
  const points: ScreenPoint[] = [];

  for (const pt of drawing.points) {
    const logicalIndex = Math.round(anchorIndex + pt.logicalOffset * factor);
    const px = timeScale.logicalToCoordinate(logicalIndex);
    const py = series.priceToCoordinate(pt.price);
    if (px === null || py === null) return null;
    points.push({ x: px, y: py });
  }

  return points;
}

export function screenToDrawingPoint(
  pixelX: number,
  pixelY: number,
  chart: any,
  series: any,
  allCandles: ChartCandle[]
): DrawingPoint | null {
  if (allCandles.length === 0) return null;

  const logicalIndex = chart.timeScale().coordinateToLogical(pixelX);
  const price = series.coordinateToPrice(pixelY);
  if (logicalIndex === null || price === null) return null;

  const lastCandleIndex = allCandles.length - 1;
  const logicalOffset = logicalIndex - lastCandleIndex;

  return { logicalOffset, price };
}
