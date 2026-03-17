import { useMemo, useState } from "react";
import { HiPencil } from "react-icons/hi";
import { IoCloseSharp, IoCopyOutline } from "react-icons/io5";
import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  Type as ListType,
} from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';
import {
  BUILT_IN_TEMPLATES,
  type ChartTemplate,
} from "@/stores/chartSettingsStore";
import { ScreenHeader, TemplateColorPreview } from "./shared";

interface ColorsScreenProps {
  onBack: () => void;
  onClose: () => void;
  customTemplates: ChartTemplate[];
  activeTemplateId: string;
  onSelectTemplate: (id: string) => void;
  onCreateNew: () => void;
  onEdit: (template: ChartTemplate) => void;
  onDuplicate: (template: ChartTemplate) => void;
  onDelete: (id: string) => void;
}

export default function ColorsScreen({
  onBack,
  onClose,
  customTemplates,
  activeTemplateId,
  onSelectTemplate,
  onCreateNew,
  onEdit,
  onDuplicate,
  onDelete,
}: ColorsScreenProps) {
  const [templateFilter, setTemplateFilter] = useState<'all' | 'built-in' | 'custom'>('all');

  const filteredTemplates = useMemo(() => {
    const all = [...BUILT_IN_TEMPLATES, ...customTemplates];
    if (templateFilter === 'built-in') return all.filter(t => t.builtIn);
    if (templateFilter === 'custom') return all.filter(t => !t.builtIn);
    return all;
  }, [customTemplates, templateFilter]);

  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Colors" />

      <div className="space-y-2 pb-6">
        {/* Create Template button */}
        <button
          onClick={onCreateNew}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-dashed border-zinc-600"
        >
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-zinc-500 flex items-center justify-center">
              <span className="text-zinc-400 text-xs leading-none">+</span>
            </div>
            <span className="text-base">Create Template</span>
          </div>
        </button>

        {/* Filter tabs */}
        <div className="flex bg-zinc-800 rounded-lg p-1">
          {(['all', 'built-in', 'custom'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTemplateFilter(tab)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                templateFilter === tab ? 'bg-zinc-700 text-white' : 'text-zinc-400'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'built-in' ? 'Built-in' : 'Custom'}
            </button>
          ))}
        </div>

        {/* Template list */}
        <SwipeableList type={ListType.IOS} fullSwipe={false}>
          {filteredTemplates.map((template) => {
            const isActive = template.id === activeTemplateId;
            const trailing = template.builtIn ? (
              <TrailingActions>
                <SwipeAction onClick={() => onDuplicate(template)}>
                  <div className="flex items-center justify-center w-14 h-full text-zinc-400">
                    <IoCopyOutline size={18} />
                  </div>
                </SwipeAction>
              </TrailingActions>
            ) : (
              <TrailingActions>
                <SwipeAction onClick={() => onDuplicate(template)}>
                  <div className="flex items-center justify-center w-14 h-full text-zinc-400">
                    <IoCopyOutline size={18} />
                  </div>
                </SwipeAction>
                <SwipeAction onClick={() => onEdit(template)}>
                  <div className="flex items-center justify-center w-14 h-full text-zinc-400">
                    <HiPencil size={18} />
                  </div>
                </SwipeAction>
                <SwipeAction destructive onClick={() => onDelete(template.id)}>
                  <div className="flex items-center justify-center w-14 h-full text-red-500">
                    <IoCloseSharp size={22} />
                  </div>
                </SwipeAction>
              </TrailingActions>
            );

            return (
              <SwipeableListItem key={template.id} trailingActions={trailing}>
                <button
                  onClick={() => onSelectTemplate(template.id)}
                  className={`w-full px-4 py-4 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-zinc-700'
                      : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <TemplateColorPreview colors={template.colors} />
                      <span className="text-base text-white">{template.name}</span>
                    </div>
                    {isActive && (
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              </SwipeableListItem>
            );
          })}
        </SwipeableList>
      </div>
    </>
  );
}
