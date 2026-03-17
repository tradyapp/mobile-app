/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useState, useCallback, useEffect, createContext, useContext } from "react";
import AppDrawer, { type DrawerScreen } from "../uiux/AppDrawer";
import { useDrawerNav } from "../uiux/drawer-nav";
import { useDrawingStore, type StrokeDash, type FillType, type GradientDirection, type DrawingFill, type Drawing, type TextHAlign, type TextVAlign } from "@/stores/drawingStore";
import { getToolCategory, type DrawingTemplate, type DrawingTemplateCategory } from "@/stores/drawingTemplateStore";
import { ensureColorInPalette, saveCustomColors } from "./drawing-style/shared";
import ColorPaletteView from "./drawing-style/ColorPaletteView";
import TemplatesScreen from "./drawing-style/TemplatesScreen";
import TemplateEditorScreen from "./drawing-style/TemplateEditorScreen";
import StyleMainScreen from "./drawing-style-drawer/StyleMainScreen";
import StrokeScreen from "./drawing-style-drawer/StrokeScreen";
import FillScreen from "./drawing-style-drawer/FillScreen";
import TextEditScreen from "./drawing-style-drawer/TextEditScreen";
import HslPickerScreen from "./drawings-drawer/HslPickerScreen";

// ── Domain context for DrawingStyleDrawer screens ──

interface DrawingStyleCtxValue {
  selectedDrawing: Drawing;
  isText: boolean;
  isFillable: boolean;
  drawingCategory: DrawingTemplateCategory;
  customColors: string[];
  setCustomColors: React.Dispatch<React.SetStateAction<string[]>>;
  selectedColor: string;
  setSelectedColor: React.Dispatch<React.SetStateAction<string>>;
  opacity: number;
  setOpacity: React.Dispatch<React.SetStateAction<number>>;
  fillType: FillType;
  setFillType: React.Dispatch<React.SetStateAction<FillType>>;
  fillColor: string;
  setFillColor: React.Dispatch<React.SetStateAction<string>>;
  fillOpacity: number;
  setFillOpacity: React.Dispatch<React.SetStateAction<number>>;
  fillGradientColor1: string;
  setFillGradientColor1: React.Dispatch<React.SetStateAction<string>>;
  fillGradientColor2: string;
  setFillGradientColor2: React.Dispatch<React.SetStateAction<string>>;
  fillGradientOpacity1: number;
  setFillGradientOpacity1: React.Dispatch<React.SetStateAction<number>>;
  fillGradientOpacity2: number;
  setFillGradientOpacity2: React.Dispatch<React.SetStateAction<number>>;
  fillGradientDirection: GradientDirection;
  setFillGradientDirection: React.Dispatch<React.SetStateAction<GradientDirection>>;
  fillPickerTarget: 'solid' | 'gradient1' | 'gradient2';
  setFillPickerTarget: React.Dispatch<React.SetStateAction<'solid' | 'gradient1' | 'gradient2'>>;
  editingTemplate: DrawingTemplate | null;
  setEditingTemplate: React.Dispatch<React.SetStateAction<DrawingTemplate | null>>;
  editorPickedColor: string | null;
  setEditorPickedColor: React.Dispatch<React.SetStateAction<string | null>>;
  editorPickedOpacity: number | null;
  setEditorPickedOpacity: React.Dispatch<React.SetStateAction<number | null>>;
  editorPickedTarget: 'stroke' | 'fill-solid' | 'fill-g1' | 'fill-g2' | null;
  setEditorPickedTarget: React.Dispatch<React.SetStateAction<'stroke' | 'fill-solid' | 'fill-g1' | 'fill-g2' | null>>;
  updateDrawingStyle: (id: string, style: Record<string, unknown>) => void;
  removeDrawing: (id: string) => void;
  setSelectedDrawingId: (id: string | null) => void;
  buildFill: (overrides?: {
    type?: FillType; color?: string; opacity?: number;
    gc1?: string; gc2?: string; go1?: number; go2?: number; dir?: GradientDirection;
  }) => DrawingFill;
}

const DrawingStyleCtx = createContext<DrawingStyleCtxValue>(null!);

// ── Screen wrapper components (stable references, read from context + nav) ──

function MainScreenWrapper() {
  const ctx = useContext(DrawingStyleCtx);
  const { navigateTo, close } = useDrawerNav();

  const handleDelete = useCallback(() => {
    ctx.removeDrawing(ctx.selectedDrawing.id);
    ctx.setSelectedDrawingId(null);
    close();
  }, [ctx, close]);

  return (
    <StyleMainScreen
      drawing={ctx.selectedDrawing}
      isText={ctx.isText}
      isFillable={ctx.isFillable}
      onOpenTemplates={() => navigateTo('templates')}
      onOpenStroke={() => navigateTo('stroke')}
      onOpenFill={() => {
        const f = ctx.selectedDrawing.fill;
        ctx.setFillType(f?.type ?? 'none');
        ctx.setFillColor(f?.color ?? '#ffffff');
        ctx.setFillOpacity(Math.round((f?.opacity ?? 0.2) * 100));
        ctx.setFillGradientColor1(f?.gradientColor1 ?? '#ffffff');
        ctx.setFillGradientColor2(f?.gradientColor2 ?? '#3b82f6');
        ctx.setFillGradientOpacity1(Math.round((f?.gradientOpacity1 ?? 0.2) * 100));
        ctx.setFillGradientOpacity2(Math.round((f?.gradientOpacity2 ?? 0) * 100));
        ctx.setFillGradientDirection(f?.gradientDirection ?? 'down');
        navigateTo('fill');
      }}
      onOpenTextEdit={() => navigateTo('text-edit')}
      onDelete={handleDelete}
    />
  );
}

function TemplatesScreenWrapper() {
  const ctx = useContext(DrawingStyleCtx);
  const { goBack, close, navigateTo } = useDrawerNav();

  return (
    <TemplatesScreen
      category={ctx.drawingCategory}
      drawingId={ctx.selectedDrawing.id}
      onBack={goBack}
      onClose={close}
      onCreateNew={() => {
        ctx.setEditingTemplate(null);
        ctx.setEditorPickedColor(null);
        ctx.setEditorPickedOpacity(null);
        ctx.setEditorPickedTarget(null);
        navigateTo('edit-template');
      }}
      onEditTemplate={(template) => {
        ctx.setEditingTemplate(template);
        ctx.setEditorPickedColor(null);
        ctx.setEditorPickedOpacity(null);
        ctx.setEditorPickedTarget(null);
        navigateTo('edit-template');
      }}
    />
  );
}

function EditTemplateScreenWrapper() {
  const ctx = useContext(DrawingStyleCtx);
  const { goBack, close, navigateTo } = useDrawerNav();

  return (
    <TemplateEditorScreen
      category={ctx.drawingCategory}
      editingTemplate={ctx.editingTemplate}
      onBack={goBack}
      onClose={close}
      onPickColor={(currentColor, currentOpacity, target) => {
        ctx.setEditorPickedTarget(target);
        ctx.setSelectedColor(currentColor);
        ctx.setOpacity(currentOpacity);
        ctx.setCustomColors(ensureColorInPalette(currentColor));
        navigateTo('color-picker');
      }}
      pickedColor={ctx.editorPickedColor}
      pickedOpacity={ctx.editorPickedOpacity}
      pickedTarget={ctx.editorPickedTarget}
      clearPickedColor={() => {
        ctx.setEditorPickedColor(null);
        ctx.setEditorPickedOpacity(null);
        ctx.setEditorPickedTarget(null);
      }}
    />
  );
}

function ColorPickerScreenWrapper() {
  const ctx = useContext(DrawingStyleCtx);
  const { goBack, navigateTo } = useDrawerNav();

  return (
    <ColorPaletteView
      selectedColor={ctx.selectedColor}
      opacity={ctx.opacity}
      customColors={ctx.customColors}
      onSelectColor={ctx.setSelectedColor}
      onOpacityChange={ctx.setOpacity}
      onAddColor={() => navigateTo('picker')}
      onApply={() => {
        ctx.setEditorPickedColor(ctx.selectedColor);
        ctx.setEditorPickedOpacity(ctx.opacity);
        goBack();
      }}
      minOpacity={10}
    />
  );
}

function StrokeScreenWrapper() {
  const ctx = useContext(DrawingStyleCtx);
  const { goBack, close } = useDrawerNav();

  return (
    <StrokeScreen
      initialThickness={ctx.selectedDrawing.strokeWidth}
      initialDashStyle={ctx.selectedDrawing.strokeDash ?? 'solid'}
      strokeColor={ctx.selectedDrawing.color}
      onApply={(thickness: number, dashStyle: StrokeDash) => {
        ctx.updateDrawingStyle(ctx.selectedDrawing.id, { strokeWidth: thickness, strokeDash: dashStyle });
        goBack();
      }}
      onBack={goBack}
      onClose={close}
    />
  );
}

function FillScreenWrapper() {
  const ctx = useContext(DrawingStyleCtx);
  const { goBack, close, navigateTo } = useDrawerNav();

  return (
    <FillScreen
      fillType={ctx.fillType}
      fillColor={ctx.fillColor}
      fillOpacity={ctx.fillOpacity}
      fillGradientColor1={ctx.fillGradientColor1}
      fillGradientColor2={ctx.fillGradientColor2}
      fillGradientOpacity1={ctx.fillGradientOpacity1}
      fillGradientOpacity2={ctx.fillGradientOpacity2}
      fillGradientDirection={ctx.fillGradientDirection}
      onFillTypeChange={(newType: FillType) => {
        ctx.setFillType(newType);
        ctx.updateDrawingStyle(ctx.selectedDrawing.id, { fill: ctx.buildFill({ type: newType }) });
      }}
      onGradientDirectionChange={(dir: GradientDirection) => {
        ctx.setFillGradientDirection(dir);
        ctx.updateDrawingStyle(ctx.selectedDrawing.id, { fill: ctx.buildFill({ dir }) });
      }}
      onPickColor={(target: 'solid' | 'gradient1' | 'gradient2') => {
        ctx.setFillPickerTarget(target);
        const hex = target === 'solid' ? ctx.fillColor : target === 'gradient1' ? ctx.fillGradientColor1 : ctx.fillGradientColor2;
        ctx.setSelectedColor(hex);
        ctx.setOpacity(target === 'solid' ? ctx.fillOpacity : target === 'gradient1' ? ctx.fillGradientOpacity1 : ctx.fillGradientOpacity2);
        ctx.setCustomColors(ensureColorInPalette(hex));
        navigateTo('fill-picker');
      }}
      onBack={goBack}
      onClose={close}
    />
  );
}

function TextEditScreenWrapper() {
  const ctx = useContext(DrawingStyleCtx);
  const { goBack, close } = useDrawerNav();

  return (
    <TextEditScreen
      initialContent={ctx.selectedDrawing.textContent ?? 'Text'}
      initialFontSize={ctx.selectedDrawing.fontSize ?? 2}
      initialHAlign={ctx.selectedDrawing.textHAlign ?? 'left'}
      initialVAlign={ctx.selectedDrawing.textVAlign ?? 'middle'}
      onApplyProp={(style: { textContent?: string; fontSize?: number; textHAlign?: TextHAlign; textVAlign?: TextVAlign }) => {
        ctx.updateDrawingStyle(ctx.selectedDrawing.id, style);
      }}
      onBack={goBack}
      onClose={close}
    />
  );
}

function FillPickerScreenWrapper() {
  const ctx = useContext(DrawingStyleCtx);
  const { goBack, navigateTo } = useDrawerNav();

  return (
    <ColorPaletteView
      selectedColor={ctx.selectedColor}
      opacity={ctx.opacity}
      customColors={ctx.customColors}
      onSelectColor={ctx.setSelectedColor}
      onOpacityChange={ctx.setOpacity}
      onAddColor={() => navigateTo('picker')}
      onApply={() => {
        let fill: DrawingFill;
        if (ctx.fillPickerTarget === 'solid') {
          ctx.setFillColor(ctx.selectedColor);
          ctx.setFillOpacity(ctx.opacity);
          fill = ctx.buildFill({ color: ctx.selectedColor, opacity: ctx.opacity });
        } else if (ctx.fillPickerTarget === 'gradient1') {
          ctx.setFillGradientColor1(ctx.selectedColor);
          ctx.setFillGradientOpacity1(ctx.opacity);
          fill = ctx.buildFill({ gc1: ctx.selectedColor, go1: ctx.opacity });
        } else {
          ctx.setFillGradientColor2(ctx.selectedColor);
          ctx.setFillGradientOpacity2(ctx.opacity);
          fill = ctx.buildFill({ gc2: ctx.selectedColor, go2: ctx.opacity });
        }
        ctx.updateDrawingStyle(ctx.selectedDrawing.id, { fill });
        goBack();
      }}
      minOpacity={0}
    />
  );
}

function HslPickerScreenWrapper() {
  const ctx = useContext(DrawingStyleCtx);
  const { goBack, close } = useDrawerNav();

  return (
    <HslPickerScreen
      onBack={goBack}
      onClose={close}
      onAddColor={(hex: string) => {
        const updated = [...ctx.customColors, hex];
        ctx.setCustomColors(updated);
        saveCustomColors(updated);
        ctx.setSelectedColor(hex);
        goBack();
      }}
      initialColor={ctx.selectedColor}
    />
  );
}

// ── Screen definitions ──

const SCREENS: DrawerScreen[] = [
  { name: 'main', title: 'Drawing Style', component: MainScreenWrapper, isRoot: true },
  { name: 'templates', title: 'Style Templates', component: TemplatesScreenWrapper },
  { name: 'edit-template', title: 'Edit Template', component: EditTemplateScreenWrapper },
  { name: 'color-picker', title: 'Color', component: ColorPickerScreenWrapper },
  { name: 'stroke', title: 'Stroke', component: StrokeScreenWrapper },
  { name: 'fill', title: 'Fill', component: FillScreenWrapper },
  { name: 'text-edit', title: 'Text', component: TextEditScreenWrapper },
  { name: 'fill-picker', title: 'Fill Color', component: FillPickerScreenWrapper },
  { name: 'picker', title: 'Color Picker', component: HslPickerScreenWrapper },
];

// ── Main component ──

interface DrawingStyleDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DrawingStyleDrawer({
  isOpen,
  onOpenChange,
}: DrawingStyleDrawerProps) {
  const { drawings, selectedDrawingId, updateDrawingStyle, removeDrawing, setSelectedDrawingId } = useDrawingStore();
  const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);

  const [customColors, setCustomColors] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(100);

  const [fillType, setFillType] = useState<FillType>('none');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [fillOpacity, setFillOpacity] = useState(20);
  const [fillGradientColor1, setFillGradientColor1] = useState('#ffffff');
  const [fillGradientColor2, setFillGradientColor2] = useState('#3b82f6');
  const [fillGradientOpacity1, setFillGradientOpacity1] = useState(20);
  const [fillGradientOpacity2, setFillGradientOpacity2] = useState(0);
  const [fillGradientDirection, setFillGradientDirection] = useState<GradientDirection>('down');
  const [fillPickerTarget, setFillPickerTarget] = useState<'solid' | 'gradient1' | 'gradient2'>('solid');

  const [editingTemplate, setEditingTemplate] = useState<DrawingTemplate | null>(null);
  const [editorPickedColor, setEditorPickedColor] = useState<string | null>(null);
  const [editorPickedOpacity, setEditorPickedOpacity] = useState<number | null>(null);
  const [editorPickedTarget, setEditorPickedTarget] = useState<'stroke' | 'fill-solid' | 'fill-g1' | 'fill-g2' | null>(null);

  // Sync from drawing on open
  useEffect(() => {
    if (isOpen && selectedDrawing) {
      setCustomColors(ensureColorInPalette(selectedDrawing.color));
      setSelectedColor(selectedDrawing.color);
      setOpacity(Math.round((selectedDrawing.opacity ?? 1) * 100));
      const f = selectedDrawing.fill;
      setFillType(f?.type ?? 'none');
      setFillColor(f?.color ?? '#ffffff');
      setFillOpacity(Math.round((f?.opacity ?? 0.2) * 100));
      setFillGradientColor1(f?.gradientColor1 ?? '#ffffff');
      setFillGradientColor2(f?.gradientColor2 ?? '#3b82f6');
      setFillGradientOpacity1(Math.round((f?.gradientOpacity1 ?? 0.2) * 100));
      setFillGradientOpacity2(Math.round((f?.gradientOpacity2 ?? 0) * 100));
      setFillGradientDirection(f?.gradientDirection ?? 'down');
      setEditingTemplate(null);
      setEditorPickedColor(null);
      setEditorPickedOpacity(null);
      setEditorPickedTarget(null);
    }
  }, [isOpen, selectedDrawing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildFill = useCallback((overrides: {
    type?: FillType; color?: string; opacity?: number;
    gc1?: string; gc2?: string; go1?: number; go2?: number; dir?: GradientDirection;
  } = {}): DrawingFill => {
    const t = overrides.type ?? fillType;
    if (t === 'none') return { type: 'none' };
    if (t === 'solid') return {
      type: 'solid',
      color: overrides.color ?? fillColor,
      opacity: (overrides.opacity ?? fillOpacity) / 100,
    };
    return {
      type: 'gradient',
      gradientColor1: overrides.gc1 ?? fillGradientColor1,
      gradientColor2: overrides.gc2 ?? fillGradientColor2,
      gradientOpacity1: (overrides.go1 ?? fillGradientOpacity1) / 100,
      gradientOpacity2: (overrides.go2 ?? fillGradientOpacity2) / 100,
      gradientDirection: overrides.dir ?? fillGradientDirection,
    };
  }, [fillType, fillColor, fillOpacity, fillGradientColor1, fillGradientColor2, fillGradientOpacity1, fillGradientOpacity2, fillGradientDirection]);

  if (!selectedDrawing) return null;

  const isText = selectedDrawing.type === 'text';
  const isFillable = selectedDrawing.type === 'rectangle' || selectedDrawing.type === 'ellipse' || selectedDrawing.type === 'triangle' || selectedDrawing.type === 'inverted_triangle' || selectedDrawing.type === 'polygon';
  const drawingCategory: DrawingTemplateCategory = getToolCategory(selectedDrawing.type);

  const ctxValue: DrawingStyleCtxValue = {
    selectedDrawing, isText, isFillable, drawingCategory,
    customColors, setCustomColors,
    selectedColor, setSelectedColor,
    opacity, setOpacity,
    fillType, setFillType,
    fillColor, setFillColor,
    fillOpacity, setFillOpacity,
    fillGradientColor1, setFillGradientColor1,
    fillGradientColor2, setFillGradientColor2,
    fillGradientOpacity1, setFillGradientOpacity1,
    fillGradientOpacity2, setFillGradientOpacity2,
    fillGradientDirection, setFillGradientDirection,
    fillPickerTarget, setFillPickerTarget,
    editingTemplate, setEditingTemplate,
    editorPickedColor, setEditorPickedColor,
    editorPickedOpacity, setEditorPickedOpacity,
    editorPickedTarget, setEditorPickedTarget,
    updateDrawingStyle, removeDrawing, setSelectedDrawingId,
    buildFill,
  };

  return (
    <DrawingStyleCtx.Provider value={ctxValue}>
      <AppDrawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Drawing Style"
        height="content"
        description="Customize the style of the selected drawing."
        screens={SCREENS}
      />
    </DrawingStyleCtx.Provider>
  );
}
