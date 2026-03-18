"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
const CHART_SAFE_GUTTER = 12;

export default function ChartTab() {
  const { width, height } = useWindowSize();
  const { symbol, symbolName } = useChartStore();
  const loadTemplates = useChartSettingsStore((s) => s.loadTemplates);
  const loadDrawingTemplates = useDrawingTemplateStore((s) => s.loadTemplates);
  const chartHostRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    loadTemplates();
    loadDrawingTemplates();
  }, [loadTemplates, loadDrawingTemplates]);

  useLayoutEffect(() => {
    if (!chartHostRef.current) return;

    const host = chartHostRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const nextWidth = Math.max(0, Math.floor(entry.contentRect.width));
      setChartWidth(nextWidth);
    });

    resizeObserver.observe(host);
    return () => resizeObserver.disconnect();
  }, []);

  const isLandscape = width > height;
  const chartBarCompensation = isLandscape ? CHARTBAR_WIDTH : 0;
  const sideGutter = isLandscape ? CHART_SAFE_GUTTER : 0;
  const fallbackWidth = Math.max(0, width - chartBarCompensation - sideGutter * 2);
  const effectiveChartWidth = chartWidth || fallbackWidth;
  const chartHeight = isLandscape
    ? height - TOOLBAR_HEIGHT
    : height - FOOTER_HEIGHT;
  const safeChartContentStyle: React.CSSProperties = isLandscape
    ? {
        paddingLeft: `max(${CHART_SAFE_GUTTER}px, env(safe-area-inset-left))`,
        paddingRight: `max(${CHART_SAFE_GUTTER}px, env(safe-area-inset-right))`,
      }
    : {};
  const symbolOverlayStyle: React.CSSProperties = {
    left: `max(${CHART_SAFE_GUTTER}px, env(safe-area-inset-left))`,
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 mb-24">
      <div className="absolute top-0 left-0 right-0 z-10">
        <AppNavbar />

        <div className="text-white absolute top-4 z-100" style={symbolOverlayStyle}>
          <h2><span className="font-bold">{symbol}</span>{symbolName ? `: ${symbolName}` : ''}</h2>
        </div>
      </div>

      <div className="h-full flex" style={safeChartContentStyle}>
        {/* ChartBar a la izquierda en landscape */}
        {isLandscape && (
          <div className="shrink-0">
            <ChartBar orientation="vertical" />
          </div>
        )}

        <div className="flex-1 flex flex-col">
          <div
            ref={chartHostRef}
            className="relative"
            style={{
              height: `${chartHeight}px`,
            }}
          >
            {effectiveChartWidth > 0 && chartHeight > 0 && (
              <Chart width={effectiveChartWidth} height={chartHeight} />
            )}
          </div>

          {/* ChartBar abajo en portrait */}
          {!isLandscape && <ChartBar orientation="horizontal" />}
        </div>
      </div>
    </div>
  );
}
