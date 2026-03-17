/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ISeriesPrimitive, SeriesAttachedParameter, IPrimitivePaneView, Time, PrimitiveHoveredItem } from 'lightweight-charts';
import type { Drawing } from '@/stores/drawingStore';
import type { SymbolType } from '@/stores/chartStore';
import { DrawingsPaneView } from './DrawingsPaneView';
import { drawingToScreen, type ChartCandle } from './coordinateUtils';
import { hitTestDrawing, hitTestDrawingDetail, type HitTestResult } from './hitTestUtils';
import type { DrawingRenderItem } from './DrawingsPaneRenderer';

export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private _chart: any = null;
  private _series: any = null;
  private _requestUpdateFn: (() => void) | null = null;
  private _paneView = new DrawingsPaneView();
  private _paneViews: readonly IPrimitivePaneView[] = [this._paneView];

  private _getDrawings: () => Drawing[];
  private _getPendingDrawing: () => Drawing | null;
  private _getAllCandles: () => ChartCandle[];
  private _getSelectedId: () => string | null;
  private _getCurrentTimeframe: () => string;
  private _getSymbolType: () => SymbolType;

  private _hoveredId: string | null = null;
  private _currentItems: DrawingRenderItem[] = [];

  constructor(
    getDrawings: () => Drawing[],
    getPendingDrawing: () => Drawing | null,
    getAllCandles: () => ChartCandle[],
    getSelectedId: () => string | null,
    getCurrentTimeframe: () => string,
    getSymbolType: () => SymbolType,
  ) {
    this._getDrawings = getDrawings;
    this._getPendingDrawing = getPendingDrawing;
    this._getAllCandles = getAllCandles;
    this._getSelectedId = getSelectedId;
    this._getCurrentTimeframe = getCurrentTimeframe;
    this._getSymbolType = getSymbolType;
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdateFn = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdateFn = null;
  }

  requestUpdate(): void {
    this._requestUpdateFn?.();
  }

  /** Used by subscribeClick — returns drawing id at (x, y) or null */
  hitTestAt(x: number, y: number): string | null {
    for (let i = this._currentItems.length - 1; i >= 0; i--) {
      const item = this._currentItems[i];
      if (hitTestDrawing(x, y, item.drawing, item.screenPoints, item.pixelsPerBar)) {
        return item.drawing.id;
      }
    }
    return null;
  }

  /** Used by DrawingManager editing — returns vertex/body hit or null */
  hitTestDetailAt(x: number, y: number, drawingId: string): HitTestResult {
    const item = this._currentItems.find(i => i.drawing.id === drawingId);
    if (!item) return null;
    return hitTestDrawingDetail(x, y, item.drawing, item.screenPoints, item.pixelsPerBar);
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    for (let i = this._currentItems.length - 1; i >= 0; i--) {
      const item = this._currentItems[i];
      if (hitTestDrawing(x, y, item.drawing, item.screenPoints, item.pixelsPerBar)) {
        if (this._hoveredId !== item.drawing.id) {
          this._hoveredId = item.drawing.id;
          this.requestUpdate();
        }
        return {
          cursorStyle: 'pointer',
          externalId: item.drawing.id,
          zOrder: 'top',
        };
      }
    }

    if (this._hoveredId !== null) {
      this._hoveredId = null;
      this.requestUpdate();
    }
    return null;
  }

  updateAllViews(): void {
    if (!this._chart || !this._series) return;

    const allCandles = this._getAllCandles();
    if (allCandles.length === 0) {
      this._currentItems = [];
      this._paneView.update([]);
      return;
    }

    const selectedId = this._getSelectedId();
    const items: DrawingRenderItem[] = [];

    // Compute pixels-per-bar for text scaling
    const ts = this._chart.timeScale();
    const px0 = ts.logicalToCoordinate(0);
    const px1 = ts.logicalToCoordinate(1);
    const pixelsPerBar = (px0 !== null && px1 !== null) ? Math.abs(px1 - px0) : 8;

    const currentTF = this._getCurrentTimeframe();
    const symType = this._getSymbolType();

    const drawings = this._getDrawings();
    for (const drawing of drawings) {
      const screenPoints = drawingToScreen(drawing, this._chart, this._series, allCandles, currentTF, symType);
      if (screenPoints) {
        items.push({
          drawing,
          screenPoints,
          isHovered: drawing.id === this._hoveredId,
          isSelected: drawing.id === selectedId,
          pixelsPerBar,
        });
      }
    }

    const pending = this._getPendingDrawing();
    if (pending) {
      const screenPoints = drawingToScreen(pending, this._chart, this._series, allCandles, currentTF, symType);
      if (screenPoints) {
        items.push({ drawing: pending, screenPoints, isHovered: false, isSelected: false, pixelsPerBar });
      }
    }

    this._currentItems = items;
    this._paneView.update(items);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }
}
