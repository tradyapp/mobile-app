/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDrawingStore } from '@/stores/drawingStore';
import type { Drawing, DrawingPoint } from '@/stores/drawingStore';
import { useChartStore } from '@/stores/chartStore';
import { useDrawingTemplateStore, getToolCategory } from '@/stores/drawingTemplateStore';
import { DrawingsPrimitive } from './primitives/DrawingsPrimitive';
import { screenToDrawingPoint, type ChartCandle } from './primitives/coordinateUtils';
import { getTimeframeConversionFactor } from './primitives/timeframeConversion';

interface DrawingManagerProps {
  chartRef: React.RefObject<any | null>;
  seriesRef: React.RefObject<any>;
  allCandlesRef: React.RefObject<ChartCandle[]>;
  chartVersion: number;
}

interface DragState {
  mode: 'vertex' | 'body';
  vertexIndex: number;
  drawingId: string;
  startLogical: number;
  startPrice: number;
  originalPoints: DrawingPoint[];
}

function getTouchCoords(e: TouchEvent): { clientX: number; clientY: number } | null {
  const touch = e.touches[0] ?? e.changedTouches[0];
  if (!touch) return null;
  return { clientX: touch.clientX, clientY: touch.clientY };
}

export default function DrawingManager({
  chartRef,
  seriesRef,
  allCandlesRef,
  chartVersion,
}: DrawingManagerProps) {
  const { symbol, symbolType, timeframe } = useChartStore();
  const {
    activeTool,
    selectedDrawingId,
    setActiveTool,
    addDrawing,
    updateDrawing,
    persistDrawing,
    loadDrawingsForSymbol,
    unsubscribeDrawings,
    setPendingDrawing,
    setRequestUpdate,
  } = useDrawingStore();

  const primitiveRef = useRef<DrawingsPrimitive | null>(null);
  const isDrawingRef = useRef(false);
  const interactionRef = useRef<HTMLDivElement>(null);
  const activeToolRef = useRef(activeTool);
  const selectedDrawingIdRef = useRef(selectedDrawingId);
  const dragStateRef = useRef<DragState | null>(null);
  const lastSelectRef = useRef<{ id: string; time: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleTapPendingRef = useRef(false);
  const lastPolygonTapRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    selectedDrawingIdRef.current = selectedDrawingId;
  }, [selectedDrawingId]);

  // Subscribe to all drawings (across all timeframes) when symbol changes
  useEffect(() => {
    loadDrawingsForSymbol(symbol);
    return () => unsubscribeDrawings();
  }, [symbol, loadDrawingsForSymbol, unsubscribeDrawings]);

  // Primitive lifecycle: create, attach to series, wire requestUpdate
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const store = useDrawingStore.getState;
    const chartStore = useChartStore.getState;
    const primitive = new DrawingsPrimitive(
      () => store().drawings,
      () => store().pendingDrawing,
      () => allCandlesRef.current ?? [],
      () => store().selectedDrawingId,
      () => chartStore().timeframe,
      () => chartStore().symbolType,
    );

    series.attachPrimitive(primitive);
    primitiveRef.current = primitive;

    // Wire requestUpdate so store mutations trigger chart repaint
    setRequestUpdate(() => primitive.requestUpdate());

    // Subscribe to click/tap for selection
    const onClick = (param: { point?: { x: number; y: number } }) => {
      if (!param.point || store().activeTool) return;
      // Don't change selection when we just finished a drag
      if (store().selectedDrawingId) return;
      const hitId = primitive.hitTestAt(param.point.x, param.point.y);
      store().setSelectedDrawingId(hitId);
      // Record selection time for double-tap detection on overlay
      if (hitId) {
        lastSelectRef.current = { id: hitId, time: Date.now() };
      }
    };
    chart.subscribeClick(onClick);

    return () => {
      // Only detach if this is the same chart we attached to
      // (if chart was recreated, chart.remove() already cleaned everything up)
      if (chartRef.current === chart) {
        chart.unsubscribeClick(onClick);
        series.detachPrimitive(primitive);
      }
      primitiveRef.current = null;
      setRequestUpdate(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartVersion]);

  // Disable/enable chart scrolling and scaling when tool is active or drawing is selected
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (activeTool || selectedDrawingId) {
      chart.applyOptions({ handleScroll: false, handleScale: false });
    } else {
      chart.applyOptions({ handleScroll: true, handleScale: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, selectedDrawingId, chartVersion]);

  // Keyboard shortcuts: Delete drawing, Space to open drawings drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      const store = useDrawingStore.getState();

      // Delete / Backspace — remove selected drawing
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selId = selectedDrawingIdRef.current;
        if (!selId) return;
        if (store.styleDrawerRequested || store.drawingsDrawerRequested) return;
        e.preventDefault();
        store.removeDrawing(selId);
        store.setSelectedDrawingId(null);
        return;
      }

      // Space — open drawings drawer
      if (e.key === ' ') {
        if (store.styleDrawerRequested || store.drawingsDrawerRequested) return;
        e.preventDefault();
        store.setDrawingsDrawerRequested(true);
        return;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const getAnchorDatetime = useCallback((): string => {
    const allCandles = allCandlesRef.current;
    if (!allCandles || allCandles.length === 0) return '';
    const lastCandle = allCandles[allCandles.length - 1];
    const date = new Date(lastCandle.time * 1000);
    return date.toISOString();
  }, [allCandlesRef]);

  // ── Creation handlers ──

  const finishPolygon = useCallback(() => {
    const pending = useDrawingStore.getState().pendingDrawing;
    if (!pending || pending.type !== 'polygon') return;

    // Remove the preview (last) point
    const confirmed = pending.points.slice(0, -1);
    if (confirmed.length < 3) {
      // Not enough vertices — discard
      setPendingDrawing(null);
      isDrawingRef.current = false;
      setActiveTool(null);
      return;
    }

    addDrawing({ ...pending, points: confirmed });
    setPendingDrawing(null);
    isDrawingRef.current = false;
    setActiveTool(null);
    lastPolygonTapRef.current = 0;
  }, [addDrawing, setPendingDrawing, setActiveTool]);

  const startDrawing = useCallback(
    (clientX: number, clientY: number, el: HTMLElement) => {
      const tool = activeToolRef.current;
      if (!tool) return;

      const chart = chartRef.current;
      const series = seriesRef.current;
      const allCandles = allCandlesRef.current;
      if (!chart || !series || !allCandles || allCandles.length === 0) return;

      const rect = el.getBoundingClientRect();
      const pixelX = clientX - rect.left;
      const pixelY = clientY - rect.top;
      const point = screenToDrawingPoint(pixelX, pixelY, chart, series, allCandles);
      if (!point) return;

      // Text: single-tap placement, no drag phase
      if (tool === 'text') {
        const tpl = useDrawingTemplateStore.getState().getDefaultTemplate('text');
        const newDrawing: Drawing = {
          id: crypto.randomUUID(),
          type: 'text',
          symbol,
          timeframe,
          anchorDatetime: getAnchorDatetime(),
          points: [point],
          color: tpl.color,
          strokeWidth: 1,
          opacity: tpl.opacity,
          textContent: 'Text',
          fontSize: tpl.category === 'text' ? tpl.fontSize : 2,
          ...(tpl.category === 'text' ? { textHAlign: tpl.textHAlign, textVAlign: tpl.textVAlign } : {}),
        };
        addDrawing(newDrawing);
        setPendingDrawing(null);
        setActiveTool(null);
        return;
      }

      // Polygon multi-tap logic
      if (tool === 'polygon') {
        const pending = useDrawingStore.getState().pendingDrawing;
        const now = Date.now();

        if (pending && pending.type === 'polygon') {
          // Check double-tap to finish
          if (now - lastPolygonTapRef.current < 350) {
            finishPolygon();
            return;
          }
          // Insert new confirmed vertex before the preview point
          lastPolygonTapRef.current = now;
          const pts = [...pending.points];
          pts.splice(pts.length - 1, 0, point);
          setPendingDrawing({ ...pending, points: pts });
          return;
        }

        // First tap — create polygon with [vertex, preview]
        lastPolygonTapRef.current = now;
        isDrawingRef.current = true;
        const polyTpl = useDrawingTemplateStore.getState().getDefaultTemplate('shape');
        const newDrawing: Drawing = {
          id: crypto.randomUUID(),
          type: 'polygon',
          symbol,
          timeframe,
          anchorDatetime: getAnchorDatetime(),
          points: [point, { ...point }],
          color: polyTpl.color,
          strokeWidth: polyTpl.category !== 'text' ? polyTpl.strokeWidth : 3,
          opacity: polyTpl.opacity,
          strokeDash: polyTpl.category !== 'text' ? polyTpl.strokeDash : 'solid',
          ...(polyTpl.category === 'shape' ? { fill: polyTpl.fill } : {}),
        };
        setPendingDrawing(newDrawing);
        return;
      }

      isDrawingRef.current = true;

      const category = getToolCategory(tool);
      const tpl = useDrawingTemplateStore.getState().getDefaultTemplate(category);
      const newDrawing: Drawing = {
        id: crypto.randomUUID(),
        type: tool,
        symbol,
        timeframe,
        anchorDatetime: getAnchorDatetime(),
        points: tool === 'freehand'
          ? [point]
          : (tool === 'horizontal_line' || tool === 'vertical_line') ? [point] : [point, { ...point }],
        color: tpl.color,
        strokeWidth: tpl.category !== 'text' ? tpl.strokeWidth : 3,
        opacity: tpl.opacity,
        strokeDash: tpl.category !== 'text' ? tpl.strokeDash : 'solid',
        ...(tpl.category === 'shape' ? { fill: tpl.fill } : {}),
      };

      setPendingDrawing(newDrawing);
    },
    [symbol, timeframe, chartRef, seriesRef, allCandlesRef, getAnchorDatetime, setPendingDrawing, setActiveTool, addDrawing, finishPolygon]
  );

  const moveDrawing = useCallback(
    (clientX: number, clientY: number, el: HTMLElement) => {
      if (!isDrawingRef.current) return;

      const chart = chartRef.current;
      const series = seriesRef.current;
      const allCandles = allCandlesRef.current;
      if (!chart || !series || !allCandles || allCandles.length === 0) return;

      const rect = el.getBoundingClientRect();
      const pixelX = clientX - rect.left;
      const pixelY = clientY - rect.top;
      const point = screenToDrawingPoint(pixelX, pixelY, chart, series, allCandles);
      if (!point) return;

      const prev = useDrawingStore.getState().pendingDrawing;
      if (!prev) return;

      const updatedPoints = [...prev.points];
      if (prev.type === 'freehand') {
        updatedPoints.push(point);
      } else if (prev.type === 'horizontal_line' || prev.type === 'vertical_line') {
        updatedPoints[0] = point;
      } else if (prev.type === 'polygon') {
        updatedPoints[updatedPoints.length - 1] = point;
      } else {
        updatedPoints[1] = point;
      }
      setPendingDrawing({ ...prev, points: updatedPoints });
    },
    [chartRef, seriesRef, allCandlesRef, setPendingDrawing]
  );

  const finishDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;

    const pending = useDrawingStore.getState().pendingDrawing;
    // Polygon stays active across touch cycles — don't finish on touchend
    if (pending?.type === 'polygon') return;

    isDrawingRef.current = false;
    if (pending) {
      addDrawing(pending);
      setPendingDrawing(null);
    }
    setActiveTool(null);
  }, [addDrawing, setPendingDrawing, setActiveTool]);

  // ── Editing handlers ──

  const startEditing = useCallback(
    (clientX: number, clientY: number, el: HTMLElement) => {
      const selId = selectedDrawingIdRef.current;
      const primitive = primitiveRef.current;
      if (!selId || !primitive) return;

      const chart = chartRef.current;
      const series = seriesRef.current;
      const allCandles = allCandlesRef.current;
      if (!chart || !series || !allCandles || allCandles.length === 0) return;

      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;

      const hitResult = primitive.hitTestDetailAt(px, py, selId);
      if (!hitResult) {
        // Missed the selected drawing — deselect
        useDrawingStore.getState().setSelectedDrawingId(null);
        lastSelectRef.current = null;
        return;
      }

      // Double-tap candidate: mark as pending, confirm on quick release (finishEditing)
      const DOUBLE_TAP_MS = 400;
      const now = Date.now();
      const last = lastSelectRef.current;
      doubleTapPendingRef.current = !!(last && last.id === selId && now - last.time < DOUBLE_TAP_MS);
      lastSelectRef.current = { id: selId, time: now };

      // Long press: open style drawer after 500ms if no drag occurs
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        dragStateRef.current = null;
        useDrawingStore.getState().setStyleDrawerRequested(true);
      }, 500);

      // Convert press position to logical coordinates for delta calculation
      const pressPoint = screenToDrawingPoint(px, py, chart, series, allCandles);
      if (!pressPoint) return;

      const drawing = useDrawingStore.getState().drawings.find(d => d.id === selId);
      if (!drawing) return;

      dragStateRef.current = {
        mode: hitResult.type,
        vertexIndex: hitResult.type === 'vertex' ? hitResult.index : 0,
        drawingId: selId,
        startLogical: pressPoint.logicalOffset,
        startPrice: pressPoint.price,
        originalPoints: drawing.points.map(p => ({ ...p })),
      };
    },
    [chartRef, seriesRef, allCandlesRef]
  );

  const moveEditing = useCallback(
    (clientX: number, clientY: number, el: HTMLElement) => {
      // Cancel long press and double-tap on any movement
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      doubleTapPendingRef.current = false;
      const drag = dragStateRef.current;
      if (!drag) return;

      const chart = chartRef.current;
      const series = seriesRef.current;
      const allCandles = allCandlesRef.current;
      if (!chart || !series || !allCandles || allCandles.length === 0) return;

      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const current = screenToDrawingPoint(px, py, chart, series, allCandles);
      if (!current) return;

      const drawing = useDrawingStore.getState().drawings.find(d => d.id === drag.drawingId);
      if (!drawing) return;

      // Convert the logical delta from current TF units back to the drawing's original TF units
      const { timeframe: currentTF, symbolType: symType } = useChartStore.getState();
      const factor = getTimeframeConversionFactor(drawing.timeframe, currentTF, symType);
      const deltaLogical = (current.logicalOffset - drag.startLogical) / factor;
      const deltaPrice = current.price - drag.startPrice;

      let newPoints: DrawingPoint[];

      if (drag.mode === 'vertex') {
        const isBoxShape = drawing.type === 'rectangle' || drawing.type === 'ellipse';

        if (isBoxShape && drag.originalPoints.length === 2) {
          // Virtual vertex mapping for 4-corner shapes:
          // v0=(p0.x,p0.y)  v1=(p1.x,p0.y)  v2=(p1.x,p1.y)  v3=(p0.x,p1.y)
          const vIdx = drag.vertexIndex;
          const offsetIdx = (vIdx === 0 || vIdx === 3) ? 0 : 1;
          const priceIdx = (vIdx === 0 || vIdx === 1) ? 0 : 1;
          newPoints = drag.originalPoints.map((p, i) => ({
            logicalOffset: i === offsetIdx ? p.logicalOffset + deltaLogical : p.logicalOffset,
            price: i === priceIdx ? p.price + deltaPrice : p.price,
          }));
        } else {
          // Simple 1:1 vertex drag (line, triangle, etc.)
          newPoints = drag.originalPoints.map((p, i) => {
            if (i !== drag.vertexIndex) return p;
            return {
              logicalOffset: p.logicalOffset + deltaLogical,
              price: p.price + deltaPrice,
            };
          });
        }
      } else {
        // Body drag — apply delta to all points, with shape-specific constraints
        newPoints = drag.originalPoints.map(p => {
          const newOffset = drawing.type === 'horizontal_line'
            ? p.logicalOffset
            : p.logicalOffset + deltaLogical;
          const newPrice = drawing.type === 'vertical_line'
            ? p.price
            : p.price + deltaPrice;
          return { logicalOffset: newOffset, price: newPrice };
        });
      }

      updateDrawing(drag.drawingId, newPoints);
    },
    [chartRef, seriesRef, allCandlesRef, updateDrawing]
  );

  const finishEditing = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Double-tap confirmed: quick release without drag → open style drawer
    if (doubleTapPendingRef.current) {
      doubleTapPendingRef.current = false;
      dragStateRef.current = null;
      lastSelectRef.current = null;
      useDrawingStore.getState().setStyleDrawerRequested(true);
      return;
    }
    const drag = dragStateRef.current;
    if (drag) {
      persistDrawing(drag.drawingId);
      dragStateRef.current = null;
    }
  }, [persistDrawing]);

  // Register native touch/mouse event listeners
  useEffect(() => {
    const el = interactionRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const coords = getTouchCoords(e);
      if (!coords) return;

      if (activeToolRef.current) {
        e.preventDefault();
        startDrawing(coords.clientX, coords.clientY, el);
      } else if (selectedDrawingIdRef.current) {
        e.preventDefault();
        startEditing(coords.clientX, coords.clientY, el);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const coords = getTouchCoords(e);
      if (!coords) return;

      if (isDrawingRef.current) {
        e.preventDefault();
        moveDrawing(coords.clientX, coords.clientY, el);
      } else if (dragStateRef.current) {
        e.preventDefault();
        moveEditing(coords.clientX, coords.clientY, el);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isDrawingRef.current) {
        e.preventDefault();
        finishDrawing();
      } else if (dragStateRef.current) {
        e.preventDefault();
        finishEditing();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (activeToolRef.current) {
        e.preventDefault();
        startDrawing(e.clientX, e.clientY, el);
      } else if (selectedDrawingIdRef.current) {
        e.preventDefault();
        startEditing(e.clientX, e.clientY, el);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDrawingRef.current) {
        moveDrawing(e.clientX, e.clientY, el);
      } else if (dragStateRef.current) {
        moveEditing(e.clientX, e.clientY, el);
      }
    };

    const onMouseUp = () => {
      if (isDrawingRef.current) {
        finishDrawing();
      } else if (dragStateRef.current) {
        finishEditing();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
    };
  }, [startDrawing, moveDrawing, finishDrawing, startEditing, moveEditing, finishEditing]);

  const overlayActive = !!(activeTool || selectedDrawingId);

  return (
    <div
      ref={interactionRef}
      className="absolute inset-0"
      style={{
        pointerEvents: overlayActive ? 'auto' : 'none',
        touchAction: overlayActive ? 'none' : 'auto',
        cursor: activeTool ? 'crosshair' : 'default',
        zIndex: 4,
      }}
    />
  );
}
