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
import { NodeSettingsDrawer, type StrategySymbolCatalogItem, VersionNameDialog } from '@/modules/tabs/orion/NodeSettingsDrawer';
import { compareNodeCategory, EditorNodeData, EditorNodeField, formatNodeCategoryLabel, NodeTypeCategoryGroup, normalizeNodeCategory } from '@/modules/tabs/orion/nodesEditorTypes';
import dataService from '@/services/DataService';
import { strategyNodeTypesService, type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { strategiesService, type StrategyNodeMap, type StrategyNodeVersionRecord, type StrategyTrackedSymbol } from '@/services/StrategiesService';

function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

type NodeDetailsPanel = 'inputs' | 'attributes' | 'outputs';

function makeFieldId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createNodeDefaults(category?: string): Pick<EditorNodeData, 'inputs' | 'attributes' | 'outputs'> {
  const normalized = normalizeNodeCategory(category);

  if (normalized === 'trigger') {
    return {
      inputs: [],
      attributes: [
        { id: makeFieldId('attr'), name: 'schedule', type: 'cron', value: '' },
      ],
      outputs: [
        { id: makeFieldId('out'), name: 'event', type: 'signal' },
      ],
    };
  }

  if (normalized === 'output') {
    return {
      inputs: [
        { id: makeFieldId('in'), name: 'signal', type: 'signal', required: true },
      ],
      attributes: [
        { id: makeFieldId('attr'), name: 'channel', type: 'string', value: '' },
      ],
      outputs: [],
    };
  }

  return {
    inputs: [
      { id: makeFieldId('in'), name: 'input', type: 'number', required: true },
    ],
    attributes: [
      { id: makeFieldId('attr'), name: 'operator', type: 'string', value: '' },
    ],
    outputs: [
      { id: makeFieldId('out'), name: 'result', type: 'number' },
    ],
  };
}
interface NodesViewProps {
  strategyId: string;
  strategyName: string;
  strategyPhotoUrl?: string | null;
  isOwner: boolean;
  onDeleted?: (strategyId: string) => void;
  onClose: () => void;
}

function NodesView({ strategyId, strategyName, strategyPhotoUrl = null, isOwner, onDeleted, onClose }: NodesViewProps) {
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

  const loadStrategySymbols = useCallback(async () => {
    setSymbolsError(null);
    try {
      const [rows, catalog] = await Promise.all([
        strategiesService.getStrategySymbols(strategyId),
        dataService.loadSymbols(),
      ]);
      const iconByTicker = new Map<string, string | null>();
      for (const item of catalog) {
        const ticker = String(item.symbol ?? '').toUpperCase();
        if (!ticker) continue;
        iconByTicker.set(ticker, item.icon_url ?? item.photo ?? null);
      }
      const hydrated = rows.map((item) => ({
        ...item,
        icon_url: item.icon_url ?? iconByTicker.get(item.ticker.toUpperCase()) ?? null,
      }));
      setTrackedSymbols(hydrated);
    } catch (error) {
      setSymbolsError(error instanceof Error ? error.message : 'Failed to load strategy symbols');
    }
  }, [strategyId]);

  const loadAvailableSymbols = useCallback(async () => {
    setIsSymbolsLoading(true);
    setSymbolsError(null);
    try {
      const rows = await dataService.loadSymbols();
      const mapped: StrategySymbolCatalogItem[] = rows.map((item) => ({
        ticker: String(item.symbol ?? '').toUpperCase(),
        name: item.name ?? String(item.symbol ?? '').toUpperCase(),
        icon_url: item.icon_url ?? (item.photo?.startsWith('blob:') ? null : (item.photo ?? null)),
        market: item.type === 'FOREX' || item.type === 'CRYPTO' ? item.type : 'STOCKS',
      })).filter((item) => item.ticker.length > 0);
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
          ...createNodeDefaults(nodeType.category),
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
    setNodeDetailsPanel('inputs');
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
      await strategiesService.deleteStrategy(strategyId);
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
      await strategiesService.saveStrategySymbols(strategyId, next);
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

  const nodeEditorData = selectedNodeForEditor?.data as EditorNodeData | undefined;
  const panelFields = nodeEditorData
    ? (Array.isArray(nodeEditorData[nodeDetailsPanel]) ? nodeEditorData[nodeDetailsPanel] as EditorNodeField[] : [])
    : [];

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
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
              {strategyPhotoUrl ? (
                <img src={strategyPhotoUrl} alt={strategyName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-300">
                  {strategyInitials || 'ST'}
                </div>
              )}
            </div>
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
          {selectedNodeForEditor ? (
            <div className="h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="flex items-center border-b border-zinc-800 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setNodeEditorNodeId(null)}
                  className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300"
                >
                  Back
                </button>
                <div className="ml-2 min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{nodeEditorData?.label ?? 'Node'}</p>
                  <p className="truncate text-[11px] text-zinc-500">{nodeEditorData?.nodeTypeKey ?? 'custom-node'}</p>
                </div>
              </div>
              <div className="flex gap-2 border-b border-zinc-800 px-3 py-2">
                {([
                  { key: 'inputs', label: 'Inputs' },
                  { key: 'attributes', label: 'Atributos' },
                  { key: 'outputs', label: 'Outputs' },
                ] as Array<{ key: NodeDetailsPanel; label: string }>).map((item) => {
                  const active = nodeDetailsPanel === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setNodeDetailsPanel(item.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-300'}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="h-[calc(100%-92px)] overflow-y-auto px-3 py-3">
                <div className="space-y-2">
                  {panelFields.length === 0 ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-zinc-500">
                      No items yet in this panel.
                    </div>
                  ) : (
                    panelFields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            type="text"
                            value={field.name}
                            readOnly={isPreviewMode}
                            onChange={(event) => updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], name: event.target.value };
                              return next;
                            })}
                            placeholder="Field name"
                            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                          />
                          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                            <input
                              type="text"
                              value={field.type}
                              readOnly={isPreviewMode}
                              onChange={(event) => updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], type: event.target.value };
                                return next;
                              })}
                              placeholder="Type"
                              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                            />
                            <button
                              type="button"
                              disabled={isPreviewMode}
                              onClick={() => updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], required: !next[index]?.required };
                                return next;
                              })}
                              className={`rounded-md border px-2 py-1 text-[11px] ${field.required ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300'} disabled:opacity-60`}
                            >
                              Req
                            </button>
                            <button
                              type="button"
                              disabled={isPreviewMode}
                              onClick={() => updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => prev.filter((item) => item.id !== field.id))}
                              className="rounded-md border border-red-900 bg-red-950/30 px-2 py-1 text-[11px] text-red-300 disabled:opacity-60"
                            >
                              Del
                            </button>
                          </div>
                          <input
                            type="text"
                            value={field.value ?? ''}
                            readOnly={isPreviewMode}
                            onChange={(event) => updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], value: event.target.value };
                              return next;
                            })}
                            placeholder="Default value"
                            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                          />
                        </div>
                      </div>
                    ))
                  )}
                  {!isPreviewMode && (
                    <button
                      type="button"
                      onClick={() => updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => [
                        ...prev,
                        { id: makeFieldId('field'), name: '', type: 'string', value: '', required: false },
                      ])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    >
                      Add {nodeDetailsPanel.slice(0, 1).toUpperCase() + nodeDetailsPanel.slice(1, -1)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={isPreviewMode ? undefined : onNodesChange}
                onEdgesChange={isPreviewMode ? undefined : onEdgesChange}
                onConnect={isPreviewMode ? undefined : onConnect}
                onNodeClick={isPreviewMode ? undefined : handleNodeClick}
                onNodeDoubleClick={isPreviewMode ? undefined : (_event, node) => openNodeEditor(node.id)}
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
          )}
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
      ) : !selectedNodeForEditor ? (
        <button
          type="button"
          onClick={() => setIsNodeTypesDrawerOpen(true)}
          className="absolute bottom-[max(40px,env(safe-area-inset-bottom))] right-[max(28px,env(safe-area-inset-right))] z-[230] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl font-light text-zinc-950 shadow-[0_10px_25px_rgba(16,185,129,0.35)]"
          aria-label="Add node"
        >
          +
        </button>
      ) : null}
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
        isLive={isLive}
        onToggleLive={() => setIsLive((prev) => !prev)}
        onOpenBacktesting={() => {
          setIsSettingsDrawerOpen(false);
        }}
        isOwner={isOwner}
        trackedSymbols={trackedSymbols}
        availableSymbols={availableSymbols}
        isSymbolsLoading={isSymbolsLoading}
        isSymbolsSaving={isSymbolsSaving}
        symbolsError={symbolsError}
        onOpenSymbols={() => {
          setSettingsPanel('symbols');
        }}
        onOpenSymbolsLibrary={() => {
          setSettingsPanel('symbols-library');
          if (availableSymbols.length === 0) {
            void loadAvailableSymbols();
          }
        }}
        onRetryLoadSymbols={() => void loadAvailableSymbols()}
        onToggleSymbol={(symbol) => {
          void handleToggleSymbol(symbol);
        }}
        strategyName={strategyName}
        isDeletingStrategy={isDeletingStrategy}
        onDeleteStrategyRequest={() => {
          setDeleteStrategyConfirmInput('');
          setDeleteStrategyError(null);
          setIsDeleteStrategyDialogOpen(true);
        }}
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

      {typeof window !== 'undefined' && isDeleteStrategyDialogOpen && createPortal(
        <div className="fixed inset-0 z-[10060] pointer-events-none">
          <div className="pointer-events-auto">
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              onClick={() => {
                if (isDeletingStrategy) return;
                setIsDeleteStrategyDialogOpen(false);
              }}
              aria-label="Close delete strategy dialog"
            />
            <div className="absolute left-1/2 top-1/2 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-red-900 bg-zinc-950 p-4">
              <h3 className="text-sm font-semibold text-red-300">Delete Strategy</h3>
              <p className="mt-1 text-xs text-zinc-400">
                This action will delete the strategy and all related data in cascade.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Type <span className="font-semibold text-zinc-300">{strategyName}</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteStrategyConfirmInput}
                onChange={(event) => setDeleteStrategyConfirmInput(event.target.value)}
                className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                autoFocus
              />
              {deleteStrategyError && (
                <div className="mt-3 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  {deleteStrategyError}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteStrategyDialogOpen(false)}
                  disabled={isDeletingStrategy}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmDeleteStrategy()}
                  disabled={isDeletingStrategy}
                  className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                >
                  {isDeletingStrategy ? 'Deleting...' : 'Delete permanently'}
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
