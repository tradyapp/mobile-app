"use client";

import {
  useDrawingTemplateStore,
  type DrawingTemplateCategory,
} from "@/stores/drawingTemplateStore";
import { ScreenHeader } from "../drawing-style/shared";

const STYLE_CATEGORIES: { cat: DrawingTemplateCategory; label: string }[] = [
  { cat: "line", label: "Lines" },
  { cat: "shape", label: "Shapes" },
  { cat: "text", label: "Text" },
];

interface DefaultStylesScreenProps {
  onBack: () => void;
  onClose: () => void;
  onPickCategory: (cat: DrawingTemplateCategory) => void;
}

export default function DefaultStylesScreen({
  onBack,
  onClose,
  onPickCategory,
}: DefaultStylesScreenProps) {
  const { getDefaultTemplate } = useDrawingTemplateStore();

  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Default Styles" />
      <div className="text-zinc-500 text-xs mb-4">
        Choose the default style applied to new drawings.
      </div>
      <div className="space-y-2 pb-6">
        {STYLE_CATEGORIES.map(({ cat, label }) => {
          const tpl = getDefaultTemplate(cat);
          return (
            <button
              type="button"
              key={cat}
              onPointerDown={(e) => {
                e.preventDefault();
                onPickCategory(cat);
              }}
              onClick={(e) => e.preventDefault()}
              className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full border border-zinc-600"
                    style={{
                      backgroundColor: tpl.color,
                      opacity: tpl.opacity,
                    }}
                  />
                  <span className="text-base">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm">{tpl.name}</span>
                  <svg
                    className="w-5 h-5 text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
