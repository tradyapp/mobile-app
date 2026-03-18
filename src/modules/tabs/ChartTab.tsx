"use client";

import { useEffect } from "react";
import AppNavbar from "@/components/AppNavbar";
import Chart from "@/components/chart/Chart";
import ChartBar from "@/components/chart/ChartBar";
import { useWindowSize } from "@/hooks/useWindowSize";
import { useChartStore } from "@/stores/chartStore";
import { useChartSettingsStore } from "@/stores/chartSettingsStore";
import { useDrawingTemplateStore } from "@/stores/drawingTemplateStore";

const FOOTER_HEIGHT = 144;
const CHARTBAR_WIDTH = 64; // w-16 = 64px
const TOOLBAR_HEIGHT = 82;

export default function ChartTab() {
  const { width, height } = useWindowSize();
  const { symbol, symbolName } = useChartStore();
  const loadTemplates = useChartSettingsStore((s) => s.loadTemplates);
  const loadDrawingTemplates = useDrawingTemplateStore((s) => s.loadTemplates);

  useEffect(() => {
    loadTemplates();
    loadDrawingTemplates();
  }, [loadTemplates, loadDrawingTemplates]);
  const isLandscape = width > height;
  const chartWidth = isLandscape ? width - CHARTBAR_WIDTH : width;
  const chartHeight = isLandscape
    ? height - TOOLBAR_HEIGHT
    : height - FOOTER_HEIGHT;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 mb-24 flex">
      {/* ChartBar a la izquierda en landscape */}
      {isLandscape && (
        <div className="shrink-0">
          <ChartBar orientation="vertical" />
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-10">
          <AppNavbar />

          <div className="text-white absolute top-4 left-4 z-100">
            <h2><span className="font-bold">{symbol}</span>{symbolName ? `: ${symbolName}` : ''}</h2>
          </div>
        </div>

        <div
          className="relative"
          style={{
            width: `${chartWidth}px`,
            height: `${chartHeight}px`,
          }}
        >
          <Chart width={chartWidth} height={chartHeight} />
        </div>

        {/* ChartBar abajo en portrait */}
        {!isLandscape && <ChartBar orientation="horizontal" />}
      </div>
    </div>
  );
}
