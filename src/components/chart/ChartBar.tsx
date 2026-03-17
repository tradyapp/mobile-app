/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from "react";
import IntervalDrawer from "./IntervalDrawer";
import SymbolDrawer from "./SymbolDrawer";
import DrawingsDrawer from "./DrawingsDrawer";
import DrawingStyleDrawer from "./DrawingStyleDrawer";
import SettingsDrawer from "./SettingsDrawer";
import PencilIcon from "../icons/PencilIcon";
import PaletteIcon from "../icons/PaletteIcon";
import CogIcon from "../icons/CogIcon";
import { useChartStore, SymbolType } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { Timeframe } from "@/services/StockDataService";
import ChartKeyboardHandler from "./ChartKeyboardHandler";
import dataService from "@/services/DataService";

interface ChartBarProps {
  orientation?: "horizontal" | "vertical";
}

const ChartBar = ({ orientation = "horizontal" }: ChartBarProps) => {
  const { symbol, timeframe, setSymbol, setTimeframe } = useChartStore();
  const { activeTool, setActiveTool, selectedDrawingId, styleDrawerRequested, setStyleDrawerRequested, drawingsDrawerRequested, setDrawingsDrawerRequested } = useDrawingStore();
  const [isIntervalDrawerOpen, setIsIntervalDrawerOpen] = useState(false);
  const [isSymbolDrawerOpen, setIsSymbolDrawerOpen] = useState(false);
  const [isDrawingsDrawerOpen, setIsDrawingsDrawerOpen] = useState(false);
  const [isStyleDrawerOpen, setIsStyleDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [initialSearchLetter, setInitialSearchLetter] = useState<
    string | undefined
  >(undefined);
  const [symbolImage, setSymbolImage] = useState<string | null>(null);

  // Open style drawer when requested by double-tap
  useEffect(() => {
    if (styleDrawerRequested) {
      setIsStyleDrawerOpen(true);
      setStyleDrawerRequested(false);
    }
  }, [styleDrawerRequested, setStyleDrawerRequested]);

  // Open drawings drawer when requested by Space key
  useEffect(() => {
    if (drawingsDrawerRequested) {
      setIsDrawingsDrawerOpen(true);
      setDrawingsDrawerRequested(false);
    }
  }, [drawingsDrawerRequested, setDrawingsDrawerRequested]);

  // Cargar imagen del símbolo actual
  useEffect(() => {
    const loadSymbolImage = () => {
      try {
        const symbols = dataService.getSymbols();
        const currentSymbol = symbols.find(s => s.symbol === symbol);
        setSymbolImage(currentSymbol?.photo || null);
      } catch (error) {
        console.error('Error loading symbol image:', error);
        setSymbolImage(null);
      }
    };

    loadSymbolImage();
  }, [symbol]);

  // Mapear timeframe a formato de display
  const getDisplayInterval = (tf: Timeframe): string => {
    const map: Record<Timeframe, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      h: "1H",
      d: "1D",
      w: "1W",
      mo: "1M",
    };
    return map[tf];
  };

  // Mapear intervalo de display a timeframe
  const getTimeframeFromInterval = (interval: string): Timeframe => {
    const map: Record<string, Timeframe> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1H": "h",
      "1D": "d",
      "1W": "w",
      "1M": "mo",
    };
    return map[interval] || "h";
  };

  const handleIntervalSelect = (interval: string) => {
    const newTimeframe = getTimeframeFromInterval(interval);
    setTimeframe(newTimeframe);
  };

  const handleSymbolSelect = (newSymbol: string, symbolType?: SymbolType, symbolName?: string) => {
    setSymbol(newSymbol, symbolType, symbolName);
  };

  const isVertical = orientation === "vertical";

  // Helper function to get symbol colors
  const getSymbolColors = (sym: string) => {
    const colorMap: Record<string, { bg: string; text: string }> = {
      AAPL: { bg: "bg-black", text: "text-white" },
      NVDA: { bg: "bg-white", text: "text-green-600" },
      MSFT: { bg: "bg-blue-600", text: "text-white" },
      GOOGL: { bg: "bg-blue-500", text: "text-white" },
      TSLA: { bg: "bg-red-600", text: "text-white" },
      META: { bg: "bg-blue-700", text: "text-white" },
      AMZN: { bg: "bg-orange-500", text: "text-black" },
      SPY: { bg: "bg-red-500", text: "text-white" },
      QQQ: { bg: "bg-green-600", text: "text-white" },
      DIS: { bg: "bg-blue-600", text: "text-white" },
      NFLX: { bg: "bg-red-600", text: "text-white" },
      AMD: { bg: "bg-green-500", text: "text-white" },
      INTC: { bg: "bg-blue-700", text: "text-white" },
      PYPL: { bg: "bg-blue-500", text: "text-white" },
      BABA: { bg: "bg-orange-600", text: "text-white" },
    };
    return colorMap[sym] || { bg: "bg-zinc-600", text: "text-white" };
  };

  const symbolColors = getSymbolColors(symbol);
  const displayInterval = getDisplayInterval(timeframe);

  return (
    <>
      <div
        className={
          isVertical
            ? "mt-12 w-16 h-full border-r border-zinc-700 flex flex-col items-center justify-start gap-4 py-4"
            : "h-12 border-y border-zinc-700 flex items-center justify-center gap-6 px-4"
        }
      >
        <button
          onClick={() => setIsSymbolDrawerOpen(true)}
          className={
            isVertical
              ? "flex items-center justify-center"
              : "flex gap-3 items-center"
          }
        >
          {symbolImage ? (
            <img 
              src={symbolImage} 
              alt={symbol}
              className="w-8 h-8 rounded-md object-cover border border-x-zinc-600 border-t-zinc-400 border-b-zinc-500"
            />
          ) : (
            <div
              className={`w-8 h-8 font-bold text-xs text-center ${symbolColors.bg} rounded-md ${symbolColors.text} flex items-center justify-center`}
            >
              {symbol.substring(0, 3)}
            </div>
          )}
          {!isVertical && <div className="font-bold">{symbol}</div>}
        </button>

        <button
          onClick={() => setIsIntervalDrawerOpen(true)}
          className={
            isVertical
              ? "bg-zinc-800 px-2 py-1.5 rounded-md text-xs font-medium"
              : "bg-zinc-800 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
          }
        >
          {displayInterval}
          {!isVertical && (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </button>

        <button
          onClick={() => setIsDrawingsDrawerOpen(true)}
          className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
        >
          <PencilIcon />
        </button>

        {selectedDrawingId && (
          <button
            onClick={() => setIsStyleDrawerOpen(true)}
            className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <PaletteIcon />
          </button>
        )}

        <button
          onClick={() => setIsSettingsDrawerOpen(true)}
          className={
            isVertical
              ? "p-2 hover:bg-zinc-800 rounded-md transition-colors"
              : "p-2 hover:bg-zinc-800 rounded-md transition-colors ml-auto"
          }
        >
          <CogIcon />
        </button>
      </div>

      <IntervalDrawer
        isOpen={isIntervalDrawerOpen}
        onOpenChange={setIsIntervalDrawerOpen}
        selectedInterval={displayInterval}
        onIntervalSelect={handleIntervalSelect}
      />

      <SymbolDrawer
        isOpen={isSymbolDrawerOpen}
        onOpenChange={setIsSymbolDrawerOpen}
        selectedSymbol={symbol}
        onSymbolSelect={handleSymbolSelect}
        initialSearchLetter={initialSearchLetter}
      />

      <DrawingsDrawer
        isOpen={isDrawingsDrawerOpen}
        onOpenChange={setIsDrawingsDrawerOpen}
        selectedDrawing={activeTool}
        onDrawingSelect={setActiveTool}
      />

      <DrawingStyleDrawer
        isOpen={isStyleDrawerOpen}
        onOpenChange={setIsStyleDrawerOpen}
      />

      <SettingsDrawer
        isOpen={isSettingsDrawerOpen}
        onOpenChange={setIsSettingsDrawerOpen}
      />

      <ChartKeyboardHandler
        isSymbolDrawerOpen={isSymbolDrawerOpen}
        isAnyDrawerOpen={isSymbolDrawerOpen || isIntervalDrawerOpen || isDrawingsDrawerOpen || isStyleDrawerOpen || isSettingsDrawerOpen}
        handleIntervalSelect={handleIntervalSelect}
        isIntervalDrawerOpen={isIntervalDrawerOpen}
        hideIntervalDrawer={() => {
          setIsIntervalDrawerOpen(false);
        }}
        showSymbolDrawer={(letter?: string) => {
          setInitialSearchLetter(letter);
          setIsSymbolDrawerOpen(true);
        }}
        showIntervalDrawer={() => {
          setIsIntervalDrawerOpen(true);
        }}
      />
    </>
  );
};

export default ChartBar;
