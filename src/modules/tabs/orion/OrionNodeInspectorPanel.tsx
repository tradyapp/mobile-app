'use client';

import { Segmented, SegmentedButton } from 'konsta/react';
import OrionAttributesPanel from '@/modules/tabs/orion/OrionAttributesPanel';
import { SnapshotTree } from '@/modules/tabs/orion/OrionValueView';
import { type EditorNodeField } from '@/modules/tabs/orion/nodesEditorTypes';

type NodeDetailsPanel = 'inputs' | 'attributes' | 'outputs';
type NodeDetailsPanelItem = { key: NodeDetailsPanel; label: string };

interface OrionNodeInspectorPanelProps {
  nodeLabel: string;
  nodeTypeKey: string;
  nodeTypeVersion: number | null;
  isPreviewMode: boolean;
  isUpstreamExecuting: boolean;
  onBack: () => void;
  onRunUpstream: () => void;
  nodeDetailsPanel: NodeDetailsPanel;
  nodeDetailsPanelItems: NodeDetailsPanelItem[];
  onNodeDetailsPanelChange: (next: NodeDetailsPanel) => void;
  panelFields: EditorNodeField[];
  timezoneOptions: Array<{ value: string; label: string }>;
  onSetAttributeFieldValue: (index: number, value: string) => void;
  onToggleAttributeMultiOption: (index: number, optionValue: string) => void;
  onOpenReference: (index: number) => void;
  onClearReference: (index: number) => void;
  selectedNodeExecutionTrace: {
    inputSnapshot: unknown;
    outputSnapshot: unknown;
    error: string | null;
  } | null;
}

export default function OrionNodeInspectorPanel({
  nodeLabel,
  nodeTypeKey,
  nodeTypeVersion,
  isPreviewMode,
  isUpstreamExecuting,
  onBack,
  onRunUpstream,
  nodeDetailsPanel,
  nodeDetailsPanelItems,
  onNodeDetailsPanelChange,
  panelFields,
  timezoneOptions,
  onSetAttributeFieldValue,
  onToggleAttributeMultiOption,
  onOpenReference,
  onClearReference,
  selectedNodeExecutionTrace,
}: OrionNodeInspectorPanelProps) {
  return (
    <div className="h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center border-b border-zinc-800 px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300"
          aria-label="Back to node editor"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-2 min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">{nodeLabel}</p>
          <p className="truncate text-[11px] text-zinc-500">
            {nodeTypeKey}
            {typeof nodeTypeVersion === 'number' ? ` @v${nodeTypeVersion}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onRunUpstream}
          disabled={isUpstreamExecuting || isPreviewMode}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-950/60 px-3 text-[11px] font-semibold text-emerald-300 disabled:opacity-60"
          aria-label="Run upstream nodes for references"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          {isUpstreamExecuting ? 'Running...' : 'Play'}
        </button>
      </div>
      <div className="border-b border-zinc-800 px-3 py-2">
        <Segmented
          strong
          className="w-full [&_button]:flex-1 [&_button]:py-1.5 [&_button]:text-[11px]"
        >
          {nodeDetailsPanelItems.map((item) => (
            <SegmentedButton
              key={item.key}
              active={nodeDetailsPanel === item.key}
              onClick={() => onNodeDetailsPanelChange(item.key)}
            >
              {item.label}
            </SegmentedButton>
          ))}
        </Segmented>
      </div>
      <div className="h-[calc(100%-92px)] overflow-y-auto px-3 py-3 [scrollbar-width:thin] [scrollbar-color:#3f3f46_#09090b] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-950 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-600">
        <div className="space-y-2">
          {nodeDetailsPanel === 'attributes' ? (
            <OrionAttributesPanel
              fields={panelFields}
              isPreviewMode={isPreviewMode}
              timezoneOptions={timezoneOptions}
              onSetFieldValue={onSetAttributeFieldValue}
              onToggleMultiOption={onToggleAttributeMultiOption}
              onOpenReference={onOpenReference}
              onClearReference={onClearReference}
            />
          ) : (
            <>
              {!selectedNodeExecutionTrace && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-zinc-500">
                  Run Play to see execution results for this panel.
                </div>
              )}
              {selectedNodeExecutionTrace && nodeDetailsPanel === 'inputs' && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                  <p className="text-[11px] font-semibold text-zinc-300">Execution Snapshot · Inputs</p>
                  <div className="mt-2">
                    <SnapshotTree label="inputs" value={selectedNodeExecutionTrace.inputSnapshot} />
                  </div>
                </div>
              )}
              {selectedNodeExecutionTrace && nodeDetailsPanel === 'outputs' && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                  <p className={`text-[11px] font-semibold ${selectedNodeExecutionTrace.error ? 'text-red-300' : 'text-zinc-300'}`}>
                    {selectedNodeExecutionTrace.error ? 'Execution Snapshot · Error' : 'Execution Snapshot · Output'}
                  </p>
                  <div className="mt-2">
                    <SnapshotTree
                      label={selectedNodeExecutionTrace.error ? 'error' : 'output'}
                      value={selectedNodeExecutionTrace.error ?? selectedNodeExecutionTrace.outputSnapshot}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
