import TouchableButton from "../../uiux/TouchableButton";
import { useIsInsideDrawerNav } from "../../uiux/drawer-nav";
import type { StrokeDash, FillType, GradientDirection } from "@/stores/drawingStore";

// ── Screen type for drawer navigation ──
export type Screen = 'main' | 'templates' | 'edit-template' | 'stroke' | 'fill' | 'text-edit' | 'color-picker' | 'fill-picker' | 'picker';

// ── Preset colors: 3 rows of 8 ──
export const PRESET_COLORS = [
  '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f87171', '#fb923c', '#facc15', '#4ade80',
  '#60a5fa', '#a78bfa', '#f472b6', '#06b6d4',
  '#fca5a5', '#fdba74', '#fde68a', '#86efac',
  '#93c5fd', '#c4b5fd', '#f9a8d4', '#67e8f9',
];

export const THICKNESS_OPTIONS = [1, 2, 3, 4];

export const DASH_OPTIONS: { value: StrokeDash; label: string }[] = [
  { value: 'dotted', label: '···' },
  { value: 'dashed', label: '- - -' },
  { value: 'solid', label: '───' },
];

export const FILL_TYPE_OPTIONS: { value: FillType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
];

export const GRADIENT_DIR_OPTIONS: { value: GradientDirection; label: string }[] = [
  { value: 'down', label: 'Down' },
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
  { value: 'up', label: 'Up' },
];

// ── Custom color localStorage helpers ──
const CUSTOM_COLORS_KEY = 'trady:custom-colors';

export function getCustomColors(): string[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) || '[]'); } catch { return []; }
}

export function saveCustomColors(colors: string[]): void {
  localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors));
}

export function ensureColorInPalette(hex: string): string[] {
  const current = getCustomColors();
  if (PRESET_COLORS.includes(hex) || current.includes(hex)) return current;
  const updated = [...current, hex];
  saveCustomColors(updated);
  return updated;
}

// ── Color conversion helpers ──
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// ── Stroke dash to SVG dasharray ──
export function dashToSvg(dash: StrokeDash): string {
  if (dash === 'dashed') return '10,6';
  if (dash === 'dotted') return '3,4';
  return 'none';
}

// ── Shared header for sub-screens ──
// Auto-suppressed when inside AppDrawer's screen navigation system
// (the nav system renders its own header with back/close buttons).
export function ScreenHeader({
  onBack,
  onClose,
  title,
}: {
  onBack: () => void;
  onClose: () => void;
  title: string;
}) {
  const insideNav = useIsInsideDrawerNav();
  if (insideNav) return null;

  return (
    <div className="flex items-center justify-between mb-6">
      <TouchableButton
        onClick={onBack}
        className="text-zinc-400 text-xl w-10 h-10 flex items-center justify-center"
      >
        ←
      </TouchableButton>
      <span className="text-white font-medium">{title}</span>
      <TouchableButton
        onClick={onClose}
        className="text-zinc-400 text-xl font-light w-10 h-10 flex items-center justify-center"
      >
        ✕
      </TouchableButton>
    </div>
  );
}
