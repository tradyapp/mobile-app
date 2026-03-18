import type { ChartColors } from "@/stores/chartSettingsStore";
import CogIcon from "../../icons/CogIcon";
import OrionIcon from "../../icons/OrionIcon";

export { ScreenHeader } from "../drawing-style/shared";

// ── Navigation sections ──
export type Section =
  | 'menu'
  | 'chart'
  | 'colors'
  | 'edit-template'
  | 'color-picker'
  | 'indicators'
  | 'orion'
  | 'drawings'
  | 'drawing-default-styles'
  | 'drawing-template-picker'
  | 'drawing-edit-template'
  | 'drawing-color-picker'
  | 'drawing-hsl-picker';

// ── Color targets for the picker ──
export type ColorTarget = keyof ChartColors;

export interface ColorItem {
  id: ColorTarget;
  label: string;
}

export const COLOR_ITEMS: ColorItem[] = [
  { id: 'candleUp', label: 'Candle Up' },
  { id: 'candleDown', label: 'Candle Down' },
  { id: 'background', label: 'Background' },
  { id: 'text', label: 'Text' },
  { id: 'grid', label: 'Grid' },
  { id: 'crosshairLine', label: 'Crosshair Line' },
  { id: 'crosshairLabel', label: 'Crosshair Label' },
  { id: 'scaleBorder', label: 'Scale Border' },
];

// ── Chevron icon ──
export const ChevronRight = () => (
  <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// ── Color swatch row ──
export function ColorRow({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      onClick={(e) => e.preventDefault()}
      className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border border-zinc-600" style={{ backgroundColor: color }} />
          <span className="text-base">{label}</span>
        </div>
        <ChevronRight />
      </div>
    </button>
  );
}

// ── Template color preview (3 dots) ──
export function TemplateColorPreview({ colors }: { colors: ChartColors }) {
  return (
    <div className="flex -space-x-1">
      <div className="w-4 h-4 rounded-full border border-zinc-900" style={{ backgroundColor: colors.candleUp }} />
      <div className="w-4 h-4 rounded-full border border-zinc-900" style={{ backgroundColor: colors.candleDown }} />
      <div className="w-4 h-4 rounded-full border border-zinc-900" style={{ backgroundColor: colors.background }} />
    </div>
  );
}

// ── Menu items ──
export const menuItems = [
    {
    id: 'drawings' as Section,
    label: 'Drawings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    id: 'chart' as Section,
    label: 'Chart',
    icon: <CogIcon />,
  },
  {
    id: 'indicators' as Section,
    label: 'Indicators',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    id: 'orion' as Section,
    label: 'Orion',
    icon: <OrionIcon />,
  },

];
