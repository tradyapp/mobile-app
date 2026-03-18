'use client'

import { useState, useCallback, createContext, useContext } from "react";
import AppDrawer, { type DrawerScreen } from "../uiux/AppDrawer";
import { useDrawerNav } from "../uiux/drawer-nav";
import {
  useChartSettingsStore,
  DEFAULT_COLORS,
  type ChartColors,
  type ChartTemplate,
} from "@/stores/chartSettingsStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useChartStore } from "@/stores/chartStore";
import {
  useDrawingTemplateStore,
  type DrawingTemplateCategory,
  type DrawingTemplate,
} from "@/stores/drawingTemplateStore";
import {
  ensureColorInPalette,
  saveCustomColors,
} from "./drawing-style/shared";
import TemplateGridView from "./drawing-style/TemplateGridView";
import TemplateEditorScreen from "./drawing-style/TemplateEditorScreen";
import ColorPaletteView from "./drawing-style/ColorPaletteView";
import DefaultStylesScreen from "./drawings-drawer/DefaultStylesScreen";
import HslPickerScreen from "./drawings-drawer/HslPickerScreen";
import ClearDrawingsDialog from "./drawings-drawer/ClearDrawingsDialog";

import { type ColorTarget, menuItems, COLOR_ITEMS } from "./settings-drawer/shared";
import ChartSettingsScreen from "./settings-drawer/ChartSettingsScreen";
import ColorsScreen from "./settings-drawer/ColorsScreen";
import EditTemplateScreen from "./settings-drawer/EditTemplateScreen";
import ColorPickerScreen from "./settings-drawer/ColorPickerScreen";
import DrawingsScreen from "./settings-drawer/DrawingsScreen";

// ── Domain context for SettingsDrawer screens ──

interface SettingsCtxValue {
  // Chart settings store
  customTemplates: ChartTemplate[];
  activeTemplateId: string;
  activeColors: ChartColors;
  setActiveTemplate: (id: string) => void;
  saveTemplate: (template: ChartTemplate) => void;
  deleteTemplate: (id: string) => void;
  preferences: { showVolume: boolean };
  setPreferences: (prefs: { showVolume: boolean }) => void;
  // Template editor state
  editingColors: ChartColors;
  setEditingColors: React.Dispatch<React.SetStateAction<ChartColors>>;
  editingName: string;
  setEditingName: React.Dispatch<React.SetStateAction<string>>;
  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  editingFilledUp: boolean;
  setEditingFilledUp: React.Dispatch<React.SetStateAction<boolean>>;
  editingFilledDown: boolean;
  setEditingFilledDown: React.Dispatch<React.SetStateAction<boolean>>;
  // Color picker state
  colorTarget: ColorTarget;
  setColorTarget: React.Dispatch<React.SetStateAction<ColorTarget>>;
  colorPickerInitial: string;
  setColorPickerInitial: React.Dispatch<React.SetStateAction<string>>;
  // Drawing state
  drawings: { length: number };
  clearDrawings: (symbol: string) => void;
  symbol: string;
  isClearDialogOpen: boolean;
  setIsClearDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  drawingPickerCategory: DrawingTemplateCategory;
  setDrawingPickerCategory: React.Dispatch<React.SetStateAction<DrawingTemplateCategory>>;
  drawingEditingTemplate: DrawingTemplate | null;
  setDrawingEditingTemplate: React.Dispatch<React.SetStateAction<DrawingTemplate | null>>;
  drawingEditorPickedColor: string | null;
  setDrawingEditorPickedColor: React.Dispatch<React.SetStateAction<string | null>>;
  drawingEditorPickedOpacity: number | null;
  setDrawingEditorPickedOpacity: React.Dispatch<React.SetStateAction<number | null>>;
  drawingEditorPickedTarget: 'stroke' | 'fill-solid' | 'fill-g1' | 'fill-g2' | null;
  setDrawingEditorPickedTarget: React.Dispatch<React.SetStateAction<'stroke' | 'fill-solid' | 'fill-g1' | 'fill-g2' | null>>;
  drawingSelectedColor: string;
  setDrawingSelectedColor: React.Dispatch<React.SetStateAction<string>>;
  drawingColorOpacity: number;
  setDrawingColorOpacity: React.Dispatch<React.SetStateAction<number>>;
  drawingCustomColors: string[];
  setDrawingCustomColors: React.Dispatch<React.SetStateAction<string[]>>;
  getDrawingDefaultTemplate: (cat: DrawingTemplateCategory) => DrawingTemplate;
  setDrawingDefaultTemplate: (cat: DrawingTemplateCategory, id: string) => void;
}

const SettingsCtx = createContext<SettingsCtxValue>(null!);

// ── Screen wrapper components ──

function MenuScreenWrapper() {
  const { navigateTo } = useDrawerNav();
  return (
    <div className="space-y-2 pb-6">
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => navigateTo(item.id)}
          className="w-full px-4 py-4 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-left"
        >
          <div className="flex items-center gap-4">
            <div className="text-zinc-400">{item.icon}</div>
            <div className="text-base text-white font-medium">{item.label}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ChartSettingsScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo } = useDrawerNav();

  return (
    <ChartSettingsScreen
      onBack={goBack}
      onClose={close}
      onOpenColors={() => navigateTo('colors')}
      activeColors={ctx.activeColors}
      preferences={ctx.preferences}
      onToggleVolume={() => ctx.setPreferences({ showVolume: !ctx.preferences.showVolume })}
    />
  );
}

function ColorsScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo } = useDrawerNav();

  const startNewTemplate = useCallback(() => {
    ctx.setEditingId(null);
    ctx.setEditingName('');
    ctx.setEditingColors({ ...DEFAULT_COLORS });
    ctx.setEditingFilledUp(true);
    ctx.setEditingFilledDown(true);
    navigateTo('edit-template');
  }, [ctx, navigateTo]);

  const startEditTemplate = useCallback((template: ChartTemplate) => {
    ctx.setEditingId(template.id);
    ctx.setEditingName(template.name);
    ctx.setEditingColors({ ...template.colors });
    ctx.setEditingFilledUp(template.filledUpCandle !== false);
    ctx.setEditingFilledDown(template.filledDownCandle !== false);
    navigateTo('edit-template');
  }, [ctx, navigateTo]);

  const duplicateTemplate = useCallback((template: ChartTemplate) => {
    ctx.setEditingId(null);
    ctx.setEditingName(`${template.name} Copy`);
    ctx.setEditingColors({ ...template.colors });
    ctx.setEditingFilledUp(template.filledUpCandle !== false);
    ctx.setEditingFilledDown(template.filledDownCandle !== false);
    navigateTo('edit-template');
  }, [ctx, navigateTo]);

  return (
    <ColorsScreen
      onBack={goBack}
      onClose={close}
      customTemplates={ctx.customTemplates}
      activeTemplateId={ctx.activeTemplateId}
      onSelectTemplate={ctx.setActiveTemplate}
      onCreateNew={startNewTemplate}
      onEdit={startEditTemplate}
      onDuplicate={duplicateTemplate}
      onDelete={ctx.deleteTemplate}
    />
  );
}

function EditTemplateScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo } = useDrawerNav();

  const handleSave = useCallback(() => {
    const id = ctx.editingId ?? crypto.randomUUID();
    const template: ChartTemplate = {
      id,
      name: ctx.editingName.trim() || 'Custom',
      colors: ctx.editingColors,
      filledUpCandle: ctx.editingFilledUp,
      filledDownCandle: ctx.editingFilledDown,
    };
    ctx.saveTemplate(template);
    ctx.setActiveTemplate(id);
    goBack();
  }, [ctx, goBack]);

  return (
    <EditTemplateScreen
      onBack={goBack}
      onClose={close}
      editingId={ctx.editingId}
      editingName={ctx.editingName}
      onNameChange={ctx.setEditingName}
      editingColors={ctx.editingColors}
      editingFilledUp={ctx.editingFilledUp}
      editingFilledDown={ctx.editingFilledDown}
      onToggleFilledUp={() => ctx.setEditingFilledUp(prev => !prev)}
      onToggleFilledDown={() => ctx.setEditingFilledDown(prev => !prev)}
      onOpenColorPicker={(target: ColorTarget) => {
        ctx.setColorTarget(target);
        ctx.setColorPickerInitial(ctx.editingColors[target]);
        navigateTo('color-picker');
      }}
      onSave={handleSave}
    />
  );
}

function ColorPickerScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close } = useDrawerNav();

  return (
    <ColorPickerScreen
      onBack={goBack}
      onClose={close}
      colorTarget={ctx.colorTarget}
      initialColor={ctx.colorPickerInitial}
      onApply={(color: string) => {
        ctx.setEditingColors(prev => ({ ...prev, [ctx.colorTarget]: color }));
        goBack();
      }}
    />
  );
}

function IndicatorsScreenWrapper() {
  return <p className="text-zinc-400 text-center py-8">Work in progress</p>;
}

function OrionScreenWrapper() {
  return <p className="text-zinc-400 text-center py-8">Work in progress</p>;
}

function DrawingsScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo } = useDrawerNav();

  return (
    <DrawingsScreen
      onBack={goBack}
      onClose={close}
      onOpenConfig={() => navigateTo('drawing-default-styles')}
      onClearAll={() => ctx.setIsClearDialogOpen(true)}
      drawingsCount={ctx.drawings.length}
    />
  );
}

function DefaultStylesScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo } = useDrawerNav();

  return (
    <DefaultStylesScreen
      onBack={goBack}
      onClose={close}
      onPickCategory={(cat: DrawingTemplateCategory) => {
        ctx.setDrawingPickerCategory(cat);
        navigateTo('drawing-template-picker');
      }}
    />
  );
}

function DrawingTemplatePickerScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, navigateTo } = useDrawerNav();

  return (
    <TemplateGridView
      category={ctx.drawingPickerCategory}
      activeTemplateId={ctx.getDrawingDefaultTemplate(ctx.drawingPickerCategory).id}
      onSelect={(template) => {
        ctx.setDrawingDefaultTemplate(ctx.drawingPickerCategory, template.id);
        goBack();
      }}
      onCreateNew={() => {
        ctx.setDrawingEditingTemplate(null);
        ctx.setDrawingEditorPickedColor(null);
        ctx.setDrawingEditorPickedOpacity(null);
        ctx.setDrawingEditorPickedTarget(null);
        navigateTo('drawing-edit-template');
      }}
      onEditTemplate={(template) => {
        ctx.setDrawingEditingTemplate(template);
        ctx.setDrawingEditorPickedColor(null);
        ctx.setDrawingEditorPickedOpacity(null);
        ctx.setDrawingEditorPickedTarget(null);
        navigateTo('drawing-edit-template');
      }}
    />
  );
}

function DrawingEditTemplateScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo } = useDrawerNav();

  return (
    <TemplateEditorScreen
      category={ctx.drawingPickerCategory}
      editingTemplate={ctx.drawingEditingTemplate}
      onBack={goBack}
      onClose={close}
      onPickColor={(currentColor, currentOpacity, target) => {
        ctx.setDrawingEditorPickedTarget(target);
        ctx.setDrawingSelectedColor(currentColor);
        ctx.setDrawingColorOpacity(currentOpacity);
        ctx.setDrawingCustomColors(ensureColorInPalette(currentColor));
        navigateTo('drawing-color-picker');
      }}
      pickedColor={ctx.drawingEditorPickedColor}
      pickedOpacity={ctx.drawingEditorPickedOpacity}
      pickedTarget={ctx.drawingEditorPickedTarget}
      clearPickedColor={() => {
        ctx.setDrawingEditorPickedColor(null);
        ctx.setDrawingEditorPickedOpacity(null);
        ctx.setDrawingEditorPickedTarget(null);
      }}
    />
  );
}

function DrawingColorPickerScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, navigateTo } = useDrawerNav();

  return (
    <ColorPaletteView
      selectedColor={ctx.drawingSelectedColor}
      opacity={ctx.drawingColorOpacity}
      customColors={ctx.drawingCustomColors}
      onSelectColor={ctx.setDrawingSelectedColor}
      onOpacityChange={ctx.setDrawingColorOpacity}
      onAddColor={() => navigateTo('drawing-hsl-picker')}
      onApply={() => {
        ctx.setDrawingEditorPickedColor(ctx.drawingSelectedColor);
        ctx.setDrawingEditorPickedOpacity(ctx.drawingColorOpacity);
        goBack();
      }}
      minOpacity={10}
    />
  );
}

function DrawingHslPickerScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close } = useDrawerNav();

  return (
    <HslPickerScreen
      onBack={goBack}
      onClose={close}
      onAddColor={(hex: string) => {
        const updated = [...ctx.drawingCustomColors, hex];
        ctx.setDrawingCustomColors(updated);
        saveCustomColors(updated);
        ctx.setDrawingSelectedColor(hex);
        goBack();
      }}
      initialColor={ctx.drawingSelectedColor}
    />
  );
}

// ── Screen definitions ──

const SCREENS: DrawerScreen[] = [
  { name: 'menu', title: 'Settings', component: MenuScreenWrapper, isRoot: true },
  { name: 'chart', title: 'Chart', component: ChartSettingsScreenWrapper },
  { name: 'colors', title: 'Colors', component: ColorsScreenWrapper },
  { name: 'edit-template', title: (params) => params?.editingId ? 'Edit Template' : 'New Template', component: EditTemplateScreenWrapper },
  { name: 'color-picker', title: (params) => {
    const target = params?.target as string | undefined;
    return COLOR_ITEMS.find(c => c.id === target)?.label ?? 'Color';
  }, component: ColorPickerScreenWrapper },
  { name: 'indicators', title: 'Indicators', component: IndicatorsScreenWrapper },
  { name: 'orion', title: 'Orion', component: OrionScreenWrapper },
  { name: 'drawings', title: 'Drawings', component: DrawingsScreenWrapper },
  { name: 'drawing-default-styles', title: 'Default Styles', component: DefaultStylesScreenWrapper },
  { name: 'drawing-template-picker', title: (params) => {
    const cat = params?.category as string | undefined;
    return cat === 'line' ? 'Line Defaults' : cat === 'shape' ? 'Shape Defaults' : 'Text Defaults';
  }, component: DrawingTemplatePickerScreenWrapper },
  { name: 'drawing-edit-template', title: 'Edit Template', component: DrawingEditTemplateScreenWrapper },
  { name: 'drawing-color-picker', title: 'Color', component: DrawingColorPickerScreenWrapper },
  { name: 'drawing-hsl-picker', title: 'Color Picker', component: DrawingHslPickerScreenWrapper },
];

// ── Main component ──

interface SettingsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsDrawer({
  isOpen,
  onOpenChange,
}: SettingsDrawerProps) {
  // Store
  const {
    customTemplates,
    activeTemplateId,
    activeColors,
    setActiveTemplate,
    saveTemplate,
    deleteTemplate,
    preferences,
    setPreferences,
  } = useChartSettingsStore();

  // Drawing-related stores & state
  const { symbol } = useChartStore();
  const { drawings, clearDrawings } = useDrawingStore();
  const { getDefaultTemplate: getDrawingDefaultTemplate, setDefaultTemplate: setDrawingDefaultTemplate } = useDrawingTemplateStore();
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [drawingPickerCategory, setDrawingPickerCategory] = useState<DrawingTemplateCategory>("line");
  const [drawingEditingTemplate, setDrawingEditingTemplate] = useState<DrawingTemplate | null>(null);
  const [drawingEditorPickedColor, setDrawingEditorPickedColor] = useState<string | null>(null);
  const [drawingEditorPickedOpacity, setDrawingEditorPickedOpacity] = useState<number | null>(null);
  const [drawingEditorPickedTarget, setDrawingEditorPickedTarget] = useState<"stroke" | "fill-solid" | "fill-g1" | "fill-g2" | null>(null);
  const [drawingSelectedColor, setDrawingSelectedColor] = useState("#ffffff");
  const [drawingColorOpacity, setDrawingColorOpacity] = useState(100);
  const [drawingCustomColors, setDrawingCustomColors] = useState<string[]>([]);

  // Template editor state
  const [editingColors, setEditingColors] = useState<ChartColors>({ ...DEFAULT_COLORS });
  const [editingName, setEditingName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFilledUp, setEditingFilledUp] = useState(true);
  const [editingFilledDown, setEditingFilledDown] = useState(true);

  // Color picker state
  const [colorTarget, setColorTarget] = useState<ColorTarget>('candleUp');
  const [colorPickerInitial, setColorPickerInitial] = useState('#00ff99');

  const ctxValue: SettingsCtxValue = {
    customTemplates, activeTemplateId, activeColors,
    setActiveTemplate, saveTemplate, deleteTemplate,
    preferences, setPreferences,
    editingColors, setEditingColors,
    editingName, setEditingName,
    editingId, setEditingId,
    editingFilledUp, setEditingFilledUp,
    editingFilledDown, setEditingFilledDown,
    colorTarget, setColorTarget,
    colorPickerInitial, setColorPickerInitial,
    drawings, clearDrawings, symbol,
    isClearDialogOpen, setIsClearDialogOpen,
    drawingPickerCategory, setDrawingPickerCategory,
    drawingEditingTemplate, setDrawingEditingTemplate,
    drawingEditorPickedColor, setDrawingEditorPickedColor,
    drawingEditorPickedOpacity, setDrawingEditorPickedOpacity,
    drawingEditorPickedTarget, setDrawingEditorPickedTarget,
    drawingSelectedColor, setDrawingSelectedColor,
    drawingColorOpacity, setDrawingColorOpacity,
    drawingCustomColors, setDrawingCustomColors,
    getDrawingDefaultTemplate, setDrawingDefaultTemplate,
  };

  return (
    <SettingsCtx.Provider value={ctxValue}>
      <AppDrawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Settings"
        height="full"
        description="Chart settings, indicators, and Orion studies."
        screens={SCREENS}
        contentClassName="flex-1 overflow-y-auto"
      />

      <ClearDrawingsDialog
        isOpen={isClearDialogOpen}
        onClose={() => setIsClearDialogOpen(false)}
        onConfirm={() => {
          clearDrawings(symbol);
          setIsClearDialogOpen(false);
        }}
      />
    </SettingsCtx.Provider>
  );
}
