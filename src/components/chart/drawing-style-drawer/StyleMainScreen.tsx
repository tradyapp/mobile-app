"use client";

import type { Drawing } from "@/stores/drawingStore";

interface StyleMainScreenProps {
  drawing: Drawing;
  isText: boolean;
  isFillable: boolean;
  onOpenTemplates: () => void;
  onOpenStroke: () => void;
  onOpenFill: () => void;
  onOpenTextEdit: () => void;
  onDelete: () => void;
}

export default function StyleMainScreen({
  drawing,
  isText,
  isFillable,
  onOpenTemplates,
  onOpenStroke,
  onOpenFill,
  onOpenTextEdit,
  onDelete,
}: StyleMainScreenProps) {
  return (
    <>
      <div className="space-y-2 pb-6">
        {/* Style Templates row */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onOpenTemplates();
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full border border-zinc-600"
                style={{
                  backgroundColor: drawing.color,
                  opacity: drawing.opacity ?? 1,
                }}
              />
              <span className="text-base">Style Templates</span>
            </div>
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
        </button>

        {/* Stroke row — hidden for text */}
        {!isText && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onOpenStroke();
            }}
            onClick={(e) => e.preventDefault()}
            className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-5 h-5">
                  <div
                    className="w-5 rounded-full"
                    style={{
                      height: `${Math.min(drawing.strokeWidth, 4)}px`,
                      backgroundColor: drawing.color,
                    }}
                  />
                </div>
                <span className="text-base">Stroke</span>
              </div>
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
          </button>
        )}

        {/* Fill row — only for fillable shapes */}
        {isFillable && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onOpenFill();
            }}
            onClick={(e) => e.preventDefault()}
            className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-5 h-5">
                  <div
                    className="w-4 h-4 rounded-sm border border-zinc-600"
                    style={{
                      backgroundColor:
                        drawing.fill?.type === "solid"
                          ? drawing.fill.color
                          : drawing.fill?.type === "gradient"
                            ? drawing.fill.gradientColor1
                            : "transparent",
                      opacity: drawing.fill?.type !== "none" ? 0.6 : 1,
                    }}
                  />
                </div>
                <span className="text-base">Fill</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-sm capitalize">
                  {drawing.fill?.type ?? "none"}
                </span>
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
        )}

        {/* Text row — only for text drawings */}
        {isText && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onOpenTextEdit();
            }}
            onClick={(e) => e.preventDefault()}
            className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 4h12M12 4v16"
                  />
                </svg>
                <span className="text-base">Text</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-sm truncate max-w-30">
                  {drawing.textContent || "Text"}
                </span>
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
        )}

        {/* Delete row */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onDelete();
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-red-400 hover:bg-zinc-700 [touch-action:manipulation]"
        >
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span className="text-base">Delete Drawing</span>
          </div>
        </button>
      </div>
    </>
  );
}
