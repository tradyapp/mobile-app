'use client';

import { useEffect, useMemo, useState } from 'react';
import AppDrawer from '@/components/uiux/AppDrawer';
import { normalizeNodeCategory, type NodeTypeCategoryGroup } from '@/modules/tabs/orion/nodesEditorTypes';
import { type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';

function Connector({ side }: { side: 'left' | 'right' }) {
  return (
    <span
      className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-emerald-400 bg-zinc-950 ${side === 'left' ? '-left-1.5' : '-right-1.5'}`}
    />
  );
}

function NodeTypeCard({ item, onClick }: { item: StrategyNodeTypeRecord; onClick: () => void }) {
  const category = normalizeNodeCategory(item.category);
  const isTrigger = category === 'trigger';
  const isOutput = category === 'output';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[108px] w-full flex-col items-center justify-center gap-2 border border-zinc-700 bg-zinc-900 px-3 py-3 text-center ${isTrigger ? 'rounded-[24px] rounded-l-[34px]' : isOutput ? 'rounded-[24px] rounded-r-[34px]' : 'rounded-[24px]'}`}
    >
      {!isTrigger && <Connector side="left" />}
      {!isOutput && <Connector side="right" />}

      <div className="h-9 w-9 overflow-hidden rounded-lg border border-zinc-600 bg-zinc-800">
        {item.icon_url ? (
          <img src={item.icon_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-300">
            {item.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-xs font-semibold leading-tight text-zinc-100">{item.name}</p>
    </button>
  );
}

interface NodeTypesDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isNodeTypesLoading: boolean;
  nodeTypesError: string | null;
  availableNodeTypes: StrategyNodeTypeRecord[];
  nodeTypeGroups: NodeTypeCategoryGroup[];
  onRetryLoadNodeTypes: () => void;
  onAddNodeFromType: (nodeType: StrategyNodeTypeRecord) => void;
  onAddSection?: () => void;
}

export default function NodeTypesDrawer({
  isOpen,
  onOpenChange,
  isNodeTypesLoading,
  nodeTypesError,
  availableNodeTypes,
  nodeTypeGroups,
  onRetryLoadNodeTypes,
  onAddNodeFromType,
  onAddSection,
}: NodeTypesDrawerProps) {
  const [activeCategoryKey, setActiveCategoryKey] = useState<'all' | string>('all');
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setActiveCategoryKey('all');
      return;
    }
    setActiveCategoryKey('all');
  }, [isOpen]);

  useEffect(() => {
    const media = window.matchMedia('(orientation: landscape)');
    const sync = () => setIsLandscape(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const categories = useMemo(
    () => [{ key: 'all', label: 'All' }, ...nodeTypeGroups.map((group) => ({ key: group.key, label: group.label }))],
    [nodeTypeGroups]
  );

  const visibleNodeTypes = useMemo(() => {
    if (activeCategoryKey === 'all') return availableNodeTypes;
    return availableNodeTypes.filter((item) => normalizeNodeCategory(item.category) === activeCategoryKey);
  }, [activeCategoryKey, availableNodeTypes]);

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
        ) : availableNodeTypes.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-5 text-sm text-zinc-400">
            No node types available.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <div className="inline-flex min-w-full gap-2 rounded-2xl bg-transparent p-1">
                {categories.map((category) => {
                  const isActive = activeCategoryKey === category.key;
                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => setActiveCategoryKey(category.key)}
                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-300'}`}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {onAddSection && activeCategoryKey === 'all' && (
              <button
                type="button"
                onClick={() => {
                  onAddSection();
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800">
                  <svg className="h-5 w-5 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 12h6" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-zinc-100">Section</p>
                  <p className="text-[11px] text-zinc-500">Group nodes visually</p>
                </div>
              </button>
            )}

            {visibleNodeTypes.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-5 text-sm text-zinc-400">
                No node types in this category.
              </div>
            ) : (
              <div className={`grid gap-8 ${isLandscape ? 'grid-cols-4' : 'grid-cols-2'}`}>
                {visibleNodeTypes.map((item) => (
                  <NodeTypeCard
                    key={`${item.key}-${item.id}`}
                    item={item}
                    onClick={() => onAddNodeFromType(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppDrawer>
  );
}
