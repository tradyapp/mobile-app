import { ScreenHeader, ChevronRight } from "./shared";

interface DrawingsScreenProps {
  onBack: () => void;
  onClose: () => void;
  onOpenConfig: () => void;
  onClearAll: () => void;
  drawingsCount: number;
}

export default function DrawingsScreen({
  onBack,
  onClose,
  onOpenConfig,
  onClearAll,
  drawingsCount,
}: DrawingsScreenProps) {
  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Drawings" />
      <div className="space-y-2 pb-6">
        {/* Configuration */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onOpenConfig();
          }}
          onClick={(e) => e.preventDefault()}
          className="w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 [touch-action:manipulation]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <span className="text-base">Configuration</span>
            </div>
            <ChevronRight />
          </div>
        </button>

        {/* Clear all drawings */}
        <button
          type="button"
          disabled={drawingsCount === 0}
          onPointerDown={(e) => {
            e.preventDefault();
            if (drawingsCount > 0) onClearAll();
          }}
          onClick={(e) => e.preventDefault()}
          className={[
            "w-full px-4 py-4 rounded-lg text-left transition-colors bg-zinc-800 hover:bg-zinc-700 [touch-action:manipulation]",
            drawingsCount === 0 ? "opacity-50 cursor-not-allowed" : "text-zinc-300",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-base">Clear all drawings</span>
          </div>
        </button>
      </div>
    </>
  );
}
