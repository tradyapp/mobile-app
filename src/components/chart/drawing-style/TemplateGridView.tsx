import { useState } from "react";
import { dashToSvg } from "./shared";
import { useDrawingTemplateStore, type DrawingTemplate, type DrawingTemplateCategory } from "@/stores/drawingTemplateStore";

type FilterTab = 'all' | 'builtin' | 'custom';

// ── Preview components ──

function LinePreview({ template }: { template: DrawingTemplate }) {
  if (template.category !== 'line') return null;
  return (
    <svg width="48" height="16" className="overflow-visible">
      <line
        x1="4" y1="8" x2="44" y2="8"
        stroke={template.color}
        strokeWidth={template.strokeWidth}
        strokeDasharray={dashToSvg(template.strokeDash)}
        strokeLinecap="round"
        opacity={template.opacity}
      />
    </svg>
  );
}

function ShapePreview({ template }: { template: DrawingTemplate }) {
  if (template.category !== 'shape') return null;
  const f = template.fill;
  let fillColor = 'none';
  let fillOpacity = 0;
  if (f.type === 'solid') {
    fillColor = f.color ?? 'none';
    fillOpacity = f.opacity ?? 0.2;
  } else if (f.type === 'gradient') {
    fillColor = f.gradientColor1 ?? template.color;
    fillOpacity = f.gradientOpacity1 ?? 0.3;
  }
  return (
    <svg width="40" height="40" className="overflow-visible">
      <rect
        x="4" y="4" width="32" height="32" rx="3"
        stroke={template.color}
        strokeWidth={template.strokeWidth}
        strokeDasharray={dashToSvg(template.strokeDash)}
        fill={fillColor}
        fillOpacity={fillOpacity}
        opacity={template.opacity}
      />
    </svg>
  );
}

function TextPreview({ template }: { template: DrawingTemplate }) {
  if (template.category !== 'text') return null;
  return (
    <span
      className="text-lg font-semibold leading-none"
      style={{ color: template.color, opacity: template.opacity }}
    >
      Aa
    </span>
  );
}

function TemplatePreview({ template }: { template: DrawingTemplate }) {
  if (template.category === 'line') return <LinePreview template={template} />;
  if (template.category === 'shape') return <ShapePreview template={template} />;
  return <TextPreview template={template} />;
}

// ── Grid component ──

interface TemplateGridViewProps {
  category: DrawingTemplateCategory;
  /** Called when a template cell is tapped */
  onSelect: (template: DrawingTemplate) => void;
  /** Show "+" create button and edit icons on custom templates */
  onCreateNew?: () => void;
  onEditTemplate?: (template: DrawingTemplate) => void;
  /** Highlight the active/selected template (e.g. for default-style picker) */
  activeTemplateId?: string;
}

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'builtin', label: 'Built-in' },
  { value: 'custom', label: 'Custom' },
];

export default function TemplateGridView({
  category,
  onSelect,
  onCreateNew,
  onEditTemplate,
  activeTemplateId,
}: TemplateGridViewProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const getTemplatesForCategory = useDrawingTemplateStore(s => s.getTemplatesForCategory);

  const allTemplates = getTemplatesForCategory(category);
  const filtered = filter === 'all' ? allTemplates
    : filter === 'builtin' ? allTemplates.filter(t => t.builtIn)
    : allTemplates.filter(t => !t.builtIn);

  return (
    <>
      {/* Filter tabs */}
      <div className="flex bg-zinc-800 rounded-lg p-1 mb-4">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === tab.value ? 'bg-zinc-700 text-white' : 'text-zinc-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid: 3 columns */}
      <div className="grid grid-cols-3 gap-2 pb-6">
        {/* Create new button (optional) */}
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-lg border-2 border-dashed border-zinc-600 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors min-h-25"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-2xs">New</span>
          </button>
        )}

        {/* Template cells */}
        {filtered.map(template => {
          const isActive = activeTemplateId === template.id;
          return (
            <div
              key={template.id}
              onClick={() => onSelect(template)}
              className={`relative flex flex-col items-center justify-center gap-1.5 py-4 rounded-lg transition-colors min-h-25 cursor-pointer ${
                isActive
                  ? 'bg-zinc-700 ring-2 ring-blue-500'
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              {/* Edit icon for custom templates */}
              {!template.builtIn && onEditTemplate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTemplate(template);
                  }}
                  className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              {/* Checkmark for active */}
              {isActive && (
                <div className="absolute top-1.5 left-1.5">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <TemplatePreview template={template} />
              <span className="text-2xs text-zinc-400 truncate w-full text-center px-1">
                {template.name}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
