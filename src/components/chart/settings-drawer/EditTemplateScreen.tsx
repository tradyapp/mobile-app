import { List, ListItem, Toggle } from "konsta/react";
import type { ChartColors } from "@/stores/chartSettingsStore";
import { ScreenHeader, COLOR_ITEMS, ColorRow, type ColorTarget } from "./shared";

interface EditTemplateScreenProps {
  onBack: () => void;
  onClose: () => void;
  editingId: string | null;
  editingName: string;
  onNameChange: (name: string) => void;
  editingColors: ChartColors;
  editingFilledUp: boolean;
  editingFilledDown: boolean;
  onToggleFilledUp: () => void;
  onToggleFilledDown: () => void;
  onOpenColorPicker: (target: ColorTarget) => void;
  onSave: () => void;
}

export default function EditTemplateScreen({
  onBack,
  onClose,
  editingId,
  editingName,
  onNameChange,
  editingColors,
  editingFilledUp,
  editingFilledDown,
  onToggleFilledUp,
  onToggleFilledDown,
  onOpenColorPicker,
  onSave,
}: EditTemplateScreenProps) {
  return (
    <>
      <ScreenHeader
        onBack={onBack}
        onClose={onClose}
        title={editingId ? 'Edit Template' : 'New Template'}
      />

      {/* Template name */}
      <div className="mb-4">
        <input
          type="text"
          value={editingName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Template name"
          className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white text-base border border-zinc-700 focus:border-blue-500 focus:outline-none transition-colors placeholder:text-zinc-500"
        />
      </div>

      {/* Color list */}
      <div className="space-y-2 mb-4">
        {COLOR_ITEMS.map((item) => (
          <ColorRow
            key={item.id}
            label={item.label}
            color={editingColors[item.id]}
            onClick={() => onOpenColorPicker(item.id)}
          />
        ))}
      </div>

      {/* Candle fill toggles */}
      <List strong className="mb-4! rounded-xl overflow-hidden">
        <ListItem
          title="Filled Up Candle"
          after={
            <Toggle
              checked={editingFilledUp}
              onChange={onToggleFilledUp}
            />
          }
        />
        <ListItem
          title="Filled Down Candle"
          after={
            <Toggle
              checked={editingFilledDown}
              onChange={onToggleFilledDown}
            />
          }
        />
      </List>

      {/* Save button */}
      <button
        onClick={onSave}
        className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
      >
        {editingId ? 'Save Changes' : 'Create Template'}
      </button>
    </>
  );
}
