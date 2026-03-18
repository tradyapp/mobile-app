import type { ChartIndicator } from "@/stores/chartSettingsStore";
import type { SymbolType } from "@/stores/chartStore";

export type SecondaryPanelId = "rsi" | "macd" | "volume";
export const DEFAULT_SECONDARY_PANEL_HEIGHT = 0.32;
export const MIN_SECONDARY_PANEL_HEIGHT = 0.16;
export const MAX_SECONDARY_PANEL_HEIGHT = 0.65;

interface PanelSpec {
  id: SecondaryPanelId;
  priceScaleId: SecondaryPanelId;
  height: number;
}

export interface PanelScaleMargins {
  top: number;
  bottom: number;
}

export interface ChartPanelLayout {
  main: PanelScaleMargins;
  panels: Partial<Record<SecondaryPanelId, PanelScaleMargins>>;
}

const PANEL_SPECS: Record<SecondaryPanelId, PanelSpec> = {
  rsi: { id: "rsi", priceScaleId: "rsi", height: 0.28 },
  macd: { id: "macd", priceScaleId: "macd", height: 0.24 },
  volume: { id: "volume", priceScaleId: "volume", height: 0.16 },
};

const PANEL_ORDER_FROM_BOTTOM: SecondaryPanelId[] = ["macd", "rsi", "volume"];
const MAIN_TOP_MARGIN = 0.02;
const PANEL_BOTTOM_PADDING = 0.02;
const INTER_PANEL_GAP = 0.02;

const INDICATOR_PANEL: Partial<Record<ChartIndicator["type"], SecondaryPanelId>> = {
  rsi: "rsi",
  macd: "macd",
};

export function getRequiredSecondaryPanels(
  indicators: ChartIndicator[],
  showVolume: boolean,
  symbolType: SymbolType,
): SecondaryPanelId[] {
  const required = new Set<SecondaryPanelId>();

  if (showVolume && symbolType === "STOCK") {
    required.add("volume");
  }

  indicators
    .filter((indicator) => indicator.visible)
    .forEach((indicator) => {
      const panel = INDICATOR_PANEL[indicator.type];
      if (panel) required.add(panel);
    });

  return PANEL_ORDER_FROM_BOTTOM.filter((panel) => required.has(panel));
}

function clampSecondaryPanelHeight(height: number): number {
  return Math.min(MAX_SECONDARY_PANEL_HEIGHT, Math.max(MIN_SECONDARY_PANEL_HEIGHT, height));
}

export function buildChartPanelLayout(
  activePanels: SecondaryPanelId[],
  secondaryPanelHeight = DEFAULT_SECONDARY_PANEL_HEIGHT,
): ChartPanelLayout {
  const clampedSecondaryHeight = clampSecondaryPanelHeight(secondaryPanelHeight);
  const panels: Partial<Record<SecondaryPanelId, PanelScaleMargins>> = {};
  const resolvedPanels = PANEL_ORDER_FROM_BOTTOM.filter((panel) => activePanels.includes(panel));

  if (resolvedPanels.length === 0) {
    return {
      main: { top: MAIN_TOP_MARGIN, bottom: PANEL_BOTTOM_PADDING },
      panels,
    };
  }

  const totalGap = INTER_PANEL_GAP * (resolvedPanels.length - 1);
  const normalizedSpace = Math.max(0.02, clampedSecondaryHeight - PANEL_BOTTOM_PADDING - totalGap);
  const baseHeightSum = resolvedPanels.reduce((sum, panelId) => sum + PANEL_SPECS[panelId].height, 0);

  let consumedBottom = PANEL_BOTTOM_PADDING;

  for (const panel of resolvedPanels) {
    const baseHeight = PANEL_SPECS[panel].height;
    const panelHeight = (baseHeight / baseHeightSum) * normalizedSpace;

    panels[panel] = {
      top: Math.max(MAIN_TOP_MARGIN, 1 - (consumedBottom + panelHeight)),
      bottom: consumedBottom,
    };
    consumedBottom += panelHeight + INTER_PANEL_GAP;
  }

  return {
    main: {
      top: MAIN_TOP_MARGIN,
      bottom: Math.min(0.9, clampedSecondaryHeight),
    },
    panels,
  };
}
