import { List, ListItem, Toggle } from "konsta/react";
import type { ChartColors, ChartPreferences } from "@/stores/chartSettingsStore";
import { ScreenHeader, ChevronRight, TemplateColorPreview } from "./shared";

interface ChartSettingsScreenProps {
  onBack: () => void;
  onClose: () => void;
  onOpenColors: () => void;
  activeColors: ChartColors;
  preferences: ChartPreferences;
  onToggleVolume: () => void;
  onToggleMaNameLabels: () => void;
  onToggleMaPriceLabels: () => void;
  onToggleLastPriceLine: () => void;
}

export default function ChartSettingsScreen({
  onBack,
  onClose,
  onOpenColors,
  activeColors,
  preferences,
  onToggleVolume,
  onToggleMaNameLabels,
  onToggleMaPriceLabels,
  onToggleLastPriceLine,
}: ChartSettingsScreenProps) {
  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Chart" />

      <div className="space-y-2 pb-6">
        {/* Colors / Templates */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onOpenColors();
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TemplateColorPreview colors={activeColors} />
              <span className="text-base">Colors</span>
            </div>
            <ChevronRight />
          </div>
        </button>

        {/* Toggles */}
        <List strong className="mt-4! rounded-xl overflow-hidden">
          <ListItem
            title="Show Volume"
            after={
              <Toggle
                checked={preferences.showVolume}
                onChange={onToggleVolume}
              />
            }
          />
          <ListItem
            title="Show MA Name Labels"
            after={
              <Toggle
                checked={preferences.showMaNameLabels}
                onChange={onToggleMaNameLabels}
              />
            }
          />
          <ListItem
            title="Show MA Price Labels"
            after={
              <Toggle
                checked={preferences.showMaPriceLabels}
                onChange={onToggleMaPriceLabels}
              />
            }
          />
          <ListItem
            title="Show Last Price Line"
            after={
              <Toggle
                checked={preferences.showLastPriceLine}
                onChange={onToggleLastPriceLine}
              />
            }
          />
        </List>
      </div>
    </>
  );
}
