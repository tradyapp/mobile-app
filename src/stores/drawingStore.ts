import { create } from 'zustand';
import { DrawingStorageService, type Unsubscribe } from '@/services/DrawingStorageService';

let _unsubscribeDrawings: Unsubscribe | null = null;
const _styleDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const STYLE_DEBOUNCE_MS = 1000;

export type DrawingTool = 'line' | 'horizontal_line' | 'vertical_line' | 'rectangle' | 'ellipse' | 'triangle' | 'inverted_triangle' | 'polygon' | 'freehand' | 'text';
export type StrokeDash = 'solid' | 'dashed' | 'dotted';
export type FillType = 'none' | 'solid' | 'gradient';
export type GradientDirection = 'down' | 'right' | 'left' | 'up';
export type TextHAlign = 'left' | 'center' | 'right';
export type TextVAlign = 'top' | 'middle' | 'bottom';

export interface DrawingFill {
  type: FillType;
  color?: string;
  opacity?: number;              // solid fill opacity, 0–1 (default 0.2)
  gradientColor1?: string;
  gradientColor2?: string;
  gradientOpacity1?: number;     // gradient color 1 opacity, 0–1 (default 0.2)
  gradientOpacity2?: number;     // gradient color 2 opacity, 0–1 (default 0)
  gradientDirection?: GradientDirection;
}

export interface DrawingPoint {
  logicalOffset: number; // bars from anchor (0 = anchor, negative = left)
  price: number;
}

export interface Drawing {
  id: string;
  type: DrawingTool;
  symbol: string;
  timeframe: string;
  anchorDatetime: string; // datetime of last candle when created
  points: DrawingPoint[]; // 1 point for horizontal_line, 2 for line/rectangle
  color: string;
  strokeWidth: number;
  opacity?: number;      // 0.1–1.0, default 1
  strokeDash?: StrokeDash; // default 'solid'
  fill?: DrawingFill;
  textContent?: string;
  fontSize?: number;
  textHAlign?: TextHAlign;
  textVAlign?: TextVAlign;
}

interface DrawingState {
  activeTool: DrawingTool | null;
  drawings: Drawing[];
  pendingDrawing: Drawing | null;
  selectedDrawingId: string | null;
  styleDrawerRequested: boolean;
  drawingsDrawerRequested: boolean;
  _requestUpdate: (() => void) | null;
  setActiveTool: (tool: DrawingTool | null) => void;
  addDrawing: (drawing: Drawing) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: (symbol: string) => void;
  loadDrawingsForSymbol: (symbol: string) => void;
  unsubscribeDrawings: () => void;
  setPendingDrawing: (drawing: Drawing | null) => void;
  updateDrawing: (id: string, points: DrawingPoint[]) => void;
  persistDrawing: (id: string) => void;
  updateDrawingStyle: (id: string, style: { color?: string; strokeWidth?: number; opacity?: number; strokeDash?: StrokeDash; fill?: DrawingFill; textContent?: string; fontSize?: number; textHAlign?: TextHAlign; textVAlign?: TextVAlign }) => void;
  setSelectedDrawingId: (id: string | null) => void;
  setStyleDrawerRequested: (requested: boolean) => void;
  setDrawingsDrawerRequested: (requested: boolean) => void;
  setRequestUpdate: (fn: (() => void) | null) => void;
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  activeTool: null,
  drawings: [],
  pendingDrawing: null,
  selectedDrawingId: null,
  styleDrawerRequested: false,
  drawingsDrawerRequested: false,
  _requestUpdate: null,

  setActiveTool: (tool) => set({ activeTool: tool }),

  addDrawing: (drawing) => {
    set((state) => ({ drawings: [...state.drawings, drawing] }));
    get()._requestUpdate?.();
    DrawingStorageService.save(drawing);
  },

  removeDrawing: (id) => {
    const drawing = get().drawings.find((d) => d.id === id);
    set((state) => ({ drawings: state.drawings.filter((d) => d.id !== id) }));
    get()._requestUpdate?.();
    if (drawing) {
      DrawingStorageService.remove(id, drawing.symbol, drawing.timeframe);
    }
  },

  clearDrawings: (symbol: string) => {
    set({ drawings: [] });
    get()._requestUpdate?.();
    DrawingStorageService.clear(symbol);
  },

  loadDrawingsForSymbol: (symbol) => {
    _unsubscribeDrawings?.();
    _unsubscribeDrawings = DrawingStorageService.subscribeAll(symbol, (drawings) => {
      set({ drawings });
      get()._requestUpdate?.();
    });
  },

  unsubscribeDrawings: () => {
    _unsubscribeDrawings?.();
    _unsubscribeDrawings = null;
  },

  setPendingDrawing: (drawing) => {
    set({ pendingDrawing: drawing });
    get()._requestUpdate?.();
  },

  updateDrawing: (id, points) => {
    const existing = get().drawings.find(d => d.id === id);
    if (!existing) return;
    const updated = { ...existing, points };
    set((state) => ({ drawings: state.drawings.map(d => d.id === id ? updated : d) }));
    get()._requestUpdate?.();
  },

  persistDrawing: (id) => {
    const drawing = get().drawings.find(d => d.id === id);
    if (drawing) DrawingStorageService.update(drawing);
  },

  updateDrawingStyle: (id, style) => {
    const existing = get().drawings.find(d => d.id === id);
    if (!existing) return;
    const updated = { ...existing, ...style };
    set((state) => ({ drawings: state.drawings.map(d => d.id === id ? updated : d) }));
    get()._requestUpdate?.();
    // Debounce the Firebase write — local state is already updated above
    const prev = _styleDebounceTimers.get(id);
    if (prev) clearTimeout(prev);
    _styleDebounceTimers.set(id, setTimeout(() => {
      _styleDebounceTimers.delete(id);
      const current = get().drawings.find(d => d.id === id);
      if (current) DrawingStorageService.update(current);
    }, STYLE_DEBOUNCE_MS));
  },

  setSelectedDrawingId: (id) => {
    set({ selectedDrawingId: id });
    get()._requestUpdate?.();
  },

  setStyleDrawerRequested: (requested) => set({ styleDrawerRequested: requested }),

  setDrawingsDrawerRequested: (requested) => set({ drawingsDrawerRequested: requested }),

  setRequestUpdate: (fn) => set({ _requestUpdate: fn }),
}));
