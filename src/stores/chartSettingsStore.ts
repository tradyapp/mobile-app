import { create } from 'zustand';
import { ChartTemplateStorageService, type Unsubscribe } from '@/services/ChartTemplateStorageService';

// ── Chart color properties ──
export interface ChartColors {
  candleUp: string;
  candleDown: string;
  background: string;
  text: string;
  grid: string;
  crosshairLine: string;
  crosshairLabel: string;
  scaleBorder: string;
}

export interface ChartTemplate {
  id: string;
  name: string;
  colors: ChartColors;
  builtIn?: boolean;
  filledUpCandle?: boolean;   // default true
  filledDownCandle?: boolean; // default true
}

export interface ChartPreferences {
  showVolume: boolean;
  indicators: ChartIndicator[];
  showMaNameLabels: boolean;
  showMaPriceLabels: boolean;
  showLastPriceLine: boolean;
}

export interface MovingAverageIndicator {
  id: string;
  type: 'sma';
  name: 'Moving Average';
  period: number;
  source: 'close';
  color: string;
  lineWidth: number;
  visible: boolean;
}

export interface RsiIndicator {
  id: string;
  type: 'rsi';
  name: 'Relative Strength Index';
  period: number;
  color: string;
  lineWidth: number;
  visible: boolean;
}

export type ChartIndicator = MovingAverageIndicator | RsiIndicator;

// ── Built-in templates ──
export const BUILT_IN_TEMPLATES: ChartTemplate[] = [
  {
    id: 'builtin-dark',
    name: 'Dark',
    builtIn: true,
    filledUpCandle: true,
    filledDownCandle: true,
    colors: {
      candleUp: '#00ff99',
      candleDown: '#ff2b45',
      background: '#000000',
      text: '#d1d4dc',
      grid: '#202020',
      crosshairLine: '#758696',
      crosshairLabel: '#4c525e',
      scaleBorder: '#2B2B43',
    },
  },
  {
    id: 'builtin-light',
    name: 'Light',
    builtIn: true,
    filledUpCandle: true,
    filledDownCandle: true,
    colors: {
      candleUp: '#22c55e',
      candleDown: '#ef4444',
      background: '#ffffff',
      text: '#191919',
      grid: '#e5e7eb',
      crosshairLine: '#9ca3af',
      crosshairLabel: '#6b7280',
      scaleBorder: '#d1d5db',
    },
  },
  {
    id: 'builtin-classic',
    name: 'Classic',
    builtIn: true,
    filledUpCandle: true,
    filledDownCandle: true,
    colors: {
      candleUp: '#26a69a',
      candleDown: '#ef5350',
      background: '#131722',
      text: '#b2b5be',
      grid: '#1e222d',
      crosshairLine: '#758696',
      crosshairLabel: '#4c525e',
      scaleBorder: '#2a2e39',
    },
  },
  {
    id: 'builtin-midnight',
    name: 'Midnight Blue',
    builtIn: true,
    filledUpCandle: true,
    filledDownCandle: true,
    colors: {
      candleUp: '#60a5fa',
      candleDown: '#f472b6',
      background: '#0f172a',
      text: '#cbd5e1',
      grid: '#1e293b',
      crosshairLine: '#475569',
      crosshairLabel: '#334155',
      scaleBorder: '#1e293b',
    },
  },
];

export const DEFAULT_COLORS: ChartColors = BUILT_IN_TEMPLATES[0].colors;

const DEFAULT_PREFERENCES: ChartPreferences = {
  showVolume: false,
  indicators: [],
  showMaNameLabels: true,
  showMaPriceLabels: true,
  showLastPriceLine: true,
};

function normalizePreferences(prefs: Partial<ChartPreferences> | null | undefined): ChartPreferences {
  const legacyShowMaLabels = (prefs as { showMaLabels?: boolean } | null | undefined)?.showMaLabels;
  return {
    showVolume: prefs?.showVolume ?? DEFAULT_PREFERENCES.showVolume,
    indicators: prefs?.indicators ?? DEFAULT_PREFERENCES.indicators,
    showMaNameLabels: prefs?.showMaNameLabels ?? legacyShowMaLabels ?? DEFAULT_PREFERENCES.showMaNameLabels,
    showMaPriceLabels: prefs?.showMaPriceLabels ?? legacyShowMaLabels ?? DEFAULT_PREFERENCES.showMaPriceLabels,
    showLastPriceLine: prefs?.showLastPriceLine ?? DEFAULT_PREFERENCES.showLastPriceLine,
  };
}

// ── localStorage helpers ──
const LS_ACTIVE_TEMPLATE_ID = 'trady:chart-active-template-id';
const LS_CUSTOM_TEMPLATES = 'trady:chart-custom-templates';
const LS_PREFERENCES = 'trady:chart-preferences';

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
let _unsubActive: Unsubscribe | null = null;
let _unsubPreferences: Unsubscribe | null = null;

interface ChartSettingsState {
  // Templates
  customTemplates: ChartTemplate[];
  activeTemplateId: string;
  isLoaded: boolean;

  // Computed active values (from active template)
  activeColors: ChartColors;
  activeFilledUpCandle: boolean;
  activeFilledDownCandle: boolean;

  // Preferences
  preferences: ChartPreferences;

  // Actions
  loadTemplates: () => void;
  unsubscribeAll: () => void;
  setActiveTemplate: (id: string) => void;
  saveTemplate: (template: ChartTemplate) => void;
  deleteTemplate: (id: string) => void;
  setPreferences: (partial: Partial<ChartPreferences>) => void;
}

/** Extract filled candle state from a template (defaults to true for backward compat) */
function templateFilled(t: ChartTemplate) {
  return {
    activeFilledUpCandle: t.filledUpCandle !== false,
    activeFilledDownCandle: t.filledDownCandle !== false,
  };
}

function findTemplate(customTemplates: ChartTemplate[], id: string): ChartTemplate | undefined {
  return BUILT_IN_TEMPLATES.find(t => t.id === id) ?? customTemplates.find(t => t.id === id);
}

// ── Hydrate initial state from localStorage synchronously ──
const cachedActiveId = lsGet<string>(LS_ACTIVE_TEMPLATE_ID, BUILT_IN_TEMPLATES[0].id);
const cachedCustomTemplates = lsGet<ChartTemplate[]>(LS_CUSTOM_TEMPLATES, []);
const cachedPreferences = normalizePreferences(lsGet<ChartPreferences>(LS_PREFERENCES, DEFAULT_PREFERENCES));
const cachedTemplate = findTemplate(cachedCustomTemplates, cachedActiveId);
const cachedColors = cachedTemplate?.colors ?? DEFAULT_COLORS;
const cachedFilled = cachedTemplate ? templateFilled(cachedTemplate) : { activeFilledUpCandle: true, activeFilledDownCandle: true };

export const useChartSettingsStore = create<ChartSettingsState>((set, get) => ({
  customTemplates: cachedCustomTemplates,
  activeTemplateId: cachedActiveId,
  isLoaded: false,
  activeColors: { ...cachedColors },
  activeFilledUpCandle: cachedFilled.activeFilledUpCandle,
  activeFilledDownCandle: cachedFilled.activeFilledDownCandle,
  preferences: { ...cachedPreferences },

  loadTemplates: () => {
    _unsubTemplates?.();
    _unsubActive?.();
    _unsubPreferences?.();

    _unsubTemplates = ChartTemplateStorageService.subscribeTemplates((templates) => {
      const state = get();
      const active = findTemplate(templates, state.activeTemplateId);
      lsSet(LS_CUSTOM_TEMPLATES, templates);
      set({
        customTemplates: templates,
        isLoaded: true,
        ...(active ? { activeColors: active.colors, ...templateFilled(active) } : {}),
      });
    });

    _unsubActive = ChartTemplateStorageService.subscribeActiveTemplate((id) => {
      const activeId = id ?? BUILT_IN_TEMPLATES[0].id;
      const state = get();
      const active = findTemplate(state.customTemplates, activeId);
      lsSet(LS_ACTIVE_TEMPLATE_ID, activeId);
      set({
        activeTemplateId: activeId,
        ...(active ? { activeColors: active.colors, ...templateFilled(active) } : {}),
      });
    });

    _unsubPreferences = ChartTemplateStorageService.subscribePreferences((prefs) => {
      if (prefs) {
        const normalized = normalizePreferences(prefs);
        lsSet(LS_PREFERENCES, normalized);
        set({ preferences: normalized });
      }
    });
  },

  unsubscribeAll: () => {
    _unsubTemplates?.();
    _unsubActive?.();
    _unsubPreferences?.();
    _unsubTemplates = null;
    _unsubActive = null;
    _unsubPreferences = null;
  },

  setActiveTemplate: (id: string) => {
    const state = get();
    const template = findTemplate(state.customTemplates, id);
    if (template) {
      lsSet(LS_ACTIVE_TEMPLATE_ID, id);
      set({ activeTemplateId: id, activeColors: template.colors, ...templateFilled(template) });
      ChartTemplateStorageService.setActiveTemplate(id);
    }
  },

  saveTemplate: (template: ChartTemplate) => {
    ChartTemplateStorageService.save(template);
  },

  deleteTemplate: (id: string) => {
    const state = get();
    ChartTemplateStorageService.remove(id);
    if (state.activeTemplateId === id) {
      const fallback = BUILT_IN_TEMPLATES[0];
      lsSet(LS_ACTIVE_TEMPLATE_ID, fallback.id);
      set({ activeTemplateId: fallback.id, activeColors: fallback.colors, ...templateFilled(fallback) });
      ChartTemplateStorageService.setActiveTemplate(fallback.id);
    }
  },

  setPreferences: (partial: Partial<ChartPreferences>) => {
    const state = get();
    const merged = normalizePreferences({ ...state.preferences, ...partial });
    lsSet(LS_PREFERENCES, merged);
    set({ preferences: merged });
    ChartTemplateStorageService.setPreferences(merged);
  },
}));
