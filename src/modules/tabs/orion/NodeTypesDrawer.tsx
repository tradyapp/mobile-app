'use client';

import AppDrawer from '@/components/uiux/AppDrawer';
import { type NodeTypeCategoryGroup } from '@/modules/tabs/orion/nodesEditorTypes';
import { type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';

function BackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

interface NodeTypesDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isNodeTypesLoading: boolean;
  nodeTypesError: string | null;
  availableNodeTypesCount: number;
  nodeTypeGroups: NodeTypeCategoryGroup[];
  selectedNodeTypeCategory: NodeTypeCategoryGroup | null;
  nodeTypeSearch: string;
  onNodeTypeSearchChange: (value: string) => void;
  filteredSelectedCategoryItems: StrategyNodeTypeRecord[];
  onRetryLoadNodeTypes: () => void;
  onSelectCategory: (key: string) => void;
  onBackToCategories: () => void;
  onAddNodeFromType: (nodeType: StrategyNodeTypeRecord) => void;
}

export default function NodeTypesDrawer({
  isOpen,
  onOpenChange,
  isNodeTypesLoading,
  nodeTypesError,
  availableNodeTypesCount,
  nodeTypeGroups,
  selectedNodeTypeCategory,
  nodeTypeSearch,
  onNodeTypeSearchChange,
  filteredSelectedCategoryItems,
  onRetryLoadNodeTypes,
  onSelectCategory,
  onBackToCategories,
  onAddNodeFromType,
}: NodeTypesDrawerProps) {
  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Add Node"
      height="full"
      showHeader
    >
      <div className="pb-4">
        {isNodeTypesLoading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-5 text-sm text-zinc-400">
            Loading node types...
          </div>
        ) : nodeTypesError ? (
          <div className="space-y-2">
            <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {nodeTypesError}
            </div>
            <button
              type="button"
              onClick={onRetryLoadNodeTypes}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100"
            >
              Retry
            </button>
          </div>
        ) : availableNodeTypesCount === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-5 text-sm text-zinc-400">
            No node types available.
          </div>
        ) : !selectedNodeTypeCategory ? (
          <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
            {nodeTypeGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => onSelectCategory(group.key)}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-zinc-200">{group.label}</p>
                  <p className="text-[11px] text-zinc-500">{group.items.length} node{group.items.length === 1 ? '' : 's'}</p>
                </div>
                <span className="text-xl leading-none text-zinc-400">›</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={onBackToCategories}
              className="mb-1 inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
            >
              <BackIcon />
              Categories
            </button>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-zinc-200">{selectedNodeTypeCategory.label}</p>
              <p className="text-[11px] text-zinc-500">{selectedNodeTypeCategory.items.length} node{selectedNodeTypeCategory.items.length === 1 ? '' : 's'}</p>
            </div>

            <div className="mb-2">
              <input
                type="text"
                value={nodeTypeSearch}
                onChange={(event) => onNodeTypeSearchChange(event.target.value)}
                placeholder={`Search in ${selectedNodeTypeCategory.label}...`}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                aria-label="Search node types"
              />
            </div>

            {filteredSelectedCategoryItems.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-5 text-sm text-zinc-400">
                No node types match your search.
              </div>
            ) : (
              filteredSelectedCategoryItems.map((item) => (
                <button
                  key={`${item.key}-${item.id}`}
                  type="button"
                  onClick={() => onAddNodeFromType(item)}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-left"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
                    {item.icon_url ? (
                      <img src={item.icon_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-300">
                        {item.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">{item.name}</p>
                    <p className="truncate text-xs uppercase tracking-[0.08em] text-zinc-500">{item.category || 'uncategorized'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </AppDrawer>
  );
}
