"use client";

import { useState } from "react";
import type { StrokeDash } from "@/stores/drawingStore";
import {
  ScreenHeader,
  THICKNESS_OPTIONS,
  DASH_OPTIONS,
  dashToSvg,
} from "../drawing-style/shared";

interface StrokeScreenProps {
  initialThickness: number;
  initialDashStyle: StrokeDash;
  strokeColor: string;
  onApply: (thickness: number, dashStyle: StrokeDash) => void;
  onBack: () => void;
  onClose: () => void;
}

export default function StrokeScreen({
  initialThickness,
  initialDashStyle,
  strokeColor,
  onApply,
  onBack,
  onClose,
}: StrokeScreenProps) {
  const [thickness, setThickness] = useState(initialThickness);
  const [dashStyle, setDashStyle] = useState<StrokeDash>(initialDashStyle);

  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Stroke" />

      <div className="mb-6">
        <div className="text-zinc-500 text-xs mb-3">Thickness</div>
        <div className="flex items-center gap-3">
          {THICKNESS_OPTIONS.map((px) => (
            <button
              key={px}
              onClick={() => setThickness(px)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                thickness === px
                  ? "bg-zinc-700 text-white border-2 border-white"
                  : "bg-zinc-800 text-zinc-400 border-2 border-transparent"
              }`}
            >
              {px}px
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="text-zinc-500 text-xs mb-3">Style</div>
        <div className="flex items-center gap-3">
          {DASH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDashStyle(opt.value)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                dashStyle === opt.value
                  ? "bg-zinc-700 text-white border-2 border-white"
                  : "bg-zinc-800 text-zinc-400 border-2 border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center mt-3 py-3 bg-zinc-800 rounded-lg">
          <svg
            width="120"
            height={Math.max(thickness * 2, 8)}
            className="overflow-visible"
          >
            <line
              x1="0"
              y1={Math.max(thickness, 4)}
              x2="120"
              y2={Math.max(thickness, 4)}
              stroke={strokeColor}
              strokeWidth={thickness}
              strokeDasharray={dashToSvg(dashStyle)}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <button
        onClick={() => onApply(thickness, dashStyle)}
        className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
      >
        Apply
      </button>
    </>
  );
}
