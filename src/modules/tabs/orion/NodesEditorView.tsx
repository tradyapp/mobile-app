/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogButton } from 'konsta/react';
import {
  addEdge,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Connection,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeProps as RFNodeProps,
  type NodeTypes,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CogIcon from '@/components/icons/CogIcon';
import NodeTypesDrawer from '@/modules/tabs/orion/NodeTypesDrawer';
import { NodeSettingsDrawer, VersionNameDialog } from '@/modules/tabs/orion/NodeSettingsDrawer';
import { compareNodeCategory, EditorNodeData, formatNodeCategoryLabel, NodeTypeCategoryGroup, normalizeNodeCategory } from '@/modules/tabs/orion/nodesEditorTypes';
import { strategyNodeTypesService, type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { strategiesService, type StrategyNodeMap, type StrategyNodeVersionRecord } from '@/services/StrategiesService';

function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
interface NodesViewProps {
  strategyId: string;
  strategyName: string;
  onClose: () => void;
}

function NodesView({ strategyId, strategyName, onClose }: NodesViewProps) {
  const areSameIds = (prev: string[], next: string[]) => {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i += 1) {
      if (prev[i] !== next[i]) return false;
    }
    return true;
  };

  const safeHorizontalInsetStyle = {
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
  } as const;

  const safeCanvasInsetStyle = {
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
  } as const;

  const nodeTypes = useMemo<NodeTypes>(() => ({
    editorNode: ({ data }: RFNodeProps<RFNode<EditorNodeData>>) => {
      const category = normalizeNodeCategory(data?.category);
      const isTrigger = category === 'trigger';
      const isOutput = category === 'output';
      const showLeftHandle = !isTrigger;
      const showRightHandle = !isOutput;

      return (
        <div
          className={`relative flex min-h-[98px] min-w-[126px] flex-col items-center justify-center gap-2 border border-zinc-700 bg-zinc-900 px-3 py-3 text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${isTrigger ? 'rounded-[24px] rounded-l-[34px]' : isOutput ? 'rounded-[24px] rounded-r-[34px]' : 'rounded-[24px]'}`}
        >
          {showLeftHandle && (
            <Handle
              id="left"
              type="target"
              position={Position.Left}
              className="!h-4 !w-4 !border !border-emerald-400 !bg-zinc-950"
              style={{ left: -8 }}
            />
          )}
          <div className="h-8 w-8 overflow-hidden rounded-lg border border-zinc-600 bg-zinc-800">
            {data?.iconUrl ? (
              <img src={data.iconUrl} alt={data.label ?? 'Node icon'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-300">
                {(data?.label ?? 'N').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 text-center">
            <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-zinc-100">{data?.label ?? 'Node'}</p>
            {data?.category && (
              <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.08em] text-zinc-500">{data.category}</p>
            )}
          </div>
          {showRightHandle && (
            <Handle
              id="right"
              type="source"
              position={Position.Right}
              className="!h-4 !w-4 !border !border-emerald-400 !bg-zinc-950"
              style={{ right: -8 }}
            />
          )}
        </div>
      );
    },
  }), []);

  const nodeCounterRef = useRef(1);
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const [availableNodeTypes, setAvailableNodeTypes] = useState<StrategyNodeTypeRecord[]>([]);
  const [isNodeTypesLoading, setIsNodeTypesLoading] = useState(false);
  const [nodeTypesError, setNodeTypesError] = useState<string | null>(null);
  const [isNodeTypesDrawerOpen, setIsNodeTypesDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [isNodeMapLoading, setIsNodeMapLoading] = useState(true);
  const [nodeMapError, setNodeMapError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nodeVersions, setNodeVersions] = useState<StrategyNodeVersionRecord[]>([]);
  const [isNodeVersionsLoading, setIsNodeVersionsLoading] = useState(false);
  const [nodeVersionsError, setNodeVersionsError] = useState<string | null>(null);
  const [isPublishingVersion, setIsPublishingVersion] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<'menu' | 'versions'>('menu');
  const [isVersionNameDialogOpen, setIsVersionNameDialogOpen] = useState(false);
  const [isDeleteSelectionDialogOpen, setIsDeleteSelectionDialogOpen] = useState(false);
  const [versionNameInput, setVersionNameInput] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [previewVersion, setPreviewVersion] = useState<StrategyNodeVersionRecord | null>(null);
  const hasHydratedNodeMapRef = useRef(false);
  const lastSavedNodeMapRef = useRef('');
  const [lastSavedNodeMapSnapshot, setLastSavedNodeMapSnapshot] = useState('');
  const saveRequestIdRef = useRef(0);
  const draftBeforePreviewRef = useRef<StrategyNodeMap | null>(null);

  const nodeTypeGroups = useMemo<NodeTypeCategoryGroup[]>(() => {
    const grouped = new Map<string, StrategyNodeTypeRecord[]>();

    for (const item of availableNodeTypes) {
      const categoryKey = normalizeNodeCategory(item.category);
      const existing = grouped.get(categoryKey) ?? [];
      existing.push(item);
      grouped.set(categoryKey, existing);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => compareNodeCategory(a, b))
      .map(([key, items]) => ({
        key,
        label: formatNodeCategoryLabel(key),
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [availableNodeTypes]);

  const activeNodeVersion = useMemo(
    () => nodeVersions.find((version) => version.is_active) ?? null,
    [nodeVersions]
  );
  const isPreviewMode = previewVersion !== null;
  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;

  const getCurrentNodeMap = useCallback((): StrategyNodeMap => ({
    version: 1,
    nodes: nodes as unknown[],
    edges: edges as unknown[],
  }), [nodes, edges]);

  const applyNodeMapToCanvas = useCallback((nodeMap: StrategyNodeMap) => {
    const nextNodes = (nodeMap.nodes ?? []) as RFNode[];
    const nextEdges = (nodeMap.edges ?? []) as RFEdge[];

    setNodes(nextNodes);
    setEdges(nextEdges);

    const maxNodeIndex = nextNodes.reduce((max, node) => {
      const match = /^node-(\d+)$/.exec(node.id);
      if (!match) return max;
      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    nodeCounterRef.current = maxNodeIndex + 1;
  }, [setEdges, setNodes]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((prev) => addEdge(connection, prev));
  }, [setEdges]);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: RFNode[]; edges: RFEdge[] }) => {
      const nextNodeIds = selectedNodes.map((node) => node.id);
      const nextEdgeIds = selectedEdges.map((edge) => edge.id);

      setSelectedNodeIds((prev) => (areSameIds(prev, nextNodeIds) ? prev : nextNodeIds));
      setSelectedEdgeIds((prev) => (areSameIds(prev, nextEdgeIds) ? prev : nextEdgeIds));
    },
    []
  );

  const loadNodeTypes = useCallback(async () => {
    setIsNodeTypesLoading(true);
    setNodeTypesError(null);
    try {
      const items = await strategyNodeTypesService.listActiveNodeTypes();
      setAvailableNodeTypes(items);
    } catch (error) {
      setNodeTypesError(error instanceof Error ? error.message : 'Failed to load node types');
    } finally {
      setIsNodeTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNodeTypes();
  }, [loadNodeTypes]);

  useEffect(() => {
    let active = true;

    const loadNodeMap = async () => {
      setIsNodeMapLoading(true);
      setNodeMapError(null);
      setSaveError(null);
      setSaveStatus('idle');
      setPreviewVersion(null);
      draftBeforePreviewRef.current = null;

      try {
        const payload = await strategiesService.getStrategyNodeMap(strategyId);
        if (!active) return;

        const normalized = payload ?? { version: 1, nodes: [], edges: [] };
        applyNodeMapToCanvas(normalized);

        const serialized = JSON.stringify({
          version: normalized.version,
          nodes: normalized.nodes,
          edges: normalized.edges,
        } satisfies StrategyNodeMap);
        lastSavedNodeMapRef.current = serialized;
        setLastSavedNodeMapSnapshot(serialized);
        hasHydratedNodeMapRef.current = true;
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
      } catch (error) {
        if (!active) return;
        setNodeMapError(error instanceof Error ? error.message : 'Failed to load strategy node map');
        hasHydratedNodeMapRef.current = true;
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
      } finally {
        if (active) setIsNodeMapLoading(false);
      }
    };

    void loadNodeMap();

    return () => {
      active = false;
    };
  }, [strategyId, applyNodeMapToCanvas]);

  useEffect(() => {
    if (!hasHydratedNodeMapRef.current) return;
    if (isPreviewMode) return;

    const payload = getCurrentNodeMap();
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedNodeMapRef.current) return;

    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setSaveStatus('saving');
    setSaveError(null);

    const timeoutId = window.setTimeout(() => {
      void strategiesService.saveStrategyNodeMap(strategyId, payload)
        .then(() => {
          if (saveRequestIdRef.current !== requestId) return;
          lastSavedNodeMapRef.current = serialized;
          setLastSavedNodeMapSnapshot(serialized);
          setSaveStatus('saved');
        })
        .catch((error) => {
          if (saveRequestIdRef.current !== requestId) return;
          setSaveStatus('error');
          setSaveError(error instanceof Error ? error.message : 'Failed to save node map');
        });
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [strategyId, nodes, edges, isPreviewMode, getCurrentNodeMap]);

  const handleAddNodeFromType = useCallback((nodeType: StrategyNodeTypeRecord) => {
    setNodes((prev) => {
      const index = prev.length;
      const nextLabel = nodeCounterRef.current;
      nodeCounterRef.current += 1;

      const nextNode: RFNode = {
        id: `node-${nextLabel}`,
        type: 'editorNode',
        position: {
          x: 80 + (index % 4) * 180,
          y: 80 + Math.floor(index / 4) * 120,
        },
        data: {
          label: nodeType.name,
          nodeTypeKey: nodeType.key,
          category: nodeType.category,
          iconUrl: nodeType.icon_url,
        } satisfies EditorNodeData,
      };

      return [...prev, nextNode];
    });
    setIsNodeTypesDrawerOpen(false);
  }, [setNodes]);

  const handleNodeTypesDrawerOpenChange = useCallback((open: boolean) => {
    setIsNodeTypesDrawerOpen(open);
  }, []);

  const handleDeleteSelection = useCallback(() => {
    if (!hasSelection) return;

    const nodeIdSet = new Set(selectedNodeIds);
    const edgeIdSet = new Set(selectedEdgeIds);

    setNodes((prev) => prev.filter((node) => !nodeIdSet.has(node.id)));
    setEdges((prev) =>
      prev.filter((edge) =>
        !edgeIdSet.has(edge.id) &&
        !nodeIdSet.has(edge.source) &&
        !nodeIdSet.has(edge.target)
      )
    );

    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setIsDeleteSelectionDialogOpen(false);
  }, [hasSelection, selectedNodeIds, selectedEdgeIds, setEdges, setNodes]);

  const handleSettingsDrawerOpenChange = useCallback((open: boolean) => {
    setIsSettingsDrawerOpen(open);
    if (!open) {
      setSettingsPanel('menu');
      setIsVersionNameDialogOpen(false);
    }
  }, []);

  const getNextVersionDefaultName = useCallback(() => {
    const maxVersion = nodeVersions.reduce((max, item) => Math.max(max, item.version_number), 0);
    return `v${maxVersion + 1}`;
  }, [nodeVersions]);

  const loadNodeVersions = useCallback(async () => {
    setIsNodeVersionsLoading(true);
    setNodeVersionsError(null);
    try {
      const rows = await strategiesService.listStrategyNodeVersions(strategyId);
      setNodeVersions(rows);
    } catch (error) {
      setNodeVersionsError(error instanceof Error ? error.message : 'Failed to load versions');
    } finally {
      setIsNodeVersionsLoading(false);
    }
  }, [strategyId]);

  useEffect(() => {
    if (!isSettingsDrawerOpen) return;
    void loadNodeVersions();
  }, [isSettingsDrawerOpen, loadNodeVersions]);

  const handlePublishVersion = useCallback(async (versionName?: string) => {
    if (isPublishingVersion || isPreviewMode) return;
    setIsPublishingVersion(true);
    setNodeVersionsError(null);

    try {
      const draftPayload = getCurrentNodeMap();
      await strategiesService.saveStrategyNodeMap(strategyId, draftPayload);
      lastSavedNodeMapRef.current = JSON.stringify(draftPayload);
      setLastSavedNodeMapSnapshot(JSON.stringify(draftPayload));
      const created = await strategiesService.createStrategyNodeVersion(strategyId, versionName, true);
      setNodeVersions((prev) => {
        const next = prev.map((item) => ({ ...item, is_active: false }));
        const withoutSame = next.filter((item) => item.id !== created.id);
        return [created, ...withoutSame].sort((a, b) => b.version_number - a.version_number);
      });
      setSaveStatus('saved');
    } catch (error) {
      setNodeVersionsError(error instanceof Error ? error.message : 'Failed to publish version');
    } finally {
      setIsPublishingVersion(false);
    }
  }, [isPublishingVersion, isPreviewMode, getCurrentNodeMap, strategyId]);

  const handleEnterPreviewVersion = useCallback((version: StrategyNodeVersionRecord) => {
    if (!version.node_map) return;
    if (!isPreviewMode) {
      draftBeforePreviewRef.current = getCurrentNodeMap();
    }
    applyNodeMapToCanvas(version.node_map);
    setPreviewVersion(version);
    setSaveStatus('idle');
    setSaveError(null);
    setIsSettingsDrawerOpen(false);
    setSettingsPanel('menu');
  }, [isPreviewMode, getCurrentNodeMap, applyNodeMapToCanvas]);

  const handleEditPreviewAsDraft = useCallback(async () => {
    if (!previewVersion?.node_map) return;

    const draftPayload = previewVersion.node_map;
    applyNodeMapToCanvas(draftPayload);
    setPreviewVersion(null);
    draftBeforePreviewRef.current = null;
    setSaveStatus('saving');
    setSaveError(null);

    try {
      await strategiesService.saveStrategyNodeMap(strategyId, draftPayload);
      lastSavedNodeMapRef.current = JSON.stringify(draftPayload);
      setLastSavedNodeMapSnapshot(JSON.stringify(draftPayload));
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save node map');
    }
  }, [previewVersion, applyNodeMapToCanvas, strategyId]);

  const handleActivatePreviewVersion = useCallback(async () => {
    if (!previewVersion || previewVersion.is_active || isPublishingVersion) return;

    setIsPublishingVersion(true);
    setNodeVersionsError(null);
    try {
      await strategiesService.activateStrategyNodeVersion(strategyId, previewVersion.id);
      setNodeVersions((prev) =>
        prev.map((item) => ({ ...item, is_active: item.id === previewVersion.id }))
      );
      setPreviewVersion((prev) => (prev ? { ...prev, is_active: true } : prev));
      setSaveStatus('saved');
    } catch (error) {
      setNodeVersionsError(error instanceof Error ? error.message : 'Failed to activate version');
    } finally {
      setIsPublishingVersion(false);
    }
  }, [previewVersion, isPublishingVersion, strategyId]);

  return (
    <div className="relative z-[220] flex h-[100dvh] flex-col overflow-hidden bg-zinc-950">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex items-center gap-3 border-b border-zinc-800 pb-3 pt-[max(16px,env(safe-area-inset-top))]"
          style={safeHorizontalInsetStyle}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-200"
            aria-label="Close nodes view"
          >
            <CloseIcon />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{strategyName}</p>
            <p className="text-xs text-zinc-500">
              {isNodeMapLoading
                ? 'Loading map...'
                : isPreviewMode
                  ? `Preview · v${previewVersion.version_number} ${previewVersion.name}`
                  : saveStatus === 'saving'
                    ? `Draft · Saving...${activeNodeVersion ? ` · Active v${activeNodeVersion.version_number}` : ''}`
                    : saveStatus === 'saved'
                      ? `Draft · Saved${activeNodeVersion ? ` · Active v${activeNodeVersion.version_number}` : ''}`
                      : saveStatus === 'error'
                        ? 'Draft · Save error'
                        : `Draft${activeNodeVersion ? ` · Active v${activeNodeVersion.version_number}` : ''}`}
            </p>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => {
                setSettingsPanel('menu');
                setIsSettingsDrawerOpen(true);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-100"
              aria-label="Open nodes settings"
            >
              <CogIcon />
            </button>
          </div>
        </header>

        <div
          className="min-h-0 flex-1 overflow-hidden pb-4 pt-4"
          style={safeCanvasInsetStyle}
        >
          {nodeMapError && (
            <div className="mb-3 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {nodeMapError}
            </div>
          )}
          {saveError && (
            <div className="mb-3 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {saveError}
            </div>
          )}
          <div className="relative h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={isPreviewMode ? undefined : onNodesChange}
              onEdgesChange={isPreviewMode ? undefined : onEdgesChange}
              onConnect={isPreviewMode ? undefined : onConnect}
              nodeTypes={nodeTypes}
              nodesDraggable={!isPreviewMode}
              nodesConnectable={!isPreviewMode}
              elementsSelectable={!isPreviewMode}
              edgesUpdatable={!isPreviewMode}
              onSelectionChange={
                isPreviewMode
                  ? undefined
                  : handleSelectionChange
              }
              proOptions={{ hideAttribution: true }}
              fitView
            >
              <Background color="#3f3f46" gap={16} />
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

            {!isPreviewMode && hasSelection && (
              <button
                type="button"
                onClick={() => setIsDeleteSelectionDialogOpen(true)}
                className="absolute right-3 top-3 z-[240] flex h-10 w-10 items-center justify-center rounded-full border border-red-900 bg-red-950/70 text-red-300"
                aria-label="Delete selected elements"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M8 6V4h8v2m-7 4v8m4-8v8M6 6l1 14h10l1-14" />
                </svg>
              </button>
            )}
          </div>
        </div>
      {isPreviewMode ? (
        <div className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-[230] -translate-x-1/2">
          <button
            type="button"
            onClick={() => void handleEditPreviewAsDraft()}
            className="rounded-full border border-zinc-600 bg-zinc-800/95 px-5 py-2 text-sm font-medium text-zinc-100 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
          >
            Editar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsNodeTypesDrawerOpen(true)}
          className="absolute bottom-[max(40px,env(safe-area-inset-bottom))] right-[max(28px,env(safe-area-inset-right))] z-[230] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl font-light text-zinc-950 shadow-[0_10px_25px_rgba(16,185,129,0.35)]"
          aria-label="Add node"
        >
          +
        </button>
      )}
      </div>

      <NodeTypesDrawer
        isOpen={isNodeTypesDrawerOpen}
        onOpenChange={handleNodeTypesDrawerOpenChange}
        isNodeTypesLoading={isNodeTypesLoading}
        nodeTypesError={nodeTypesError}
        availableNodeTypes={availableNodeTypes}
        nodeTypeGroups={nodeTypeGroups}
        onRetryLoadNodeTypes={() => void loadNodeTypes()}
        onAddNodeFromType={handleAddNodeFromType}
      />

      <NodeSettingsDrawer
        isOpen={isSettingsDrawerOpen}
        onOpenChange={handleSettingsDrawerOpenChange}
        settingsPanel={settingsPanel}
        onSettingsPanelChange={setSettingsPanel}
        isPreviewMode={isPreviewMode}
        isPublishingVersion={isPublishingVersion}
        previewVersion={previewVersion}
        onActivateButtonClick={async () => {
          if (isPreviewMode) {
            await handleActivatePreviewVersion();
            return;
          }
          if (!isNodeVersionsLoading && nodeVersions.length === 0) {
            await loadNodeVersions();
          }
          setVersionNameInput(getNextVersionDefaultName());
          setIsVersionNameDialogOpen(true);
        }}
        onOpenVersions={() => {
          setSettingsPanel('versions');
          void loadNodeVersions();
        }}
        isNodeVersionsLoading={isNodeVersionsLoading}
        nodeVersions={nodeVersions}
        onEnterPreviewVersion={handleEnterPreviewVersion}
        nodeVersionsError={nodeVersionsError}
      />

      <VersionNameDialog
        isOpen={isVersionNameDialogOpen}
        versionNameInput={versionNameInput}
        onVersionNameInputChange={setVersionNameInput}
        onClose={() => setIsVersionNameDialogOpen(false)}
        onConfirm={async () => {
          const fallback = getNextVersionDefaultName();
          const chosen = versionNameInput.trim() || fallback;
          await handlePublishVersion(chosen);
          setIsVersionNameDialogOpen(false);
        }}
        isPublishingVersion={isPublishingVersion}
      />

      {typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10040] pointer-events-none">
          <div className="pointer-events-auto">
            <Dialog
              backdrop
              opened={isDeleteSelectionDialogOpen}
              onBackdropClick={(event) => {
                event?.stopPropagation?.();
                setIsDeleteSelectionDialogOpen(false);
              }}
              title="Eliminar selección"
              content="Se eliminarán los nodos o conexiones seleccionadas. ¿Deseas continuar?"
              buttons={(
                <>
                  <DialogButton
                    onClick={(event) => {
                      event?.stopPropagation?.();
                      setIsDeleteSelectionDialogOpen(false);
                    }}
                  >
                    Cancelar
                  </DialogButton>
                  <DialogButton
                    strong
                    className="text-red-400"
                    onClick={(event) => {
                      event?.stopPropagation?.();
                      handleDeleteSelection();
                    }}
                  >
                    Eliminar
                  </DialogButton>
                </>
              )}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


export default NodesView;
