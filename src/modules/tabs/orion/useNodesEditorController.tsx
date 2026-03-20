/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  Handle,
  Position,
  type Connection,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeProps as RFNodeProps,
  type NodeTypes,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type OrionReferenceSourceItem } from '@/modules/tabs/orion/OrionReferenceDrawer';
import { type StrategySymbolCatalogItem } from '@/modules/tabs/orion/NodeSettingsDrawer';
import { compareNodeCategory, EditorNodeData, EditorNodeField, formatNodeCategoryLabel, NodeTypeCategoryGroup, normalizeNodeCategory } from '@/modules/tabs/orion/nodesEditorTypes';
import {
  buildTimezoneOptions,
  createNodeDefaults,
  type LocalExecutionNodeStatus,
  type LocalExecutionNodeTrace,
  type LocalExecutionStatus,
  type NodeDetailsPanel,
  type NodeDetailsPanelItem,
  type NodeSymbolFilter,
} from '@/modules/tabs/orion/nodesEditorUtils';
import { loadReferenceSourcesForNode as loadReferenceSourcesForNodeAction, runLocalExecution as runLocalExecutionAction } from '@/modules/tabs/orion/nodesEditorExecutionActions';
import {
  activatePreviewVersionAction,
  deleteStrategyAction,
  editPreviewAsDraftAction,
  loadAvailableSymbolsAction,
  loadNodeTypesAction,
  loadNodeVersionsAction,
  loadStrategySymbolsAction,
  publishVersionAction,
  saveStrategySymbolsAction,
} from '@/modules/tabs/orion/nodesEditorDataActions';
import { type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { strategiesService, type StrategyNodeMap, type StrategyNodeVersionRecord, type StrategyTrackedSymbol } from '@/services/StrategiesService';
import { useOrionExecutionStore } from '@/stores/orionExecutionStore';

type ReferenceSourceItem = OrionReferenceSourceItem;

interface UseNodesEditorControllerProps {
  strategyId: string;
  strategyName: string;
  strategyPhotoUrl?: string | null;
  isOwner: boolean;
  onDeleted?: (strategyId: string) => void;
  onClose: () => void;
}

function useNodesEditorController({ strategyId, strategyName, strategyPhotoUrl = null, isOwner, onDeleted, onClose }: UseNodesEditorControllerProps) {
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
  const executionStatusByNodeIdRef = useRef<Record<string, LocalExecutionNodeStatus>>({});

  const nodeTypes = useMemo<NodeTypes>(() => ({
    editorNode: ({ id, data }: RFNodeProps<RFNode<EditorNodeData>>) => {
      const category = normalizeNodeCategory(data?.category);
      const isTrigger = category === 'trigger';
      const isOutput = category === 'output';
      const showLeftHandle = !isTrigger;
      const showRightHandle = !isOutput;
      const executionStatus = executionStatusByNodeIdRef.current[id];
      const executionClassName = executionStatus === 'running'
        ? 'border-blue-400 bg-blue-950/35 shadow-[0_0_0_2px_rgba(59,130,246,0.35)]'
        : executionStatus === 'success'
          ? 'border-emerald-400 bg-emerald-950/30 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]'
          : executionStatus === 'error'
            ? 'border-red-400 bg-red-950/30 shadow-[0_0_0_2px_rgba(239,68,68,0.35)]'
            : 'border-zinc-700 bg-zinc-950';

      return (
        <div
          className={`relative flex min-h-[98px] min-w-[126px] flex-col items-center justify-center gap-2 border px-3 py-3 text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${executionClassName} ${isTrigger ? 'rounded-[24px] rounded-l-[34px]' : isOutput ? 'rounded-[24px] rounded-r-[34px]' : 'rounded-[24px]'}`}
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
  const [nodeEditorNodeId, setNodeEditorNodeId] = useState<string | null>(null);
  const [nodeDetailsPanel, setNodeDetailsPanel] = useState<NodeDetailsPanel>('inputs');
  const [isNodeMapLoading, setIsNodeMapLoading] = useState(true);
  const [nodeMapError, setNodeMapError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nodeVersions, setNodeVersions] = useState<StrategyNodeVersionRecord[]>([]);
  const [isNodeVersionsLoading, setIsNodeVersionsLoading] = useState(false);
  const [nodeVersionsError, setNodeVersionsError] = useState<string | null>(null);
  const [isPublishingVersion, setIsPublishingVersion] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<'menu' | 'versions' | 'symbols' | 'symbols-library' | 'danger'>('menu');
  const [isVersionNameDialogOpen, setIsVersionNameDialogOpen] = useState(false);
  const [isDeleteSelectionDialogOpen, setIsDeleteSelectionDialogOpen] = useState(false);
  const [isDeleteStrategyDialogOpen, setIsDeleteStrategyDialogOpen] = useState(false);
  const [deleteStrategyConfirmInput, setDeleteStrategyConfirmInput] = useState('');
  const [isDeletingStrategy, setIsDeletingStrategy] = useState(false);
  const [deleteStrategyError, setDeleteStrategyError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [trackedSymbols, setTrackedSymbols] = useState<StrategyTrackedSymbol[]>([]);
  const [availableSymbols, setAvailableSymbols] = useState<StrategySymbolCatalogItem[]>([]);
  const [isSymbolsLoading, setIsSymbolsLoading] = useState(false);
  const [isSymbolsSaving, setIsSymbolsSaving] = useState(false);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const [versionNameInput, setVersionNameInput] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [previewVersion, setPreviewVersion] = useState<StrategyNodeVersionRecord | null>(null);
  const [localExecutionStatus, setLocalExecutionStatus] = useState<LocalExecutionStatus>('idle');
  const [localExecutionTraces, setLocalExecutionTraces] = useState<LocalExecutionNodeTrace[]>([]);
  const [localExecutionError, setLocalExecutionError] = useState<string | null>(null);
  const [isExecutionSymbolDrawerOpen, setIsExecutionSymbolDrawerOpen] = useState(false);
  const [executionSymbolSearch, setExecutionSymbolSearch] = useState('');
  const [executionSymbolFilter, setExecutionSymbolFilter] = useState<NodeSymbolFilter>('ALL');
  const [isReferenceDrawerOpen, setIsReferenceDrawerOpen] = useState(false);
  const [referenceFieldIndex, setReferenceFieldIndex] = useState<number | null>(null);
  const [referenceSearch, setReferenceSearch] = useState('');
  const [isReferenceSourcesLoading, setIsReferenceSourcesLoading] = useState(false);
  const [referenceSourcesError, setReferenceSourcesError] = useState<string | null>(null);
  const [referenceSourcesByNodeId, setReferenceSourcesByNodeId] = useState<Record<string, ReferenceSourceItem[]>>({});
  const [isUpstreamExecutingForNode, setIsUpstreamExecutingForNode] = useState(false);
  const hasHydratedNodeMapRef = useRef(false);
  const lastSavedNodeMapRef = useRef('');
  const [lastSavedNodeMapSnapshot, setLastSavedNodeMapSnapshot] = useState('');
  const saveRequestIdRef = useRef(0);
  const draftBeforePreviewRef = useRef<StrategyNodeMap | null>(null);
  const lastNodeTapRef = useRef<{ id: string; at: number } | null>(null);

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
  const strategyInitials = useMemo(
    () =>
      strategyName
        .split(' ')
        .map((word) => word[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [strategyName]
  );
  const selectedExecutionTicker = useOrionExecutionStore((state) => state.selectedSymbolByStrategyId[strategyId] ?? '');
  const setSymbolForStrategy = useOrionExecutionStore((state) => state.setSymbolForStrategy);
  const clearSymbolForStrategy = useOrionExecutionStore((state) => state.clearSymbolForStrategy);
  const selectedExecutionSymbol = useMemo(
    () => trackedSymbols.find((item) => item.ticker.toUpperCase() === selectedExecutionTicker.toUpperCase()) ?? null,
    [trackedSymbols, selectedExecutionTicker]
  );
  const filteredExecutionSymbols = useMemo(() => {
    const query = executionSymbolSearch.trim().toLowerCase();
    return trackedSymbols.filter((item) => {
      if (executionSymbolFilter !== 'ALL' && item.market !== executionSymbolFilter) return false;
      if (!query) return true;
      return item.ticker.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    });
  }, [executionSymbolFilter, executionSymbolSearch, trackedSymbols]);
  const isPreviewMode = previewVersion !== null;
  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;
  const selectedNodeForEditor = useMemo(
    () => (nodeEditorNodeId ? nodes.find((node) => node.id === nodeEditorNodeId) ?? null : null),
    [nodeEditorNodeId, nodes]
  );

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
      const items = await loadNodeTypesAction();
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

  const loadStrategySymbols = useCallback(async () => {
    setSymbolsError(null);
    try {
      const hydrated = await loadStrategySymbolsAction(strategyId);
      setTrackedSymbols(hydrated as StrategyTrackedSymbol[]);
    } catch (error) {
      setSymbolsError(error instanceof Error ? error.message : 'Failed to load strategy symbols');
    }
  }, [strategyId]);

  const loadAvailableSymbols = useCallback(async () => {
    setIsSymbolsLoading(true);
    setSymbolsError(null);
    try {
      const mapped = await loadAvailableSymbolsAction();
      setAvailableSymbols(mapped);
    } catch (error) {
      setSymbolsError(error instanceof Error ? error.message : 'Failed to load symbols catalog');
    } finally {
      setIsSymbolsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStrategySymbols();
  }, [loadStrategySymbols]);

  useEffect(() => {
    if (trackedSymbols.length === 0) {
      clearSymbolForStrategy(strategyId);
      return;
    }

    const hasPersisted = trackedSymbols.some((item) => item.ticker.toUpperCase() === selectedExecutionTicker.toUpperCase());
    if (!hasPersisted) {
      setSymbolForStrategy(strategyId, trackedSymbols[0]?.ticker ?? '');
    }
  }, [clearSymbolForStrategy, selectedExecutionTicker, setSymbolForStrategy, strategyId, trackedSymbols]);

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
    if (!nodeEditorNodeId) return;
    const exists = nodes.some((node) => node.id === nodeEditorNodeId);
    if (!exists) {
      setNodeEditorNodeId(null);
    }
  }, [nodeEditorNodeId, nodes]);

  useEffect(() => {
    if (!selectedNodeForEditor) {
      setIsReferenceDrawerOpen(false);
      setReferenceFieldIndex(null);
      setReferenceSearch('');
      setReferenceSourcesError(null);
    }
  }, [selectedNodeForEditor]);

  useEffect(() => {
    const validIds = new Set(nodes.map((node) => node.id));
    const next: Record<string, LocalExecutionNodeStatus> = {};
    for (const [nodeId, status] of Object.entries(executionStatusByNodeIdRef.current)) {
      if (validIds.has(nodeId)) next[nodeId] = status;
    }
    executionStatusByNodeIdRef.current = next;
  }, [nodes]);

  useEffect(() => {
    if (availableNodeTypes.length === 0) return;

    const byKey = new Map<string, StrategyNodeTypeRecord>();
    for (const nodeType of availableNodeTypes) {
      byKey.set(nodeType.key, nodeType);
    }

    setNodes((prev) => {
      let changed = false;
      const next = prev.map((node) => {
        const data = (node.data ?? {}) as EditorNodeData;
        if (!data.nodeTypeKey) return node;

        const nodeType = byKey.get(data.nodeTypeKey);
        if (!nodeType) return node;

        const defaults = createNodeDefaults(nodeType);
        const currentInputs = Array.isArray(data.inputs) ? data.inputs : [];
        const currentAttributes = Array.isArray(data.attributes) ? data.attributes : [];
        const currentOutputs = Array.isArray(data.outputs) ? data.outputs : [];

        const shouldHydrateInputs = currentInputs.length === 0 && defaults.inputs.length > 0;
        const shouldHydrateAttributes = currentAttributes.length === 0 && defaults.attributes.length > 0;
        const shouldHydrateOutputs = currentOutputs.length === 0 && defaults.outputs.length > 0;

        if (!shouldHydrateInputs && !shouldHydrateAttributes && !shouldHydrateOutputs) {
          return node;
        }

        changed = true;
        return {
          ...node,
          data: {
            ...data,
            ...(shouldHydrateInputs ? { inputs: defaults.inputs } : {}),
            ...(shouldHydrateAttributes ? { attributes: defaults.attributes } : {}),
            ...(shouldHydrateOutputs ? { outputs: defaults.outputs } : {}),
          } satisfies EditorNodeData,
        };
      });

      return changed ? next : prev;
    });
  }, [availableNodeTypes, setNodes]);

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
          nodeTypeVersion: nodeType.version,
          category: nodeType.category,
          iconUrl: nodeType.icon_url,
          ...createNodeDefaults(nodeType),
        } satisfies EditorNodeData,
      };

      return [...prev, nextNode];
    });
    setIsNodeTypesDrawerOpen(false);
  }, [setNodes]);

  const handleNodeTypesDrawerOpenChange = useCallback((open: boolean) => {
    setIsNodeTypesDrawerOpen(open);
  }, []);

  const openNodeEditor = useCallback((nodeId: string) => {
    setNodeEditorNodeId(nodeId);
    setNodeDetailsPanel('attributes');
  }, []);

  const handleNodeClick = useCallback((_event: unknown, node: RFNode) => {
    const now = Date.now();
    const prev = lastNodeTapRef.current;
    if (prev && prev.id === node.id && now - prev.at < 300) {
      openNodeEditor(node.id);
      lastNodeTapRef.current = null;
      return;
    }
    lastNodeTapRef.current = { id: node.id, at: now };
  }, [openNodeEditor]);

  const updateNodePanelFields = useCallback((nodeId: string, panel: NodeDetailsPanel, updater: (prev: EditorNodeField[]) => EditorNodeField[]) => {
    setNodes((prev) => prev.map((node) => {
      if (node.id !== nodeId) return node;
      const data = (node.data ?? {}) as EditorNodeData;
      const current = Array.isArray(data[panel]) ? (data[panel] as EditorNodeField[]) : [];
      return {
        ...node,
        data: {
          ...data,
          [panel]: updater(current),
        } satisfies EditorNodeData,
      };
    }));
  }, [setNodes]);

  const loadReferenceSourcesForNode = useCallback(async (targetNodeId: string): Promise<ReferenceSourceItem[]> => {
    return loadReferenceSourcesForNodeAction({
      targetNodeId,
      strategyId,
      nodes,
      edges,
      selectedExecutionTicker,
      selectedExecutionSymbol: selectedExecutionSymbol
        ? {
          ticker: selectedExecutionSymbol.ticker,
          name: selectedExecutionSymbol.name,
          market: selectedExecutionSymbol.market,
        }
        : null,
    }) as Promise<ReferenceSourceItem[]>;
  }, [edges, nodes, selectedExecutionSymbol, selectedExecutionTicker, strategyId]);

  const runUpstreamExecutionForEditor = useCallback(async () => {
    if (!selectedNodeForEditor) return;
    setIsUpstreamExecutingForNode(true);
    setIsReferenceSourcesLoading(true);
    setReferenceSourcesError(null);
    try {
      const items = await loadReferenceSourcesForNode(selectedNodeForEditor.id);
      setReferenceSourcesByNodeId((prev) => ({ ...prev, [selectedNodeForEditor.id]: items }));
      if (items.length === 0) {
        setReferenceSourcesError('No previous node outputs available for this node.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run upstream nodes';
      setReferenceSourcesError(message);
    } finally {
      setIsUpstreamExecutingForNode(false);
      setIsReferenceSourcesLoading(false);
    }
  }, [loadReferenceSourcesForNode, selectedNodeForEditor]);

  const openReferenceDrawer = useCallback((fieldIndex: number) => {
    if (!selectedNodeForEditor) return;
    setReferenceFieldIndex(fieldIndex);
    setReferenceSearch('');
    setReferenceSourcesError(null);
    setIsReferenceDrawerOpen(true);
  }, [selectedNodeForEditor]);

  const runLocalExecution = useCallback(async () => {
    await runLocalExecutionAction({
      strategyId,
      nodes,
      edges,
      localExecutionStatus,
      selectedExecutionTicker,
      selectedExecutionSymbol: selectedExecutionSymbol
        ? {
          ticker: selectedExecutionSymbol.ticker,
          name: selectedExecutionSymbol.name,
          market: selectedExecutionSymbol.market,
        }
        : null,
      onStatusChange: (status) => setLocalExecutionStatus(status),
      onErrorChange: setLocalExecutionError,
      onTracesChange: setLocalExecutionTraces,
      onExecutionStatusByNodeChange: (byNode) => {
        executionStatusByNodeIdRef.current = byNode;
      },
    });
  }, [edges, localExecutionStatus, nodes, selectedExecutionSymbol, selectedExecutionTicker, strategyId]);

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

  const handleConfirmDeleteStrategy = useCallback(async () => {
    if (!isOwner || isDeletingStrategy) return;
    if (deleteStrategyConfirmInput.trim() !== strategyName) {
      setDeleteStrategyError('Type the exact strategy name to confirm.');
      return;
    }

    setIsDeletingStrategy(true);
    setDeleteStrategyError(null);
    try {
      await deleteStrategyAction(strategyId);
      onDeleted?.(strategyId);
      setIsDeleteStrategyDialogOpen(false);
      onClose();
    } catch (error) {
      setDeleteStrategyError(error instanceof Error ? error.message : 'Failed to delete strategy');
    } finally {
      setIsDeletingStrategy(false);
    }
  }, [deleteStrategyConfirmInput, isDeletingStrategy, isOwner, onClose, onDeleted, strategyId, strategyName]);

  const handleToggleSymbol = useCallback(async (symbol: StrategySymbolCatalogItem | StrategyTrackedSymbol) => {
    if (!isOwner || isSymbolsSaving) return;

    const ticker = symbol.ticker.toUpperCase();
    const nextCandidate: StrategyTrackedSymbol = {
      ticker,
      name: symbol.name || ticker,
      icon_url: symbol.icon_url ?? null,
      market: symbol.market === 'FOREX' || symbol.market === 'CRYPTO' ? symbol.market : 'STOCKS',
    };

    const previous = trackedSymbols;
    const exists = previous.some((item) => item.ticker.toUpperCase() === ticker);
    const next = exists
      ? previous.filter((item) => item.ticker.toUpperCase() !== ticker)
      : [...previous, nextCandidate];

    setTrackedSymbols(next);
    setIsSymbolsSaving(true);
    setSymbolsError(null);

    try {
      await saveStrategySymbolsAction(strategyId, next);
    } catch (error) {
      setTrackedSymbols(previous);
      setSymbolsError(error instanceof Error ? error.message : 'Failed to save strategy symbols');
    } finally {
      setIsSymbolsSaving(false);
    }
  }, [isOwner, isSymbolsSaving, strategyId, trackedSymbols]);

  const getNextVersionDefaultName = useCallback(() => {
    const maxVersion = nodeVersions.reduce((max, item) => Math.max(max, item.version_number), 0);
    return `v${maxVersion + 1}`;
  }, [nodeVersions]);

  const loadNodeVersions = useCallback(async () => {
    setIsNodeVersionsLoading(true);
    setNodeVersionsError(null);
    try {
      const rows = await loadNodeVersionsAction(strategyId);
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
      const created = await publishVersionAction({ strategyId, draftPayload, versionName });
      const serialized = JSON.stringify(draftPayload);
      lastSavedNodeMapRef.current = serialized;
      setLastSavedNodeMapSnapshot(serialized);
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
      await editPreviewAsDraftAction(strategyId, draftPayload);
      const serialized = JSON.stringify(draftPayload);
      lastSavedNodeMapRef.current = serialized;
      setLastSavedNodeMapSnapshot(serialized);
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
      await activatePreviewVersionAction(strategyId, previewVersion.id);
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

  const nodeEditorData = selectedNodeForEditor?.data as EditorNodeData | undefined;
  const timezoneOptions = useMemo(() => buildTimezoneOptions(), []);
  const selectedNodeExecutionTrace = selectedNodeForEditor
    ? localExecutionTraces.find((item) => item.nodeId === selectedNodeForEditor.id) ?? null
    : null;
  const nodeDetailsPanelItems = useMemo<NodeDetailsPanelItem[]>(() => {
    const category = normalizeNodeCategory(nodeEditorData?.category);
    const baseItems: NodeDetailsPanelItem[] = [];

    if (category === 'trigger') {
      baseItems.push(
        { key: 'attributes', label: 'Attributes' },
        { key: 'outputs', label: 'Result' },
      );
    } else if (category === 'output') {
      baseItems.push(
        { key: 'inputs', label: 'Inputs' },
        { key: 'attributes', label: 'Attributes' },
        { key: 'outputs', label: 'Result' },
      );
    } else {
      baseItems.push(
        { key: 'inputs', label: 'Inputs' },
        { key: 'attributes', label: 'Attributes' },
        { key: 'outputs', label: 'Result' },
      );
    }

    return baseItems;
  }, [nodeEditorData?.category]);

  useEffect(() => {
    if (nodeDetailsPanelItems.some((item) => item.key === nodeDetailsPanel)) return;
    setNodeDetailsPanel(nodeDetailsPanelItems[0]?.key ?? 'inputs');
  }, [nodeDetailsPanel, nodeDetailsPanelItems]);

  const panelFields = nodeEditorData
    ? (Array.isArray(nodeEditorData[nodeDetailsPanel]) ? nodeEditorData[nodeDetailsPanel] as EditorNodeField[] : [])
    : [];
  const activeReferenceField = useMemo(
    () => (referenceFieldIndex === null ? null : panelFields[referenceFieldIndex] ?? null),
    [panelFields, referenceFieldIndex]
  );
  const currentNodeReferenceSources = useMemo(
    () => (selectedNodeForEditor ? (referenceSourcesByNodeId[selectedNodeForEditor.id] ?? []) : []),
    [referenceSourcesByNodeId, selectedNodeForEditor]
  );
  const filteredReferenceSources = useMemo(() => {
    const query = referenceSearch.trim().toLowerCase();
    if (!query) return currentNodeReferenceSources;
    return currentNodeReferenceSources.filter((item) => (
      item.nodeId.toLowerCase().includes(query) ||
      item.label.toLowerCase().includes(query) ||
      item.nodeTypeKey.toLowerCase().includes(query) ||
      item.dataType.toLowerCase().includes(query)
    ));
  }, [currentNodeReferenceSources, referenceSearch]);

  const setSelectedNodeAttributeValue = useCallback((index: number, value: string) => {
    if (!selectedNodeForEditor) return;
    updateNodePanelFields(selectedNodeForEditor.id, 'attributes', (prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value };
      return next;
    });
  }, [selectedNodeForEditor, updateNodePanelFields]);

  const toggleSelectedNodeAttributeOption = useCallback((index: number, optionValue: string) => {
    if (!selectedNodeForEditor) return;
    updateNodePanelFields(selectedNodeForEditor.id, 'attributes', (prev) => {
      const next = [...prev];
      const currentValues = (next[index]?.value || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      const nextValues = currentValues.includes(optionValue)
        ? currentValues.filter((item) => item !== optionValue)
        : [...currentValues, optionValue];
      next[index] = { ...next[index], value: nextValues.join(',') };
      return next;
    });
  }, [selectedNodeForEditor, updateNodePanelFields]);

  const openAttributeReferenceDrawer = useCallback((index: number) => {
    void openReferenceDrawer(index);
  }, [openReferenceDrawer]);

  const clearSelectedNodeAttributeReference = useCallback((index: number) => {
    if (!selectedNodeForEditor) return;
    updateNodePanelFields(selectedNodeForEditor.id, 'attributes', (prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value: '' };
      return next;
    });
  }, [selectedNodeForEditor, updateNodePanelFields]);

  return {
        strategyName,
        strategyPhotoUrl,
        strategyInitials,
        subtitle: isNodeMapLoading
          ? 'Loading map...'
          : isPreviewMode
            ? `Preview · v${previewVersion.version_number} ${previewVersion.name}`
            : saveStatus === 'saving'
              ? `Draft · Saving...${activeNodeVersion ? ` · Active v${activeNodeVersion.version_number}` : ''}`
              : saveStatus === 'saved'
                ? `Draft · Saved${activeNodeVersion ? ` · Active v${activeNodeVersion.version_number}` : ''}`
                : saveStatus === 'error'
                  ? 'Draft · Save error'
                  : `Draft${activeNodeVersion ? ` · Active v${activeNodeVersion.version_number}` : ''}`,
        executionStatusText: localExecutionStatus === 'idle'
          ? null
          : localExecutionStatus === 'running'
            ? 'Execution · Running'
            : localExecutionStatus === 'completed'
              ? 'Execution · Completed'
              : `Execution · Failed${localExecutionError ? ` · ${localExecutionError}` : ''}`,
        executionStatusTone: localExecutionStatus === 'idle'
          ? null
          : localExecutionStatus === 'running'
            ? 'running'
            : localExecutionStatus === 'completed'
              ? 'completed'
              : 'failed',
        safeHorizontalInsetStyle,
        safeCanvasInsetStyle,
        onClose,
        onOpenSettings: () => {
          setSettingsPanel('menu');
          setIsSettingsDrawerOpen(true);
        },
        nodeMapError,
        saveError,
        selectedNodeForEditor,
        nodeEditorData,
        isPreviewMode,
        isUpstreamExecutingForNode,
        onBackFromNodeEditor: () => setNodeEditorNodeId(null),
        onRunUpstream: () => { void runUpstreamExecutionForEditor(); },
        nodeDetailsPanel,
        nodeDetailsPanelItems,
        onNodeDetailsPanelChange: setNodeDetailsPanel,
        panelFields,
        timezoneOptions,
        onSetAttributeFieldValue: setSelectedNodeAttributeValue,
        onToggleAttributeMultiOption: toggleSelectedNodeAttributeOption,
        onOpenReference: openAttributeReferenceDrawer,
        onClearReference: clearSelectedNodeAttributeReference,
        selectedNodeExecutionTrace,
        nodes,
        edges,
        nodeTypes,
        hasSelection,
        selectedExecutionSymbol,
        trackedSymbolsCount: trackedSymbols.length,
        onNodesChange: isPreviewMode ? undefined : onNodesChange,
        onEdgesChange: isPreviewMode ? undefined : onEdgesChange,
        onConnect: isPreviewMode ? undefined : onConnect,
        onNodeClick: isPreviewMode ? undefined : handleNodeClick,
        onNodeDoubleClick: isPreviewMode ? undefined : (_event: unknown, node: RFNode) => openNodeEditor(node.id),
        onSelectionChange: isPreviewMode ? undefined : handleSelectionChange,
        onOpenExecutionSymbolDrawer: () => setIsExecutionSymbolDrawerOpen(true),
        onDeleteSelectionRequest: () => setIsDeleteSelectionDialogOpen(true),
        onEditPreviewAsDraft: () => { void handleEditPreviewAsDraft(); },
        onRunLocalExecution: () => { void runLocalExecution(); },
        isLocalExecutionRunning: localExecutionStatus === 'running',
        selectedExecutionTicker,
        onOpenNodeTypesDrawer: () => setIsNodeTypesDrawerOpen(true),
        isExecutionSymbolDrawerOpen,
        onExecutionSymbolDrawerOpenChange: (open: boolean) => {
          setIsExecutionSymbolDrawerOpen(open);
          if (!open) {
            setExecutionSymbolSearch('');
            setExecutionSymbolFilter('ALL');
          }
        },
        executionSymbolSearch,
        onExecutionSymbolSearchChange: setExecutionSymbolSearch,
        executionSymbolFilter,
        onExecutionSymbolFilterChange: (value: NodeSymbolFilter) => setExecutionSymbolFilter(value as NodeSymbolFilter),
        trackedSymbols,
        filteredExecutionSymbols,
        onSelectExecutionSymbol: (ticker: string) => {
          setSymbolForStrategy(strategyId, ticker);
          setIsExecutionSymbolDrawerOpen(false);
        },
        isReferenceDrawerOpen,
        onReferenceDrawerOpenChange: (open: boolean) => {
          setIsReferenceDrawerOpen(open);
          if (!open) {
            setReferenceSearch('');
            setReferenceSourcesError(null);
          }
        },
        activeReferenceFieldName: activeReferenceField?.name || activeReferenceField?.key || 'Attribute',
        referenceSearch,
        onReferenceSearchChange: setReferenceSearch,
        isReferenceSourcesLoading,
        referenceSourcesError,
        currentNodeReferenceSourcesCount: currentNodeReferenceSources.length,
        onRunUpstreamNow: () => { void runUpstreamExecutionForEditor(); },
        filteredReferenceSources,
        onPickReference: (token: string) => {
          if (!selectedNodeForEditor || referenceFieldIndex === null) return;
          updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => {
            const next = [...prev];
            next[referenceFieldIndex] = { ...next[referenceFieldIndex], value: token };
            return next;
          });
          setIsReferenceDrawerOpen(false);
        },
        isNodeTypesDrawerOpen,
        onNodeTypesDrawerOpenChange: handleNodeTypesDrawerOpenChange,
        isNodeTypesLoading,
        nodeTypesError,
        availableNodeTypes,
        nodeTypeGroups,
        onRetryLoadNodeTypes: () => { void loadNodeTypes(); },
        onAddNodeFromType: handleAddNodeFromType,
        isSettingsDrawerOpen,
        onSettingsDrawerOpenChange: handleSettingsDrawerOpenChange,
        settingsPanel,
        onSettingsPanelChange: setSettingsPanel,
        isPublishingVersion,
        previewVersion,
        onActivateButtonClick: async () => {
          if (isPreviewMode) {
            await handleActivatePreviewVersion();
            return;
          }
          if (!isNodeVersionsLoading && nodeVersions.length === 0) {
            await loadNodeVersions();
          }
          setVersionNameInput(getNextVersionDefaultName());
          setIsVersionNameDialogOpen(true);
        },
        onOpenVersions: () => {
          setSettingsPanel('versions');
          void loadNodeVersions();
        },
        isNodeVersionsLoading,
        nodeVersions,
        onEnterPreviewVersion: handleEnterPreviewVersion,
        nodeVersionsError,
        isLive,
        onToggleLive: () => setIsLive((prev) => !prev),
        onOpenBacktesting: () => {
          setIsSettingsDrawerOpen(false);
          void runLocalExecution();
        },
        isOwner,
        availableSymbols,
        isSymbolsLoading,
        isSymbolsSaving,
        symbolsError,
        onOpenSymbols: () => {
          setSettingsPanel('symbols');
        },
        onOpenSymbolsLibrary: () => {
          setSettingsPanel('symbols-library');
          if (availableSymbols.length === 0) {
            void loadAvailableSymbols();
          }
        },
        onRetryLoadSymbols: () => { void loadAvailableSymbols(); },
        onToggleSymbol: (symbol: StrategySymbolCatalogItem | StrategyTrackedSymbol) => {
          void handleToggleSymbol(symbol);
        },
        isDeletingStrategy,
        onDeleteStrategyRequest: () => {
          setDeleteStrategyConfirmInput('');
          setDeleteStrategyError(null);
          setIsDeleteStrategyDialogOpen(true);
        },
        isVersionNameDialogOpen,
        versionNameInput,
        onVersionNameInputChange: setVersionNameInput,
        onCloseVersionNameDialog: () => setIsVersionNameDialogOpen(false),
        onConfirmVersionNameDialog: async () => {
          const fallback = getNextVersionDefaultName();
          const chosen = versionNameInput.trim() || fallback;
          await handlePublishVersion(chosen);
          setIsVersionNameDialogOpen(false);
        },
        isDeleteSelectionDialogOpen,
        onCloseDeleteSelectionDialog: () => setIsDeleteSelectionDialogOpen(false),
        onConfirmDeleteSelection: handleDeleteSelection,
        isDeleteStrategyDialogOpen,
        deleteStrategyConfirmInput,
        deleteStrategyError,
        onDeleteStrategyConfirmInputChange: setDeleteStrategyConfirmInput,
        onCloseDeleteStrategyDialog: () => setIsDeleteStrategyDialogOpen(false),
        onConfirmDeleteStrategy: () => { void handleConfirmDeleteStrategy(); },
  };
}


export default useNodesEditorController;
