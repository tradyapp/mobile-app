'use client';

import { Searchbar } from 'konsta/react';
import AppDrawer from '@/components/uiux/AppDrawer';
import { SnapshotTree, getTypeToken, type OrionValueType } from '@/modules/tabs/orion/OrionValueView';

export interface OrionReferenceSourceItem {
  nodeId: string;
  label: string;
  nodeTypeKey: string;
  data: unknown;
  dataType: OrionValueType;
  refToken: string;
}

interface OrionReferenceDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeFieldName: string;
  referenceSearch: string;
  onReferenceSearchChange: (value: string) => void;
  isReferenceSourcesLoading: boolean;
  referenceSourcesError: string | null;
  currentNodeReferenceSourcesCount: number;
  isUpstreamExecutingForNode: boolean;
  isPreviewMode: boolean;
  onRunUpstreamNow: () => void;
  filteredReferenceSources: OrionReferenceSourceItem[];
  onPickReference: (token: string) => void;
}

export default function OrionReferenceDrawer({
  isOpen,
  onOpenChange,
  activeFieldName,
  referenceSearch,
  onReferenceSearchChange,
  isReferenceSourcesLoading,
  referenceSourcesError,
  currentNodeReferenceSourcesCount,
  isUpstreamExecutingForNode,
  isPreviewMode,
  onRunUpstreamNow,
  filteredReferenceSources,
  onPickReference,
}: OrionReferenceDrawerProps) {
  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Connect Attribute"
      height="full"
    >
      <div className="mb-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
        Field: <span className="font-semibold text-zinc-200">{activeFieldName}</span>
      </div>

      <div className="mb-3 -mx-4 px-4 [&_input]:rounded-xl!">
        <Searchbar
          placeholder="Search node outputs..."
          value={referenceSearch}
          onInput={(event) => onReferenceSearchChange((event.target as HTMLInputElement).value)}
          onClear={() => onReferenceSearchChange('')}
        />
      </div>

      <div className="space-y-1.5 pb-6">
        {isReferenceSourcesLoading ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-center text-sm text-zinc-500">
            Loading outputs...
          </div>
        ) : referenceSourcesError ? (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-3 text-center text-sm text-red-300">
            {referenceSourcesError}
          </div>
        ) : currentNodeReferenceSourcesCount === 0 ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-center text-sm text-zinc-400">
              Run <span className="font-semibold text-zinc-200">Play</span> in this node panel to execute previous nodes and load connectable outputs.
            </div>
            <button
              type="button"
              onClick={onRunUpstreamNow}
              disabled={isUpstreamExecutingForNode || isPreviewMode}
              className="w-full rounded-lg border border-emerald-700 bg-emerald-950/50 px-3 py-2 text-sm font-semibold text-emerald-300 disabled:opacity-60"
            >
              {isUpstreamExecutingForNode ? 'Running...' : 'Run Upstream Now'}
            </button>
          </div>
        ) : filteredReferenceSources.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-center text-sm text-zinc-500">
            No upstream outputs available.
          </div>
        ) : (
          filteredReferenceSources.map((item) => (
            <button
              key={`${item.nodeId}-${item.refToken}`}
              type="button"
              onClick={() => onPickReference(item.refToken)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-left transition-colors hover:bg-zinc-800/80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{item.label}</p>
                  <p className="truncate text-[11px] text-zinc-500">{item.nodeId} · {item.nodeTypeKey}</p>
                </div>
                <span className="rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                  {getTypeToken(item.dataType).typeLabel}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                <SnapshotTree label="output" value={item.data} />
              </div>
              <div className="mt-1 truncate text-[10px] text-emerald-300">{item.refToken}</div>
            </button>
          ))
        )}
      </div>
    </AppDrawer>
  );
}
