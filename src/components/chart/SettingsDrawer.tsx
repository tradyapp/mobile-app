'use client'

import { useState, useCallback, createContext, useContext, useMemo } from "react";
import AppDrawer, { type DrawerScreen } from "../uiux/AppDrawer";
import { useDrawerNav } from "../uiux/drawer-nav";
import {
  useChartSettingsStore,
  DEFAULT_COLORS,
  type ChartColors,
  type ChartTemplate,
  type MovingAverageIndicator,
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
  getCustomColors,
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
import IndicatorsScreen from "./settings-drawer/IndicatorsScreen";
import AddIndicatorScreen from "./settings-drawer/AddIndicatorScreen";
import IndicatorAttributesScreen from "./settings-drawer/IndicatorAttributesScreen";

// ── Domain context for SettingsDrawer screens ──

interface SettingsCtxValue {
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
  indicatorSelectedColor: string;
  setIndicatorSelectedColor: React.Dispatch<React.SetStateAction<string>>;
  indicatorCustomColors: string[];
  setIndicatorCustomColors: React.Dispatch<React.SetStateAction<string[]>>;
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
          type="button"
          key={item.id}
          onPointerDown={(e) => {
            e.preventDefault();
            navigateTo(item.id);
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-left [touch-action:manipulation]"
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
  const { goBack, close, navigateTo } = useDrawerNav();
  const activeColors = useChartSettingsStore((s) => s.activeColors);
  const preferences = useChartSettingsStore((s) => s.preferences);
  const setPreferences = useChartSettingsStore((s) => s.setPreferences);

  return (
    <ChartSettingsScreen
      onBack={goBack}
      onClose={close}
      onOpenColors={() => navigateTo('colors')}
      activeColors={activeColors}
      preferences={preferences}
      onToggleVolume={() => setPreferences({ showVolume: !preferences.showVolume })}
    />
  );
}

function ColorsScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo } = useDrawerNav();
  const customTemplates = useChartSettingsStore((s) => s.customTemplates);
  const activeTemplateId = useChartSettingsStore((s) => s.activeTemplateId);
  const setActiveTemplate = useChartSettingsStore((s) => s.setActiveTemplate);
  const deleteTemplate = useChartSettingsStore((s) => s.deleteTemplate);

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
      customTemplates={customTemplates}
      activeTemplateId={activeTemplateId}
      onSelectTemplate={setActiveTemplate}
      onCreateNew={startNewTemplate}
      onEdit={startEditTemplate}
      onDuplicate={duplicateTemplate}
      onDelete={deleteTemplate}
    />
  );
}

function EditTemplateScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo } = useDrawerNav();
  const saveTemplate = useChartSettingsStore((s) => s.saveTemplate);
  const setActiveTemplate = useChartSettingsStore((s) => s.setActiveTemplate);

  const handleSave = useCallback(() => {
    const id = ctx.editingId ?? crypto.randomUUID();
    const template: ChartTemplate = {
      id,
      name: ctx.editingName.trim() || 'Custom',
      colors: ctx.editingColors,
      filledUpCandle: ctx.editingFilledUp,
      filledDownCandle: ctx.editingFilledDown,
    };
    saveTemplate(template);
    setActiveTemplate(id);
    goBack();
  }, [ctx, goBack, saveTemplate, setActiveTemplate]);

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
  const { goBack, close, navigateTo } = useDrawerNav();
  const preferences = useChartSettingsStore((s) => s.preferences);
  const setPreferences = useChartSettingsStore((s) => s.setPreferences);

  return (
    <IndicatorsScreen
      onBack={goBack}
      onClose={close}
      indicators={preferences.indicators}
      onAddIndicator={() => navigateTo('add-indicator')}
      onOpenAttributes={(id: string) => navigateTo('indicator-attributes', { id })}
      onRemoveIndicator={(id: string) => {
        setPreferences({
          indicators: preferences.indicators.filter((indicator) => indicator.id !== id),
        });
      }}
    />
  );
}

function AddIndicatorScreenWrapper() {
  const { goBack, close } = useDrawerNav();
  const preferences = useChartSettingsStore((s) => s.preferences);
  const setPreferences = useChartSettingsStore((s) => s.setPreferences);

  return (
    <AddIndicatorScreen
      onBack={goBack}
      onClose={close}
      activeIndicators={preferences.indicators}
      onAddMovingAverage={() => {
        const movingAverage: MovingAverageIndicator = {
          id: crypto.randomUUID(),
          type: 'sma',
          name: 'Moving Average',
          period: 20,
          source: 'close',
          color: '#f59e0b',
          lineWidth: 2,
          visible: true,
        };

        setPreferences({
          indicators: [...preferences.indicators, movingAverage],
        });
        goBack();
      }}
    />
  );
}

function IndicatorAttributesScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo, params, goBackTo } = useDrawerNav();
  const preferences = useChartSettingsStore((s) => s.preferences);
  const setPreferences = useChartSettingsStore((s) => s.setPreferences);

  const indicatorId = typeof params.id === 'string' ? params.id : '';
  const indicator = preferences.indicators.find((item) => item.id === indicatorId && item.type === 'sma');

  if (!indicator) {
    return (
      <div className="px-4 py-8 text-center text-zinc-400">
        Indicator not found.
      </div>
    );
  }

  return (
    <IndicatorAttributesScreen
      onBack={goBack}
      onClose={close}
      indicator={indicator}
      onOpenColorPicker={() => {
        ctx.setIndicatorSelectedColor(indicator.color);
        ctx.setIndicatorCustomColors(getCustomColors());
        navigateTo('indicator-color-picker', { id: indicator.id });
      }}
      onUpdate={(partial) => {
        setPreferences({
          indicators: preferences.indicators.map((item) => {
            if (item.id !== indicator.id || item.type !== 'sma') return item;
            return { ...item, ...partial };
          }),
        });
      }}
      onRemove={() => {
        setPreferences({
          indicators: preferences.indicators.filter((item) => item.id !== indicator.id),
        });
        goBackTo('indicators');
      }}
    />
  );
}

function IndicatorColorPickerScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, navigateTo, params } = useDrawerNav();
  const preferences = useChartSettingsStore((s) => s.preferences);
  const setPreferences = useChartSettingsStore((s) => s.setPreferences);
  const indicatorId = typeof params.id === 'string' ? params.id : '';

  return (
    <ColorPaletteView
      selectedColor={ctx.indicatorSelectedColor}
      opacity={100}
      customColors={ctx.indicatorCustomColors}
      onSelectColor={ctx.setIndicatorSelectedColor}
      onOpacityChange={() => { /* not used for indicators */ }}
      onAddColor={() => navigateTo('indicator-hsl-picker', { id: indicatorId })}
      onApply={() => {
        setPreferences({
          indicators: preferences.indicators.map((item) =>
            item.id === indicatorId && item.type === 'sma'
              ? { ...item, color: ctx.indicatorSelectedColor }
              : item
          ),
        });
        goBack();
      }}
      minOpacity={100}
    />
  );
}

function IndicatorHslPickerScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close } = useDrawerNav();

  return (
    <HslPickerScreen
      onBack={goBack}
      onClose={close}
      onAddColor={(hex: string) => {
        const updated = ensureColorInPalette(hex);
        ctx.setIndicatorCustomColors(updated);
        saveCustomColors(updated);
        ctx.setIndicatorSelectedColor(hex);
        goBack();
      }}
      initialColor={ctx.indicatorSelectedColor}
    />
  );
}

function OrionScreenWrapper() {
  return <p className="text-zinc-400 text-center py-8">Work in progress</p>;
}

function DrawingsScreenWrapper() {
  const ctx = useContext(SettingsCtx);
  const { goBack, close, navigateTo } = useDrawerNav();
  const drawingsCount = useDrawingStore((s) => s.drawings.length);

  return (
    <DrawingsScreen
      onBack={goBack}
      onClose={close}
      onOpenConfig={() => navigateTo('drawing-default-styles')}
      onClearAll={() => ctx.setIsClearDialogOpen(true)}
      drawingsCount={drawingsCount}
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
  const getDrawingDefaultTemplate = useDrawingTemplateStore((s) => s.getDefaultTemplate);
  const setDrawingDefaultTemplate = useDrawingTemplateStore((s) => s.setDefaultTemplate);

  return (
    <TemplateGridView
      category={ctx.drawingPickerCategory}
      activeTemplateId={getDrawingDefaultTemplate(ctx.drawingPickerCategory).id}
      onSelect={(template) => {
        setDrawingDefaultTemplate(ctx.drawingPickerCategory, template.id);
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
  { name: 'add-indicator', title: 'Add indicator', component: AddIndicatorScreenWrapper },
  { name: 'indicator-attributes', title: 'Indicator attributes', component: IndicatorAttributesScreenWrapper },
  { name: 'indicator-color-picker', title: 'Color', component: IndicatorColorPickerScreenWrapper },
  { name: 'indicator-hsl-picker', title: 'Color Picker', component: IndicatorHslPickerScreenWrapper },
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
  // Local-only UI state for this drawer
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [drawingPickerCategory, setDrawingPickerCategory] = useState<DrawingTemplateCategory>("line");
  const [drawingEditingTemplate, setDrawingEditingTemplate] = useState<DrawingTemplate | null>(null);
  const [drawingEditorPickedColor, setDrawingEditorPickedColor] = useState<string | null>(null);
  const [drawingEditorPickedOpacity, setDrawingEditorPickedOpacity] = useState<number | null>(null);
  const [drawingEditorPickedTarget, setDrawingEditorPickedTarget] = useState<"stroke" | "fill-solid" | "fill-g1" | "fill-g2" | null>(null);
  const [drawingSelectedColor, setDrawingSelectedColor] = useState("#ffffff");
  const [drawingColorOpacity, setDrawingColorOpacity] = useState(100);
  const [drawingCustomColors, setDrawingCustomColors] = useState<string[]>([]);
  const [indicatorSelectedColor, setIndicatorSelectedColor] = useState("#f59e0b");
  const [indicatorCustomColors, setIndicatorCustomColors] = useState<string[]>([]);

  // Template editor state
  const [editingColors, setEditingColors] = useState<ChartColors>({ ...DEFAULT_COLORS });
  const [editingName, setEditingName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFilledUp, setEditingFilledUp] = useState(true);
  const [editingFilledDown, setEditingFilledDown] = useState(true);

  // Color picker state
  const [colorTarget, setColorTarget] = useState<ColorTarget>('candleUp');
  const [colorPickerInitial, setColorPickerInitial] = useState('#00ff99');

  const ctxValue: SettingsCtxValue = useMemo(
    () => ({
      editingColors, setEditingColors,
      editingName, setEditingName,
      editingId, setEditingId,
      editingFilledUp, setEditingFilledUp,
      editingFilledDown, setEditingFilledDown,
      colorTarget, setColorTarget,
      colorPickerInitial, setColorPickerInitial,
      isClearDialogOpen, setIsClearDialogOpen,
      drawingPickerCategory, setDrawingPickerCategory,
      drawingEditingTemplate, setDrawingEditingTemplate,
      drawingEditorPickedColor, setDrawingEditorPickedColor,
      drawingEditorPickedOpacity, setDrawingEditorPickedOpacity,
      drawingEditorPickedTarget, setDrawingEditorPickedTarget,
      drawingSelectedColor, setDrawingSelectedColor,
      drawingColorOpacity, setDrawingColorOpacity,
      drawingCustomColors, setDrawingCustomColors,
      indicatorSelectedColor, setIndicatorSelectedColor,
      indicatorCustomColors, setIndicatorCustomColors,
    }),
    [
      editingColors,
      editingName,
      editingId,
      editingFilledUp,
      editingFilledDown,
      colorTarget,
      colorPickerInitial,
      isClearDialogOpen,
      drawingPickerCategory,
      drawingEditingTemplate,
      drawingEditorPickedColor,
      drawingEditorPickedOpacity,
      drawingEditorPickedTarget,
      drawingSelectedColor,
      drawingColorOpacity,
      drawingCustomColors,
      indicatorSelectedColor,
      indicatorCustomColors,
    ]
  );

  return (
    <SettingsCtx.Provider value={ctxValue}>
      <AppDrawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Settings"
        height="full"
        description="Chart settings, indicators, and Orion studies."
        screens={SCREENS}
        contentClassName="pb-6"
      />

      <ClearDrawingsDialog
        isOpen={isClearDialogOpen}
        onClose={() => setIsClearDialogOpen(false)}
        onConfirm={() => {
          const symbol = useChartStore.getState().symbol;
          useDrawingStore.getState().clearDrawings(symbol);
          setIsClearDialogOpen(false);
        }}
      />
    </SettingsCtx.Provider>
  );
}
