'use client';
import {
  Background,
  Controls,
  ReactFlow,
  type Connection,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeTypes,
} from '@xyflow/react';
import { SymbolAvatar } from '@/modules/tabs/orion/OrionValueView';

interface ExecutionSymbol {
  ticker: string;
  name: string;
  icon_url: string | null;
}

interface OrionNodesCanvasProps {
  nodes: RFNode[];
  edges: RFEdge[];
  nodeTypes: NodeTypes;
  isPreviewMode: boolean;
  hasSelection: boolean;
  selectedExecutionSymbol: ExecutionSymbol | null;
  trackedSymbolsCount: number;
  onNodesChange?: (changes: any) => void;
  onEdgesChange?: (changes: any) => void;
  onConnect?: (connection: Connection) => void;
  onNodeClick?: (event: unknown, node: RFNode) => void;
  onNodeDoubleClick?: (event: unknown, node: RFNode) => void;
  onSelectionChange?: (params: { nodes: RFNode[]; edges: RFEdge[] }) => void;
  onOpenExecutionSymbolDrawer: () => void;
  onDeleteSelectionRequest: () => void;
}

export default function OrionNodesCanvas({
  nodes,
  edges,
  nodeTypes,
  isPreviewMode,
  hasSelection,
  selectedExecutionSymbol,
  trackedSymbolsCount,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDoubleClick,
  onSelectionChange,
  onOpenExecutionSymbolDrawer,
  onDeleteSelectionRequest,
}: OrionNodesCanvasProps) {
  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          nodesDraggable={!isPreviewMode}
          nodesConnectable={!isPreviewMode}
          elementsSelectable={!isPreviewMode}
          edgesUpdatable={!isPreviewMode}
          onSelectionChange={onSelectionChange}
          proOptions={{ hideAttribution: true }}
          fitView
        >
          <Background color="#27272a" gap={16} />
          <Controls className="orion-nodes-controls" />
        </ReactFlow>
        <style>{`
          .orion-nodes-controls {
            box-shadow: none !important;
          }
          .orion-nodes-controls .react-flow__controls-button {
            background: #09090b !important;
            border-color: #27272a !important;
            color: #ffffff !important;
          }
          .orion-nodes-controls .react-flow__controls-button svg {
            fill: #ffffff !important;
          }
          .orion-nodes-controls .react-flow__controls-button:hover {
            background: #18181b !important;
          }
          .react-flow__node.selected > div {
            border-color: #34d399 !important;
            box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.6), 0 10px 28px rgba(0, 0, 0, 0.45) !important;
          }
          .react-flow__edge.selected .react-flow__edge-path {
            stroke: #34d399 !important;
            filter: drop-shadow(0 0 6px rgba(52, 211, 153, 0.45));
          }
        `}</style>

        {!isPreviewMode && (
          <button
            type="button"
            onClick={onOpenExecutionSymbolDrawer}
            className="absolute left-3 top-3 z-[240] flex min-w-[196px] max-w-[62vw] items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/95 px-2.5 py-2 text-left shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
            aria-label="Open test symbol selector"
          >
            <SymbolAvatar
              iconUrl={selectedExecutionSymbol?.icon_url ?? null}
              ticker={selectedExecutionSymbol?.ticker ?? '---'}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-zinc-100">
                {selectedExecutionSymbol?.ticker ?? 'Select symbol'}
              </p>
              <p className="truncate text-[10px] text-zinc-400">
                {selectedExecutionSymbol?.name ?? (trackedSymbolsCount === 0 ? 'No symbols configured' : 'Tap to choose test symbol')}
              </p>
            </div>
            <svg className="h-4 w-4 shrink-0 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}

        {!isPreviewMode && hasSelection && (
          <button
            type="button"
            onClick={onDeleteSelectionRequest}
            className="absolute right-3 top-3 z-[240] flex h-10 w-10 items-center justify-center rounded-full border border-red-900 bg-red-950/70 text-red-300"
            aria-label="Delete selected elements"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M8 6V4h8v2m-7 4v8m4-8v8M6 6l1 14h10l1-14" />
            </svg>
          </button>
        )}
    </div>
  );
}
