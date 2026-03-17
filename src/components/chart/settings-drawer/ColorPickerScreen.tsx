import { useState, useMemo } from "react";
import { hslToHex, hexToHsl } from "../drawing-style/shared";
import GradientColorPicker from "../drawing-style/GradientColorPicker";
import { ScreenHeader, COLOR_ITEMS, type ColorTarget } from "./shared";

interface ColorPickerScreenProps {
  onBack: () => void;
  onClose: () => void;
  colorTarget: ColorTarget;
  initialColor: string;
  onApply: (color: string) => void;
}

export default function ColorPickerScreen({
  onBack,
  onClose,
  colorTarget,
  initialColor,
  onApply,
}: ColorPickerScreenProps) {
  const [hsl] = useState(() => hexToHsl(initialColor));
  const [pickerHue, setPickerHue] = useState(hsl[0]);
  const [pickerSaturation, setPickerSaturation] = useState(hsl[1]);
  const [pickerLightness, setPickerLightness] = useState(hsl[2]);
  const [selectedColor, setSelectedColor] = useState(initialColor);

  const colorTargetLabel = useMemo(() => {
    return COLOR_ITEMS.find(c => c.id === colorTarget)?.label ?? '';
  }, [colorTarget]);

  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title={colorTargetLabel} />

      {/* HSL Gradient Picker */}
      <div className="mb-4">
        <GradientColorPicker
          hue={pickerHue}
          saturation={pickerSaturation}
          lightness={pickerLightness}
          onSaturationChange={(s) => {
            setPickerSaturation(s);
            setSelectedColor(hslToHex(pickerHue, s, pickerLightness));
          }}
          onLightnessChange={(l) => {
            setPickerLightness(l);
            setSelectedColor(hslToHex(pickerHue, pickerSaturation, l));
          }}
        />
      </div>

      {/* Hue slider */}
      <div className="mb-4">
        <div className="text-zinc-500 text-xs mb-1.5">Hue</div>
        <input
          type="range"
          min={0}
          max={360}
          value={pickerHue}
          onChange={(e) => {
            const h = Number(e.target.value);
            setPickerHue(h);
            setSelectedColor(hslToHex(h, pickerSaturation, pickerLightness));
          }}
          className="w-full h-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-400 [&::-webkit-slider-thumb]:shadow"
          style={{
            background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          }}
        />
      </div>

      {/* Preview + hex */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-lg border border-zinc-600"
          style={{ backgroundColor: selectedColor }}
        />
        <span className="text-zinc-400 text-xs font-mono">{selectedColor}</span>
      </div>

      {/* Apply */}
      <button
        onClick={() => onApply(selectedColor)}
        className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
      >
        Apply
      </button>
    </>
  );
}
