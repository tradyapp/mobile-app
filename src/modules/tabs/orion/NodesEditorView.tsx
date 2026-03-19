/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import AppDrawer from '@/components/uiux/AppDrawer';
import { strategyNodeTypesService, type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { strategiesService, type StrategyNodeMap, type StrategyNodeVersionRecord } from '@/services/StrategiesService';

interface EditorNodeData {
  label: string;
  nodeTypeKey?: string;
  category?: string;
  iconUrl?: string | null;
}

interface NodeTypeCategoryGroup {
  key: string;
  label: string;
  items: StrategyNodeTypeRecord[];
}

const NODE_CATEGORY_SORT_WEIGHT: Record<string, number> = {
  trigger: 0,
  condition: 1,
  logic: 2,
  action: 3,
  output: 4,
  uncategorized: 99,
};

function normalizeNodeCategory(value?: string | null): string {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : 'uncategorized';
}

function formatNodeCategoryLabel(key: string): string {
  if (key === 'uncategorized') return 'Uncategorized';
  return key
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function compareNodeCategory(a: string, b: string): number {
  const weightA = NODE_CATEGORY_SORT_WEIGHT[a] ?? 50;
  const weightB = NODE_CATEGORY_SORT_WEIGHT[b] ?? 50;
  if (weightA !== weightB) return weightA - weightB;
  return a.localeCompare(b);
}
function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}
interface NodesViewProps {
  strategyId: string;
  strategyName: string;
  onClose: () => void;
}

function NodesView({ strategyId, strategyName, onClose }: NodesViewProps) {
  const safeHorizontalInsetStyle = {
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
  } as const;

  const safeCanvasInsetStyle = {
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
  } as const;

  const safeDrawerInsetStyle = {
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
  } as const;

  const nodeTypes = useMemo<NodeTypes>(() => ({
    editorNode: ({ data }: RFNodeProps<RFNode<EditorNodeData>>) => {
      const category = (data?.category ?? 'logic').toLowerCase();
      const showLeftHandle = category !== 'trigger';
      const showRightHandle = category !== 'output';

      return (
        <div className="relative rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          {showLeftHandle && (
            <Handle
              id="left"
              type="target"
              position={Position.Left}
              className="!h-6 !w-6 !border-2 !border-emerald-400 !bg-black"
            />
          )}
          <div className="flex items-center gap-2 pr-2">
            <div className="h-6 w-6 overflow-hidden rounded-md border border-zinc-600 bg-zinc-800">
              {data?.iconUrl ? (
                <img src={data.iconUrl} alt={data.label ?? 'Node icon'} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-300">
                  {(data?.label ?? 'N').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-100">{data?.label ?? 'Node'}</p>
              {data?.category && (
                <p className="truncate text-[10px] uppercase tracking-[0.08em] text-zinc-500">{data.category}</p>
              )}
            </div>
          </div>
          {showRightHandle && (
            <Handle
              id="right"
              type="source"
              position={Position.Right}
              className="!h-6 !w-6 !border-2 !border-emerald-400 !bg-black"
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
  const [selectedNodeTypeCategoryKey, setSelectedNodeTypeCategoryKey] = useState<string | null>(null);
  const [nodeTypeSearch, setNodeTypeSearch] = useState('');
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
  const [versionNameInput, setVersionNameInput] = useState('');
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

  const selectedNodeTypeCategory = useMemo(
    () => nodeTypeGroups.find((group) => group.key === selectedNodeTypeCategoryKey) ?? null,
    [nodeTypeGroups, selectedNodeTypeCategoryKey]
  );
  const activeNodeVersion = useMemo(
    () => nodeVersions.find((version) => version.is_active) ?? null,
    [nodeVersions]
  );
  const isPreviewMode = previewVersion !== null;

  const filteredSelectedCategoryItems = useMemo<StrategyNodeTypeRecord[]>(() => {
    if (!selectedNodeTypeCategory) return [];

    const query = nodeTypeSearch.trim().toLowerCase();
    if (!query) return selectedNodeTypeCategory.items;

    return selectedNodeTypeCategory.items.filter((item) => {
      const name = item.name.toLowerCase();
      const key = item.key.toLowerCase();
      return name.includes(query) || key.includes(query);
    });
  }, [selectedNodeTypeCategory, nodeTypeSearch]);

  const getCurrentNodeMap = useCallback((): StrategyNodeMap => ({
    version: 1,
    nodes: nodes as unknown[],
    edges: edges as unknown[],
  }), [nodes, edges]);
  const hasUnsavedDraftChanges = useMemo(() => {
    if (isPreviewMode || !hasHydratedNodeMapRef.current) return false;
    return JSON.stringify(getCurrentNodeMap()) !== lastSavedNodeMapSnapshot;
  }, [isPreviewMode, getCurrentNodeMap, lastSavedNodeMapSnapshot]);

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
      } catch (error) {
        if (!active) return;
        setNodeMapError(error instanceof Error ? error.message : 'Failed to load strategy node map');
        hasHydratedNodeMapRef.current = true;
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

  useEffect(() => {
    if (!selectedNodeTypeCategoryKey) return;
    const exists = nodeTypeGroups.some((group) => group.key === selectedNodeTypeCategoryKey);
    if (!exists) setSelectedNodeTypeCategoryKey(null);
  }, [nodeTypeGroups, selectedNodeTypeCategoryKey]);

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
    setSelectedNodeTypeCategoryKey(null);
    setNodeTypeSearch('');
  }, [setNodes]);

  const handleNodeTypesDrawerOpenChange = useCallback((open: boolean) => {
    setIsNodeTypesDrawerOpen(open);
    if (!open) {
      setSelectedNodeTypeCategoryKey(null);
      setNodeTypeSearch('');
    }
  }, []);

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

  const handleSaveNodeMap = useCallback(async () => {
    if (isPreviewMode) return;
    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setSaveStatus('saving');
    setSaveError(null);

    const payload = getCurrentNodeMap();
    const serialized = JSON.stringify(payload);

    try {
      await strategiesService.saveStrategyNodeMap(strategyId, payload);
      if (saveRequestIdRef.current !== requestId) return;
      lastSavedNodeMapRef.current = serialized;
      setLastSavedNodeMapSnapshot(serialized);
      setSaveStatus('saved');
    } catch (error) {
      if (saveRequestIdRef.current !== requestId) return;
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save node map');
    }
  }, [strategyId, getCurrentNodeMap, isPreviewMode]);

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
          <div className="h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
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
            `}</style>
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
          onClick={() => {
            setNodeTypeSearch('');
            setSelectedNodeTypeCategoryKey(null);
            setIsNodeTypesDrawerOpen(true);
          }}
          className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] z-[230] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl font-light text-zinc-950 shadow-[0_10px_25px_rgba(16,185,129,0.35)]"
          aria-label="Add node"
        >
          +
        </button>
      )}
      </div>

      <AppDrawer
        isOpen={isNodeTypesDrawerOpen}
        onOpenChange={handleNodeTypesDrawerOpenChange}
        title="Add Node"
        height="auto"
        showHeader={false}
      >
        <div className="pb-4" style={safeDrawerInsetStyle}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Add Node</h3>
            <button
              type="button"
              onClick={() => handleNodeTypesDrawerOpenChange(false)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
            >
              Close
            </button>
          </div>

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
                onClick={() => void loadNodeTypes()}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100"
              >
                Retry
              </button>
            </div>
          ) : availableNodeTypes.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-5 text-sm text-zinc-400">
              No node types available.
            </div>
          ) : !selectedNodeTypeCategory ? (
            <div className="max-h-[56vh] space-y-2 overflow-y-auto pr-1">
              {nodeTypeGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => {
                    setSelectedNodeTypeCategoryKey(group.key);
                    setNodeTypeSearch('');
                  }}
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
            <div className="max-h-[56vh] space-y-2 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedNodeTypeCategoryKey(null);
                  setNodeTypeSearch('');
                }}
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
                  onChange={(event) => setNodeTypeSearch(event.target.value)}
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
                    onClick={() => handleAddNodeFromType(item)}
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

      <AppDrawer
        isOpen={isSettingsDrawerOpen}
        onOpenChange={handleSettingsDrawerOpenChange}
        title="Node Settings"
        height="auto"
        showHeader={false}
      >
        <div className="pb-4" style={safeDrawerInsetStyle}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{settingsPanel === 'menu' ? 'Node Settings' : 'Versiones anteriores'}</h3>
            <button
              type="button"
              onClick={() => handleSettingsDrawerOpenChange(false)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
            >
              Close
            </button>
          </div>

          {settingsPanel === 'menu' ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleSaveNodeMap()}
                disabled={saveStatus === 'saving' || isPreviewMode || !hasUnsavedDraftChanges}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left disabled:opacity-50"
              >
                <span className="text-sm font-medium text-zinc-100">Guardar</span>
                <span className="text-xs text-zinc-400">
                  {isPreviewMode
                    ? 'Disabled in preview'
                    : saveStatus === 'saving'
                      ? 'Guardando...'
                      : hasUnsavedDraftChanges
                        ? 'Guardar draft'
                        : 'Sin cambios'}
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
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
                disabled={isPublishingVersion || (isPreviewMode && Boolean(previewVersion?.is_active))}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left disabled:opacity-50"
              >
                <span className="text-sm font-medium text-zinc-100">Activar version</span>
                <span className="text-xs text-zinc-400">
                  {isPublishingVersion
                    ? 'Activando...'
                    : isPreviewMode
                      ? (previewVersion?.is_active ? 'Ya activa' : 'Activar esta versión')
                      : 'Publicar y activar'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettingsPanel('versions');
                  void loadNodeVersions();
                }}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left"
              >
                <span className="text-sm font-medium text-zinc-100">Versiones anteriores</span>
                <span className="text-lg leading-none text-zinc-400">›</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSettingsPanel('menu')}
                className="mb-1 inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
              >
                <BackIcon />
                Menú
              </button>

              {isNodeVersionsLoading ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                  Loading versions...
                </div>
              ) : nodeVersions.length === 0 ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                  No hay versiones anteriores.
                </div>
              ) : (
                <div className="space-y-2">
                  {nodeVersions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => handleEnterPreviewVersion(version)}
                      className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">v{version.version_number} · {version.name}</p>
                        <p className="truncate text-[11px] text-zinc-500">{new Date(version.created_at).toLocaleString('en-US')}</p>
                      </div>
                      {version.is_active && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-medium text-emerald-300">Active</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {nodeVersionsError && (
            <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {nodeVersionsError}
            </div>
          )}
        </div>
      </AppDrawer>

      {typeof window !== 'undefined' && isVersionNameDialogOpen && createPortal(
        <div className="fixed inset-0 z-[10050] pointer-events-none">
          <div className="pointer-events-auto">
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              onClick={() => setIsVersionNameDialogOpen(false)}
              aria-label="Close version name dialog"
            />
            <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="text-sm font-semibold text-white">Activar version</h3>
              <p className="mt-1 text-xs text-zinc-400">Nombre de la nueva versión</p>
              <input
                type="text"
                value={versionNameInput}
                onChange={(event) => setVersionNameInput(event.target.value)}
                className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVersionNameDialogOpen(false)}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const fallback = getNextVersionDefaultName();
                    const chosen = versionNameInput.trim() || fallback;
                    await handlePublishVersion(chosen);
                    setIsVersionNameDialogOpen(false);
                  }}
                  disabled={isPublishingVersion}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                >
                  {isPublishingVersion ? 'Activando...' : 'Activar'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


export default NodesView;

