"use client";

import { useState } from "react";
import { ScreenHeader, hslToHex, hexToHsl } from "../drawing-style/shared";
import GradientColorPicker from "../drawing-style/GradientColorPicker";

interface HslPickerScreenProps {
  onBack: () => void;
  onClose: () => void;
  onAddColor: (hex: string) => void;
  initialColor: string;
}

export default function HslPickerScreen({
  onBack,
  onClose,
  onAddColor,
  initialColor,
}: HslPickerScreenProps) {
  const [h, s, l] = hexToHsl(initialColor);
  const [pickerHue, setPickerHue] = useState(h);
  const [pickerSaturation, setPickerSaturation] = useState(s);
  const [pickerLightness, setPickerLightness] = useState(l);

  const currentHex = hslToHex(pickerHue, pickerSaturation, pickerLightness);

  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Color Picker" />

      <div className="mb-4">
        <GradientColorPicker
          hue={pickerHue}
          saturation={pickerSaturation}
          lightness={pickerLightness}
          onSaturationChange={setPickerSaturation}
          onLightnessChange={setPickerLightness}
        />
      </div>

      <div className="mb-4">
        <div className="text-zinc-500 text-xs mb-1.5">Hue</div>
        <input
          type="range"
          min={0}
          max={360}
          value={pickerHue}
          onChange={(e) => setPickerHue(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-400 [&::-webkit-slider-thumb]:shadow"
          style={{
            background:
              "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
          }}
        />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-lg border border-zinc-600"
          style={{ backgroundColor: currentHex }}
        />
        <span className="text-zinc-400 text-xs font-mono">{currentHex}</span>
      </div>

      <button
        onClick={() => onAddColor(currentHex)}
        className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
      >
        Add Color
      </button>
    </>
  );
}
