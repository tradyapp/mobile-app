import { create } from 'zustand';
import { DrawingTemplateStorageService, type Unsubscribe } from '@/services/DrawingTemplateStorageService';
import type { StrokeDash, DrawingFill, TextHAlign, TextVAlign, DrawingTool } from '@/stores/drawingStore';

// ── Template types ──

export type DrawingTemplateCategory = 'line' | 'shape' | 'text';

interface DrawingTemplateBase {
  id: string;
  name: string;
  category: DrawingTemplateCategory;
  builtIn?: boolean;
  color: string;
  opacity: number;
}

export interface LineDrawingTemplate extends DrawingTemplateBase {
  category: 'line';
  strokeWidth: number;
  strokeDash: StrokeDash;
}

export interface ShapeDrawingTemplate extends DrawingTemplateBase {
  category: 'shape';
  strokeWidth: number;
  strokeDash: StrokeDash;
  fill: DrawingFill;
}

export interface TextDrawingTemplate extends DrawingTemplateBase {
  category: 'text';
  fontSize: number;
  textHAlign: TextHAlign;
  textVAlign: TextVAlign;
}

export type DrawingTemplate = LineDrawingTemplate | ShapeDrawingTemplate | TextDrawingTemplate;

export interface DefaultDrawingTemplateIds {
  line: string;
  shape: string;
  text: string;
}

// ── Tool → Category mapping ──

const TOOL_CATEGORY_MAP: Record<DrawingTool, DrawingTemplateCategory> = {
  line: 'line',
  horizontal_line: 'line',
  vertical_line: 'line',
  freehand: 'line',
  rectangle: 'shape',
  ellipse: 'shape',
  triangle: 'shape',
  inverted_triangle: 'shape',
  polygon: 'shape',
  text: 'text',
};

export function getToolCategory(tool: DrawingTool): DrawingTemplateCategory {
  return TOOL_CATEGORY_MAP[tool];
}

// ── Built-in templates ──

export const BUILT_IN_LINE_TEMPLATES: LineDrawingTemplate[] = [
  { id: 'builtin-line-white', name: 'White Solid', category: 'line', builtIn: true, color: '#ffffff', opacity: 1, strokeWidth: 3, strokeDash: 'solid' },
  { id: 'builtin-line-red', name: 'Red Dashed', category: 'line', builtIn: true, color: '#ef4444', opacity: 1, strokeWidth: 2, strokeDash: 'dashed' },
  { id: 'builtin-line-blue', name: 'Blue Thin', category: 'line', builtIn: true, color: '#3b82f6', opacity: 1, strokeWidth: 1, strokeDash: 'solid' },
  { id: 'builtin-line-green', name: 'Green Thick', category: 'line', builtIn: true, color: '#22c55e', opacity: 1, strokeWidth: 4, strokeDash: 'solid' },
];

export const BUILT_IN_SHAPE_TEMPLATES: ShapeDrawingTemplate[] = [
  { id: 'builtin-shape-white', name: 'White Outline', category: 'shape', builtIn: true, color: '#ffffff', opacity: 1, strokeWidth: 3, strokeDash: 'solid', fill: { type: 'none' } },
  { id: 'builtin-shape-blue', name: 'Blue Filled', category: 'shape', builtIn: true, color: '#3b82f6', opacity: 1, strokeWidth: 2, strokeDash: 'solid', fill: { type: 'solid', color: '#3b82f6', opacity: 0.2 } },
  { id: 'builtin-shape-red', name: 'Red Gradient', category: 'shape', builtIn: true, color: '#ef4444', opacity: 1, strokeWidth: 2, strokeDash: 'solid', fill: { type: 'gradient', gradientColor1: '#ef4444', gradientColor2: '#ef444400', gradientOpacity1: 0.4, gradientOpacity2: 0, gradientDirection: 'down' } },
  { id: 'builtin-shape-green', name: 'Green Semi', category: 'shape', builtIn: true, color: '#22c55e', opacity: 1, strokeWidth: 3, strokeDash: 'solid', fill: { type: 'solid', color: '#22c55e', opacity: 0.3 } },
];

export const BUILT_IN_TEXT_TEMPLATES: TextDrawingTemplate[] = [
  { id: 'builtin-text-white', name: 'White Standard', category: 'text', builtIn: true, color: '#ffffff', opacity: 1, fontSize: 2, textHAlign: 'left', textVAlign: 'middle' },
  { id: 'builtin-text-blue', name: 'Blue Centered', category: 'text', builtIn: true, color: '#3b82f6', opacity: 1, fontSize: 3, textHAlign: 'center', textVAlign: 'middle' },
  { id: 'builtin-text-red', name: 'Red Large', category: 'text', builtIn: true, color: '#ef4444', opacity: 1, fontSize: 5, textHAlign: 'center', textVAlign: 'middle' },
  { id: 'builtin-text-green', name: 'Green Small', category: 'text', builtIn: true, color: '#22c55e', opacity: 1, fontSize: 1.5, textHAlign: 'left', textVAlign: 'top' },
];

export const ALL_BUILT_IN_TEMPLATES: DrawingTemplate[] = [
  ...BUILT_IN_LINE_TEMPLATES,
  ...BUILT_IN_SHAPE_TEMPLATES,
  ...BUILT_IN_TEXT_TEMPLATES,
];

const DEFAULT_TEMPLATE_IDS: DefaultDrawingTemplateIds = {
  line: BUILT_IN_LINE_TEMPLATES[0].id,
  shape: BUILT_IN_SHAPE_TEMPLATES[0].id,
  text: BUILT_IN_TEXT_TEMPLATES[0].id,
};

// ── localStorage helpers ──

const LS_CUSTOM_TEMPLATES = 'trady:drawing-custom-templates';
const LS_DEFAULT_TEMPLATES = 'trady:drawing-default-templates';

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded — ignore */ }
}

// ── Store ──

let _unsubTemplates: Unsubscribe | null = null;
let _unsubDefaults: Unsubscribe | null = null;

interface DrawingTemplateState {
  customTemplates: DrawingTemplate[];
  defaultTemplateIds: DefaultDrawingTemplateIds;
  isLoaded: boolean;

  loadTemplates: () => void;
  unsubscribeAll: () => void;
  setDefaultTemplate: (category: DrawingTemplateCategory, templateId: string) => void;
  saveTemplate: (template: DrawingTemplate) => void;
  deleteTemplate: (id: string) => void;
  getTemplatesForCategory: (category: DrawingTemplateCategory) => DrawingTemplate[];
  getDefaultTemplate: (category: DrawingTemplateCategory) => DrawingTemplate;
}

function findTemplate(customTemplates: DrawingTemplate[], id: string): DrawingTemplate | undefined {
  return ALL_BUILT_IN_TEMPLATES.find(t => t.id === id) ?? customTemplates.find(t => t.id === id);
}

// Hydrate from localStorage
const cachedCustomTemplates = lsGet<DrawingTemplate[]>(LS_CUSTOM_TEMPLATES, []);
const cachedDefaultIds = lsGet<DefaultDrawingTemplateIds>(LS_DEFAULT_TEMPLATES, DEFAULT_TEMPLATE_IDS);

export const useDrawingTemplateStore = create<DrawingTemplateState>((set, get) => ({
  customTemplates: cachedCustomTemplates,
  defaultTemplateIds: cachedDefaultIds,
  isLoaded: false,

  loadTemplates: () => {
    _unsubTemplates?.();
    _unsubDefaults?.();

    _unsubTemplates = DrawingTemplateStorageService.subscribeTemplates((templates) => {
      lsSet(LS_CUSTOM_TEMPLATES, templates);
      set({ customTemplates: templates, isLoaded: true });
    });

    _unsubDefaults = DrawingTemplateStorageService.subscribeDefaultTemplates((defaults) => {
      const ids = defaults ?? DEFAULT_TEMPLATE_IDS;
      lsSet(LS_DEFAULT_TEMPLATES, ids);
      set({ defaultTemplateIds: ids });
    });
  },

  unsubscribeAll: () => {
    _unsubTemplates?.();
    _unsubDefaults?.();
    _unsubTemplates = null;
    _unsubDefaults = null;
  },

  setDefaultTemplate: (category, templateId) => {
    const state = get();
    const template = findTemplate(state.customTemplates, templateId);
    if (!template) return;
    const updated = { ...state.defaultTemplateIds, [category]: templateId };
    lsSet(LS_DEFAULT_TEMPLATES, updated);
    set({ defaultTemplateIds: updated });
    DrawingTemplateStorageService.setDefaultTemplate(category, templateId);
  },

  saveTemplate: (template) => {
    DrawingTemplateStorageService.save(template);
  },

  deleteTemplate: (id) => {
    const state = get();
    DrawingTemplateStorageService.remove(id);
    // If this was a default, reset to first built-in for that category
    const entries = Object.entries(state.defaultTemplateIds) as [DrawingTemplateCategory, string][];
    for (const [cat, defId] of entries) {
      if (defId === id) {
        const fallbackId = cat === 'line' ? BUILT_IN_LINE_TEMPLATES[0].id
          : cat === 'shape' ? BUILT_IN_SHAPE_TEMPLATES[0].id
          : BUILT_IN_TEXT_TEMPLATES[0].id;
        const updated = { ...state.defaultTemplateIds, [cat]: fallbackId };
        lsSet(LS_DEFAULT_TEMPLATES, updated);
        set({ defaultTemplateIds: updated });
        DrawingTemplateStorageService.setDefaultTemplate(cat, fallbackId);
      }
    }
  },

  getTemplatesForCategory: (category) => {
    const state = get();
    const builtIn = ALL_BUILT_IN_TEMPLATES.filter(t => t.category === category);
    const custom = state.customTemplates.filter(t => t.category === category);
    return [...builtIn, ...custom];
  },

  getDefaultTemplate: (category) => {
    const state = get();
    const id = state.defaultTemplateIds[category];
    const template = findTemplate(state.customTemplates, id);
    if (template && template.category === category) return template;
    // Fallback to first built-in
    if (category === 'line') return BUILT_IN_LINE_TEMPLATES[0];
    if (category === 'shape') return BUILT_IN_SHAPE_TEMPLATES[0];
    return BUILT_IN_TEXT_TEMPLATES[0];
  },
}));
