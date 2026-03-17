import { PRESET_COLORS } from "./shared";

interface ColorPaletteViewProps {
  selectedColor: string;
  opacity: number;
  customColors: string[];
  onSelectColor: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  onAddColor: () => void;
  onApply: () => void;
  /** Min opacity value for slider (default 10) */
  minOpacity?: number;
}

export default function ColorPaletteView({
  selectedColor,
  opacity,
  customColors,
  onSelectColor,
  onOpacityChange,
  onAddColor,
  onApply,
  minOpacity = 10,
}: ColorPaletteViewProps) {
  return (
    <>
      {/* Preset color grid — rows of 8 */}
      <div className="grid grid-cols-8 gap-2.5 mb-4">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onSelectColor(color)}
            className={`w-8 h-8 rounded-full border-2 transition-all mx-auto ${
              selectedColor === color
                ? 'border-white/50 scale-110'
                : 'border-zinc-700'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <div className="border-t border-zinc-700 my-4" />

      {/* Custom colors row */}
      <div className="mb-4">
        <div className="text-zinc-500 text-xs mb-2">Custom Colors</div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {customColors.map((color, i) => (
            <button
              key={`custom-${i}`}
              onClick={() => onSelectColor(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                selectedColor === color
                  ? 'border-white/50 scale-110'
                  : 'border-zinc-700'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <button
            onClick={onAddColor}
            className="w-8 h-8 rounded-full border-2 border-zinc-700 flex items-center justify-center bg-zinc-800 hover:border-zinc-500 transition-all"
          >
            <span className="text-zinc-400 text-lg leading-none">+</span>
          </button>
        </div>
      </div>

      {/* Opacity slider */}
      <div className="mb-6">
        <div className="text-zinc-500 text-xs mb-2">Opacity</div>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border border-zinc-600 shrink-0"
            style={{
              backgroundColor: selectedColor,
              opacity: opacity / 100,
            }}
          />
          <input
            type="range"
            min={minOpacity}
            max={100}
            value={opacity}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-400 [&::-webkit-slider-thumb]:shadow"
          />
          <span className="text-zinc-400 text-xs font-mono w-8 text-right shrink-0">{opacity}%</span>
        </div>
      </div>

      {/* Apply button */}
      <button
        onClick={onApply}
        className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
      >
        Apply
      </button>
    </>
  );
}
