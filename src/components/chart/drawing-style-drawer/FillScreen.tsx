"use client";

import type { FillType, GradientDirection } from "@/stores/drawingStore";
import {
  ScreenHeader,
  FILL_TYPE_OPTIONS,
  GRADIENT_DIR_OPTIONS,
} from "../drawing-style/shared";

interface FillScreenProps {
  fillType: FillType;
  fillColor: string;
  fillOpacity: number;
  fillGradientColor1: string;
  fillGradientColor2: string;
  fillGradientOpacity1: number;
  fillGradientOpacity2: number;
  fillGradientDirection: GradientDirection;
  onFillTypeChange: (type: FillType) => void;
  onGradientDirectionChange: (dir: GradientDirection) => void;
  onPickColor: (target: "solid" | "gradient1" | "gradient2") => void;
  onBack: () => void;
  onClose: () => void;
}

export default function FillScreen({
  fillType,
  fillColor,
  fillOpacity,
  fillGradientColor1,
  fillGradientColor2,
  fillGradientOpacity1,
  fillGradientOpacity2,
  fillGradientDirection,
  onFillTypeChange,
  onGradientDirectionChange,
  onPickColor,
  onBack,
  onClose,
}: FillScreenProps) {
  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Fill" />

      <div className="mb-6">
        <div className="text-zinc-500 text-xs mb-3">Fill Type</div>
        <div className="flex items-center gap-3">
          {FILL_TYPE_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onPointerDown={(e) => {
                e.preventDefault();
                onFillTypeChange(opt.value);
              }}
              onClick={(e) => e.preventDefault()}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all [touch-action:manipulation] ${
                fillType === opt.value
                  ? "bg-zinc-700 text-white border-2 border-white"
                  : "bg-zinc-800 text-zinc-400 border-2 border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {fillType === "gradient" && (
        <div className="mb-6">
          <div className="text-zinc-500 text-xs mb-3">Direction</div>
          <div className="flex items-center gap-3">
            {GRADIENT_DIR_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onGradientDirectionChange(opt.value);
                }}
                onClick={(e) => e.preventDefault()}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all [touch-action:manipulation] ${
                  fillGradientDirection === opt.value
                    ? "bg-zinc-700 text-white border-2 border-white"
                    : "bg-zinc-800 text-zinc-400 border-2 border-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {fillType === "solid" && (
        <div className="space-y-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onPickColor("solid");
            }}
            onClick={(e) => e.preventDefault()}
            className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full border border-zinc-600"
                  style={{
                    backgroundColor: fillColor,
                    opacity: fillOpacity / 100,
                  }}
                />
                <span className="text-base">Color</span>
              </div>
              <svg
                className="w-5 h-5 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        </div>
      )}

      {fillType === "gradient" && (
        <div className="space-y-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onPickColor("gradient1");
            }}
            onClick={(e) => e.preventDefault()}
            className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full border border-zinc-600"
                  style={{
                    backgroundColor: fillGradientColor1,
                    opacity: fillGradientOpacity1 / 100,
                  }}
                />
                <span className="text-base">Color 1</span>
              </div>
              <svg
                className="w-5 h-5 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onPickColor("gradient2");
            }}
            onClick={(e) => e.preventDefault()}
            className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full border border-zinc-600"
                  style={{
                    backgroundColor: fillGradientColor2,
                    opacity: fillGradientOpacity2 / 100,
                  }}
                />
                <span className="text-base">Color 2</span>
              </div>
              <svg
                className="w-5 h-5 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
          <div className="mt-3 flex items-center justify-center py-3 bg-zinc-800 rounded-lg">
            <div
              className="w-full h-6 rounded mx-3"
              style={{
                background: `linear-gradient(to ${
                  fillGradientDirection === "down"
                    ? "bottom"
                    : fillGradientDirection === "up"
                      ? "top"
                      : fillGradientDirection
                }, ${fillGradientColor1}${Math.round(fillGradientOpacity1 * 2.55)
                  .toString(16)
                  .padStart(2, "0")}, ${fillGradientColor2}${Math.round(fillGradientOpacity2 * 2.55)
                  .toString(16)
                  .padStart(2, "0")})`,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
