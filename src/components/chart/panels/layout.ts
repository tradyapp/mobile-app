import type { ChartIndicator } from "@/stores/chartSettingsStore";
import type { SymbolType } from "@/stores/chartStore";

export type SecondaryPanelId = "rsi" | "volume";

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
  volume: { id: "volume", priceScaleId: "volume", height: 0.16 },
};

const PANEL_ORDER_FROM_BOTTOM: SecondaryPanelId[] = ["rsi", "volume"];
const MAIN_TOP_MARGIN = 0.02;
const PANEL_BOTTOM_PADDING = 0.02;
const INTER_PANEL_GAP = 0.02;

const INDICATOR_PANEL: Partial<Record<ChartIndicator["type"], SecondaryPanelId>> = {
  rsi: "rsi",
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

export function buildChartPanelLayout(activePanels: SecondaryPanelId[]): ChartPanelLayout {
  const panels: Partial<Record<SecondaryPanelId, PanelScaleMargins>> = {};
  let consumedBottom = PANEL_BOTTOM_PADDING;

  for (const panel of PANEL_ORDER_FROM_BOTTOM) {
    if (!activePanels.includes(panel)) continue;

    const spec = PANEL_SPECS[panel];
    panels[panel] = {
      top: Math.max(MAIN_TOP_MARGIN, 1 - (consumedBottom + spec.height)),
      bottom: consumedBottom,
    };
    consumedBottom += spec.height + INTER_PANEL_GAP;
  }

  return {
    main: {
      top: MAIN_TOP_MARGIN,
      bottom: Math.min(0.9, consumedBottom),
    },
    panels,
  };
}

