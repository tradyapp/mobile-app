"use client";

import { useEffect, useRef, useState } from "react";
import AppNavbar from "@/components/AppNavbar";
import Chart from "@/components/chart/Chart";
import ChartBar from "@/components/chart/ChartBar";
import { useWindowSize } from "@/hooks/useWindowSize";
import { useChartStore } from "@/stores/chartStore";
import { useChartSettingsStore } from "@/stores/chartSettingsStore";
import { useDrawingTemplateStore } from "@/stores/drawingTemplateStore";

const TOOLBAR_HEIGHT = 82;

export default function ChartTab() {
  const { width, height } = useWindowSize();
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const { symbol, symbolName } = useChartStore();
  const loadTemplates = useChartSettingsStore((s) => s.loadTemplates);
  const loadDrawingTemplates = useDrawingTemplateStore((s) => s.loadTemplates);

  useEffect(() => {
    loadTemplates();
    loadDrawingTemplates();
  }, [loadTemplates, loadDrawingTemplates]);

  useEffect(() => {
    if (!chartHostRef.current) return;

    const host = chartHostRef.current;
    const measure = () => {
      const nextWidth = Math.max(1, Math.floor(host.clientWidth));
      const nextHeight = Math.max(1, Math.floor(host.clientHeight));
      setChartSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) return prev;
        return { width: nextWidth, height: nextHeight };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    window.addEventListener("orientationchange", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  const isLandscape = width > height;

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 mb-24 flex"
      style={{
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* ChartBar a la izquierda en landscape */}
      {isLandscape && (
        <div className="shrink-0">
          <ChartBar orientation="vertical" />
        </div>
      )}

      <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-10">
          <AppNavbar />

          <div className="text-white absolute top-4 left-4 z-100">
            <h2><span className="font-bold">{symbol}</span>{symbolName ? `: ${symbolName}` : ''}</h2>
          </div>
        </div>

        <div
          className="min-h-0 flex-1"
          style={{
            paddingTop: `${TOOLBAR_HEIGHT}px`,
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div ref={chartHostRef} className="relative w-full h-full">
            {chartSize.width > 0 && chartSize.height > 0 && (
              <Chart width={chartSize.width} height={chartSize.height} />
            )}
          </div>
        </div>

        {/* ChartBar abajo en portrait */}
        {!isLandscape && <ChartBar orientation="horizontal" />}
      </div>
    </div>
  );
}
