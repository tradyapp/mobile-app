"use client";

import { useState } from "react";
import type { TextHAlign, TextVAlign } from "@/stores/drawingStore";
import { ScreenHeader } from "../drawing-style/shared";

const H_ALIGN_OPTIONS: {
  value: TextHAlign;
  label: string;
  icon: string;
}[] = [
  { value: "left", label: "Left", icon: "M4 6h16M4 12h10M4 18h14" },
  { value: "center", label: "Center", icon: "M4 6h16M7 12h10M5 18h14" },
  { value: "right", label: "Right", icon: "M4 6h16M10 12h10M6 18h14" },
];

const V_ALIGN_OPTIONS: { value: TextVAlign; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

interface TextEditScreenProps {
  initialContent: string;
  initialFontSize: number;
  initialHAlign: TextHAlign;
  initialVAlign: TextVAlign;
  onApplyProp: (style: {
    textContent?: string;
    fontSize?: number;
    textHAlign?: TextHAlign;
    textVAlign?: TextVAlign;
  }) => void;
  onBack: () => void;
  onClose: () => void;
}

export default function TextEditScreen({
  initialContent,
  initialFontSize,
  initialHAlign,
  initialVAlign,
  onApplyProp,
  onBack,
  onClose,
}: TextEditScreenProps) {
  const [textContent, setTextContent] = useState(initialContent);
  const [textFontSize, setTextFontSize] = useState(initialFontSize);
  const [textHAlign, setTextHAlign] = useState<TextHAlign>(initialHAlign);
  const [textVAlign, setTextVAlign] = useState<TextVAlign>(initialVAlign);

  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Text" />

      <div className="mb-6">
        <div className="text-zinc-500 text-xs mb-3">Content</div>
        <textarea
          rows={3}
          value={textContent}
          onChange={(e) => {
            setTextContent(e.target.value);
            onApplyProp({ textContent: e.target.value });
          }}
          placeholder="Enter text..."
          autoFocus
          className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white text-base border-2 border-zinc-700 focus:border-blue-500 focus:outline-none transition-colors placeholder:text-zinc-500 resize-none"
        />
      </div>

      <div className="mb-6">
        <div className="text-zinc-500 text-xs mb-3">Size</div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={textFontSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTextFontSize(v);
              onApplyProp({ fontSize: v });
            }}
            className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-400 [&::-webkit-slider-thumb]:shadow"
          />
          <span className="text-zinc-400 text-xs font-mono w-10 text-right shrink-0">
            {textFontSize}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <div className="text-zinc-500 text-xs mb-3">Horizontal Align</div>
        <div className="flex items-center gap-3">
          {H_ALIGN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setTextHAlign(opt.value);
                onApplyProp({ textHAlign: opt.value });
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                textHAlign === opt.value
                  ? "bg-zinc-700 text-white border-2 border-white"
                  : "bg-zinc-800 text-zinc-400 border-2 border-transparent"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeWidth={2} d={opt.icon} />
              </svg>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="text-zinc-500 text-xs mb-3">Vertical Align</div>
        <div className="flex items-center gap-3">
          {V_ALIGN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setTextVAlign(opt.value);
                onApplyProp({ textVAlign: opt.value });
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                textVAlign === opt.value
                  ? "bg-zinc-700 text-white border-2 border-white"
                  : "bg-zinc-800 text-zinc-400 border-2 border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
