import { useState, useCallback, useEffect } from "react";
import {
  ScreenHeader,
  THICKNESS_OPTIONS,
  DASH_OPTIONS,
  FILL_TYPE_OPTIONS,
  GRADIENT_DIR_OPTIONS,
  dashToSvg,
} from "./shared";
import type { StrokeDash, FillType, GradientDirection, DrawingFill, TextHAlign, TextVAlign } from "@/stores/drawingStore";
import { useDrawingTemplateStore, type DrawingTemplate, type DrawingTemplateCategory } from "@/stores/drawingTemplateStore";

interface TemplateEditorScreenProps {
  category: DrawingTemplateCategory;
  /** Template to edit (null = create new) */
  editingTemplate: DrawingTemplate | null;
  onBack: () => void;
  onClose: () => void;
  /** Navigate to color-picker sub-screen, passing current color & opacity */
  onPickColor: (currentColor: string, currentOpacity: number, target: 'stroke' | 'fill-solid' | 'fill-g1' | 'fill-g2') => void;
  /** Color/opacity returned from color picker */
  pickedColor: string | null;
  pickedOpacity: number | null;
  pickedTarget: 'stroke' | 'fill-solid' | 'fill-g1' | 'fill-g2' | null;
  clearPickedColor: () => void;
}

type InternalScreen = 'main' | 'stroke' | 'fill';

export default function TemplateEditorScreen({
  category,
  editingTemplate,
  onBack,
  onClose,
  onPickColor,
  pickedColor,
  pickedOpacity,
  pickedTarget,
  clearPickedColor,
}: TemplateEditorScreenProps) {
  const saveTemplate = useDrawingTemplateStore(s => s.saveTemplate);
  const deleteTemplate = useDrawingTemplateStore(s => s.deleteTemplate);

  const [internalScreen, setInternalScreen] = useState<InternalScreen>('main');
  const [internalStyle, setInternalStyle] = useState<React.CSSProperties>({});

  // ── Local editor state (initialized from editingTemplate or defaults) ──
  const [name, setName] = useState(() => editingTemplate?.name ?? '');
  const [color, setColor] = useState(() => editingTemplate?.color ?? '#ffffff');
  const [opacity, setOpacity] = useState(() => Math.round((editingTemplate?.opacity ?? 1) * 100));

  // Line / Shape
  const [strokeWidth, setStrokeWidth] = useState(() =>
    editingTemplate && editingTemplate.category !== 'text' ? editingTemplate.strokeWidth : 3);
  const [strokeDash, setStrokeDash] = useState<StrokeDash>(() =>
    editingTemplate && editingTemplate.category !== 'text' ? editingTemplate.strokeDash : 'solid');

  // Shape fill
  const initFill = editingTemplate?.category === 'shape' ? editingTemplate.fill : { type: 'none' as FillType };
  const [fillType, setFillType] = useState<FillType>(initFill.type);
  const [fillColor, setFillColor] = useState(initFill.color ?? '#ffffff');
  const [fillOpacity, setFillOpacity] = useState(Math.round((initFill.opacity ?? 0.2) * 100));
  const [fillGC1, setFillGC1] = useState(initFill.gradientColor1 ?? '#ffffff');
  const [fillGC2, setFillGC2] = useState(initFill.gradientColor2 ?? '#3b82f6');
  const [fillGO1, setFillGO1] = useState(Math.round((initFill.gradientOpacity1 ?? 0.2) * 100));
  const [fillGO2, setFillGO2] = useState(Math.round((initFill.gradientOpacity2 ?? 0) * 100));
  const [fillDir, setFillDir] = useState<GradientDirection>(initFill.gradientDirection ?? 'down');

  // Text
  const [fontSize, setFontSize] = useState(() =>
    editingTemplate?.category === 'text' ? editingTemplate.fontSize : 2);
  const [textHAlign, setTextHAlign] = useState<TextHAlign>(() =>
    editingTemplate?.category === 'text' ? editingTemplate.textHAlign : 'left');
  const [textVAlign, setTextVAlign] = useState<TextVAlign>(() =>
    editingTemplate?.category === 'text' ? editingTemplate.textVAlign : 'middle');

  // ── Internal animated navigation ──
  const navigateInternal = useCallback((target: InternalScreen, direction: 'forward' | 'backward') => {
    setInternalStyle({ opacity: 0, transition: 'opacity 120ms ease-out' });
    setTimeout(() => {
      setInternalScreen(target);
      setInternalStyle({
        opacity: 0,
        transform: direction === 'forward' ? 'translateX(40px)' : 'translateX(-40px)',
        transition: 'none',
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setInternalStyle({
            opacity: 1,
            transform: 'translateX(0)',
            transition: 'opacity 180ms ease-out, transform 180ms ease-out',
          });
        });
      });
    }, 120);
  }, []);

  // ── Apply color returned from picker (in effect to avoid setState during render) ──
  useEffect(() => {
    if (pickedColor === null || pickedOpacity === null || pickedTarget === null) return;
    if (pickedTarget === 'stroke') {
      setColor(pickedColor);
      setOpacity(pickedOpacity);
    } else if (pickedTarget === 'fill-solid') {
      setFillColor(pickedColor);
      setFillOpacity(pickedOpacity);
    } else if (pickedTarget === 'fill-g1') {
      setFillGC1(pickedColor);
      setFillGO1(pickedOpacity);
    } else if (pickedTarget === 'fill-g2') {
      setFillGC2(pickedColor);
      setFillGO2(pickedOpacity);
    }
    clearPickedColor();
  }, [pickedColor, pickedOpacity, pickedTarget, clearPickedColor]);

  const buildFill = useCallback((): DrawingFill => {
    if (fillType === 'none') return { type: 'none' };
    if (fillType === 'solid') return { type: 'solid', color: fillColor, opacity: fillOpacity / 100 };
    return {
      type: 'gradient',
      gradientColor1: fillGC1,
      gradientColor2: fillGC2,
      gradientOpacity1: fillGO1 / 100,
      gradientOpacity2: fillGO2 / 100,
      gradientDirection: fillDir,
    };
  }, [fillType, fillColor, fillOpacity, fillGC1, fillGC2, fillGO1, fillGO2, fillDir]);

  const handleSave = useCallback(() => {
    const id = editingTemplate?.id ?? crypto.randomUUID();
    const base = { id, name: name || 'Untitled', color, opacity: opacity / 100 };

    let template: DrawingTemplate;
    if (category === 'line') {
      template = { ...base, category: 'line', strokeWidth, strokeDash };
    } else if (category === 'shape') {
      template = { ...base, category: 'shape', strokeWidth, strokeDash, fill: buildFill() };
    } else {
      template = { ...base, category: 'text', fontSize, textHAlign, textVAlign };
    }

    saveTemplate(template);
    onBack();
  }, [editingTemplate, name, color, opacity, category, strokeWidth, strokeDash, buildFill, fontSize, textHAlign, textVAlign, saveTemplate, onBack]);

  const handleDelete = useCallback(() => {
    if (!editingTemplate) return;
    deleteTemplate(editingTemplate.id);
    onBack();
  }, [editingTemplate, deleteTemplate, onBack]);

  const isLine = category === 'line';
  const isShape = category === 'shape';
  const isText = category === 'text';

  // ── Stroke summary for the navigation row ──
  const strokeSummary = `${strokeWidth}px · ${strokeDash}`;
  // ── Fill summary for the navigation row ──
  const fillSummary = fillType === 'none' ? 'None' : fillType === 'solid' ? 'Solid' : 'Gradient';

  // ── Handle back: if on internal sub-panel, go back to main; otherwise parent back ──
  const handleBack = useCallback(() => {
    if (internalScreen !== 'main') {
      navigateInternal('main', 'backward');
    } else {
      onBack();
    }
  }, [internalScreen, navigateInternal, onBack]);

  return (
    <>
      <ScreenHeader
        onBack={handleBack}
        onClose={onClose}
        title={
          internalScreen === 'stroke' ? 'Stroke' :
          internalScreen === 'fill' ? 'Fill' :
          editingTemplate ? 'Edit Template' : 'New Template'
        }
      />

      <div className="overflow-y-auto max-h-[60vh]" style={internalStyle}>

        {/* ══════════════ MAIN ══════════════ */}
        {internalScreen === 'main' && (
          <>
            {/* Name */}
            <div className="mb-5">
              <div className="text-zinc-500 text-xs mb-2">Name</div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name..."
                className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white text-base border-2 border-zinc-700 focus:border-blue-500 focus:outline-none transition-colors placeholder:text-zinc-500"
              />
            </div>

            {/* Color row */}
            <div className="mb-5">
              <div className="text-zinc-500 text-xs mb-2">Color</div>
              <button
                onClick={() => onPickColor(color, opacity, 'stroke')}
                className="w-full px-4 py-3 rounded-lg text-left bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full border border-zinc-600"
                      style={{ backgroundColor: color, opacity: opacity / 100 }}
                    />
                    <span className="text-sm">{color}</span>
                    <span className="text-zinc-500 text-xs">{opacity}%</span>
                  </div>
                  <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>

            {/* Stroke row → sub-panel (line / shape only) */}
            {(isLine || isShape) && (
              <div className="mb-5">
                <div className="text-zinc-500 text-xs mb-2">Stroke</div>
                <button
                  onClick={() => navigateInternal('stroke', 'forward')}
                  className="w-full px-4 py-3 rounded-lg text-left bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-5 h-5">
                        <div
                          className="w-5 rounded-full"
                          style={{ height: `${Math.min(strokeWidth, 4)}px`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-sm">{strokeSummary}</span>
                    </div>
                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            )}

            {/* Fill row → sub-panel (shape only) */}
            {isShape && (
              <div className="mb-5">
                <div className="text-zinc-500 text-xs mb-2">Fill</div>
                <button
                  onClick={() => navigateInternal('fill', 'forward')}
                  className="w-full px-4 py-3 rounded-lg text-left bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-5 h-5">
                        <div
                          className="w-4 h-4 rounded-sm border border-zinc-600"
                          style={{
                            backgroundColor: fillType === 'solid' ? fillColor
                              : fillType === 'gradient' ? fillGC1
                              : 'transparent',
                            opacity: fillType !== 'none' ? 0.6 : 1,
                          }}
                        />
                      </div>
                      <span className="text-sm">{fillSummary}</span>
                    </div>
                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            )}

            {/* ── Text controls (inline, no sub-panel needed) ── */}
            {isText && (
              <>
                <div className="mb-5">
                  <div className="text-zinc-500 text-xs mb-2">Font Size</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0.5} max={8} step={0.5} value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-400 [&::-webkit-slider-thumb]:shadow"
                    />
                    <span className="text-zinc-400 text-xs font-mono w-10 text-right shrink-0">{fontSize}</span>
                  </div>
                </div>
                <div className="mb-5">
                  <div className="text-zinc-500 text-xs mb-2">Horizontal Align</div>
                  <div className="flex items-center gap-2">
                    {([
                      { value: 'left' as TextHAlign, label: 'Left' },
                      { value: 'center' as TextHAlign, label: 'Center' },
                      { value: 'right' as TextHAlign, label: 'Right' },
                    ]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTextHAlign(opt.value)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          textHAlign === opt.value
                            ? 'bg-zinc-700 text-white border-2 border-white'
                            : 'bg-zinc-800 text-zinc-400 border-2 border-transparent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-5">
                  <div className="text-zinc-500 text-xs mb-2">Vertical Align</div>
                  <div className="flex items-center gap-2">
                    {([
                      { value: 'top' as TextVAlign, label: 'Top' },
                      { value: 'middle' as TextVAlign, label: 'Middle' },
                      { value: 'bottom' as TextVAlign, label: 'Bottom' },
                    ]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTextVAlign(opt.value)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          textVAlign === opt.value
                            ? 'bg-zinc-700 text-white border-2 border-white'
                            : 'bg-zinc-800 text-zinc-400 border-2 border-transparent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              {editingTemplate ? 'Save Changes' : 'Save Template'}
            </button>

            {/* Delete (only for existing custom templates) */}
            {editingTemplate && !editingTemplate.builtIn && (
              <button
                onClick={handleDelete}
                className="w-full py-2.5 rounded-lg mt-2 text-red-400 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Delete Template
              </button>
            )}
          </>
        )}

        {/* ══════════════ STROKE SUB-PANEL ══════════════ */}
        {internalScreen === 'stroke' && (
          <>
            <div className="mb-5">
              <div className="text-zinc-500 text-xs mb-2">Width</div>
              <div className="flex items-center gap-2">
                {THICKNESS_OPTIONS.map(px => (
                  <button
                    key={px}
                    onClick={() => setStrokeWidth(px)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      strokeWidth === px
                        ? 'bg-zinc-700 text-white border-2 border-white'
                        : 'bg-zinc-800 text-zinc-400 border-2 border-transparent'
                    }`}
                  >
                    {px}px
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-zinc-500 text-xs mb-2">Dash Style</div>
              <div className="flex items-center gap-2">
                {DASH_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStrokeDash(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      strokeDash === opt.value
                        ? 'bg-zinc-700 text-white border-2 border-white'
                        : 'bg-zinc-800 text-zinc-400 border-2 border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center justify-center py-3 bg-zinc-800 rounded-lg">
              <svg width="120" height={Math.max(strokeWidth * 2, 8)} className="overflow-visible">
                <line
                  x1="0" y1={Math.max(strokeWidth, 4)} x2="120" y2={Math.max(strokeWidth, 4)}
                  stroke={color} strokeWidth={strokeWidth}
                  strokeDasharray={dashToSvg(strokeDash)} strokeLinecap="round" opacity={opacity / 100}
                />
              </svg>
            </div>
          </>
        )}

        {/* ══════════════ FILL SUB-PANEL ══════════════ */}
        {internalScreen === 'fill' && (
          <>
            <div className="mb-5">
              <div className="text-zinc-500 text-xs mb-2">Fill Type</div>
              <div className="flex items-center gap-2">
                {FILL_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFillType(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      fillType === opt.value
                        ? 'bg-zinc-700 text-white border-2 border-white'
                        : 'bg-zinc-800 text-zinc-400 border-2 border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {fillType === 'solid' && (
              <div className="mb-5">
                <button
                  onClick={() => onPickColor(fillColor, fillOpacity, 'fill-solid')}
                  className="w-full px-4 py-3 rounded-lg text-left bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border border-zinc-600" style={{ backgroundColor: fillColor, opacity: fillOpacity / 100 }} />
                      <span className="text-sm">Fill Color</span>
                    </div>
                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            )}

            {fillType === 'gradient' && (
              <>
                <div className="mb-3">
                  <div className="text-zinc-500 text-xs mb-2">Direction</div>
                  <div className="flex items-center gap-2">
                    {GRADIENT_DIR_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFillDir(opt.value)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          fillDir === opt.value
                            ? 'bg-zinc-700 text-white border-2 border-white'
                            : 'bg-zinc-800 text-zinc-400 border-2 border-transparent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 mb-5">
                  <button
                    onClick={() => onPickColor(fillGC1, fillGO1, 'fill-g1')}
                    className="w-full px-4 py-3 rounded-lg text-left bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full border border-zinc-600" style={{ backgroundColor: fillGC1, opacity: fillGO1 / 100 }} />
                        <span className="text-sm">Color 1</span>
                      </div>
                      <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                  <button
                    onClick={() => onPickColor(fillGC2, fillGO2, 'fill-g2')}
                    className="w-full px-4 py-3 rounded-lg text-left bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full border border-zinc-600" style={{ backgroundColor: fillGC2, opacity: fillGO2 / 100 }} />
                        <span className="text-sm">Color 2</span>
                      </div>
                      <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                  {/* Gradient preview */}
                  <div className="flex items-center justify-center py-2 bg-zinc-800 rounded-lg">
                    <div
                      className="w-full h-5 rounded mx-3"
                      style={{
                        background: `linear-gradient(to ${
                          fillDir === 'down' ? 'bottom' : fillDir === 'up' ? 'top' : fillDir
                        }, ${fillGC1}${Math.round(fillGO1 * 2.55).toString(16).padStart(2, '0')}, ${fillGC2}${Math.round(fillGO2 * 2.55).toString(16).padStart(2, '0')})`,
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </>
  );
}
