/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogButton, List, ListInput, Segmented, SegmentedButton } from 'konsta/react';
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
import { strategyNodeTypesService, type StrategyNodePropertyRecord, type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { strategiesService, type StrategyNodeMap, type StrategyNodeVersionRecord, type StrategyTrackedSymbol } from '@/services/StrategiesService';

function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

type NodeDetailsPanel = 'inputs' | 'attributes' | 'outputs';
type NodeDetailsPanelItem = { key: NodeDetailsPanel; label: string };
type LocalExecutionStatus = 'idle' | 'running' | 'completed' | 'failed';
type LocalExecutionNodeStatus = 'pending' | 'running' | 'success' | 'error';

interface LocalExecutionNodeTrace {
  nodeId: string;
  label: string;
  nodeTypeKey: string;
  nodeTypeVersion: number | null;
  status: LocalExecutionNodeStatus;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  error: string | null;
}

function makeFieldId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function toFieldDefaultValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function mapPropertiesToInputs(properties: StrategyNodePropertyRecord[] | undefined): EditorNodeField[] {
  if (!Array.isArray(properties)) return [];
  return properties.map((item, index) => ({
    id: makeFieldId('input'),
    key: item.key?.trim() || undefined,
    name: item.label?.trim() || item.key?.trim() || `Input ${index + 1}`,
    type: item.type || 'text',
    value: String(item.type || '').trim().toLowerCase() === 'multi_select' && Array.isArray(item.default)
      ? item.default
        .filter((value): value is string | number | boolean => (
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ))
        .map((value) => String(value))
        .join(',')
      : toFieldDefaultValue(item.default),
    options: Array.isArray(item.options) ? item.options : undefined,
    required: true,
  }));
}

function mapPortsToFlowFields(
  ports: Array<{ label?: string; key?: string; type?: string }> | undefined,
  prefix: 'in' | 'out',
  fallbackLabel: string
): EditorNodeField[] {
  if (!Array.isArray(ports)) return [];
  const mapped = ports.map((item, index) => ({
    id: makeFieldId(prefix),
    key: item.key?.trim() || undefined,
    name: item.label?.trim() || item.key?.trim() || `${fallbackLabel} ${index + 1}`,
    type: item.type || 'any',
    required: true,
  }));
  return mapped;
}

function createNodeDefaults(nodeType: StrategyNodeTypeRecord): Pick<EditorNodeData, 'inputs' | 'attributes' | 'outputs'> {
  const { category } = nodeType;
  const normalized = normalizeNodeCategory(category);
  const attributesFromProperties = mapPropertiesToInputs(nodeType.properties);
  const inputsFromNodeType = mapPortsToFlowFields(nodeType.input_ports, 'in', 'Input');
  const outputsFromNodeType = mapPortsToFlowFields(nodeType.output_ports, 'out', 'Output');

  if (normalized === 'trigger') {
    return {
      inputs: [],
      attributes: attributesFromProperties,
      outputs: outputsFromNodeType.length > 0
        ? outputsFromNodeType
        : [{ id: makeFieldId('out'), name: 'event', type: 'signal' }],
    };
  }

  if (normalized === 'output') {
    return {
      inputs: inputsFromNodeType.length > 0
        ? inputsFromNodeType
        : [{ id: makeFieldId('in'), name: 'signal', type: 'signal', required: true }],
      attributes: attributesFromProperties,
      outputs: [],
    };
  }

  return {
    inputs: inputsFromNodeType.length > 0
      ? inputsFromNodeType
      : [{ id: makeFieldId('in'), name: 'input', type: 'number', required: true }],
    attributes: attributesFromProperties,
    outputs: outputsFromNodeType.length > 0
      ? outputsFromNodeType
      : [{ id: makeFieldId('out'), name: 'result', type: 'number' }],
  };
}

function formatScalarValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return Object.prototype.toString.call(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getValueType(value: unknown): 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' | 'unknown' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (isPlainObject(value)) return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'unknown';
}

function getTypeToken(type: ReturnType<typeof getValueType>): { icon: string; pillClass: string; typeLabel: string } {
  if (type === 'string') return { icon: 'T', pillClass: 'border-sky-700 bg-sky-900/45 text-sky-200', typeLabel: 'string' };
  if (type === 'number') return { icon: '#', pillClass: 'border-emerald-700 bg-emerald-900/45 text-emerald-200', typeLabel: 'number' };
  if (type === 'boolean') return { icon: '?', pillClass: 'border-amber-700 bg-amber-900/45 text-amber-200', typeLabel: 'boolean' };
  if (type === 'null') return { icon: '0', pillClass: 'border-zinc-700 bg-zinc-800/70 text-zinc-200', typeLabel: 'null' };
  if (type === 'array') return { icon: '[]', pillClass: 'border-violet-700 bg-violet-900/45 text-violet-200', typeLabel: 'array' };
  if (type === 'object') return { icon: '{}', pillClass: 'border-rose-700 bg-rose-900/45 text-rose-200', typeLabel: 'object' };
  return { icon: '·', pillClass: 'border-zinc-700 bg-zinc-800/70 text-zinc-200', typeLabel: 'unknown' };
}

function getAttributeTypeIcon(type?: string): string {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized.includes('number') || normalized.includes('int') || normalized.includes('float') || normalized.includes('decimal')) return '#';
  if (normalized.includes('bool')) return '?';
  if (normalized.includes('multi')) return '≡';
  if (normalized.includes('date') || normalized.includes('time')) return '@';
  if (normalized.includes('json') || normalized.includes('object') || normalized.includes('map')) return '{}';
  if (normalized.includes('array') || normalized.includes('list')) return '[]';
  return 'T';
}

function formatTimezoneOffset(timeZone: string, date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const tzName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'UTC';
    return tzName.replace(/^GMT/i, 'UTC');
  } catch {
    return 'UTC';
  }
}

function buildTimezoneOptions(date: Date = new Date()): Array<{ value: string; label: string }> {
  const supported = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

  return supported.map((timeZone) => ({
    value: timeZone,
    label: `${timeZone} (${formatTimezoneOffset(timeZone, date)})`,
  }));
}

function parseMultiSelectCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function SnapshotTree({
  label,
  value,
  depth = 0,
}: {
  label: string;
  value: unknown;
  depth?: number;
}) {
  const isArray = Array.isArray(value);
  const isObject = isPlainObject(value);
  const isBranch = isArray || isObject;
  const valueType = getValueType(value);
  const token = getTypeToken(valueType);

  if (!isBranch) {
    return (
      <div className="mt-1 flex flex-wrap items-start gap-2 py-1.5">
        <span className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${token.pillClass}`}>
          <span className="inline-flex h-4 min-w-4 items-center justify-center px-0.5 text-[9px] font-semibold opacity-80">
            {token.icon}
          </span>
          <span>
            {label}
          </span>
        </span>
        <p className="min-w-0 max-w-full break-words text-[11px] text-zinc-100">{formatScalarValue(value)}</p>
      </div>
    );
  }

  const entries = isArray
    ? value.map((item, index) => [`[${index}]`, item] as const)
    : Object.entries(value);

  return (
    <details
      className="mt-1"
      open={depth < 2}
    >
      <summary className="cursor-pointer py-1.5 text-[11px] font-semibold text-zinc-100 marker:text-zinc-500">
        <span className="inline-flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${token.pillClass}`}>
            <span className="inline-flex h-4 min-w-4 items-center justify-center px-0.5 text-[9px] font-semibold opacity-80">
              {token.icon}
            </span>
            {label}
          </span>
          <span className="text-zinc-500">({entries.length})</span>
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] ${token.pillClass}`}>{token.typeLabel}</span>
        </span>
      </summary>
      <div className="ml-4 space-y-0.5 pl-2">
        {entries.length === 0 ? (
          <div className="py-1.5 text-[11px] text-zinc-500">
            Empty
          </div>
        ) : (
          entries.map(([entryKey, entryValue]) => (
            <SnapshotTree key={`${label}-${entryKey}`} label={entryKey} value={entryValue} depth={depth + 1} />
          ))
        )}
      </div>
    </details>
  );
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
  const [selectedExecutionTicker, setSelectedExecutionTicker] = useState<string>('');
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
  const selectedExecutionSymbol = useMemo(
    () => trackedSymbols.find((item) => item.ticker.toUpperCase() === selectedExecutionTicker.toUpperCase()) ?? null,
    [trackedSymbols, selectedExecutionTicker]
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
    if (trackedSymbols.length === 0) {
      setSelectedExecutionTicker('');
      return;
    }

    setSelectedExecutionTicker((prev) => {
      const hasPrev = trackedSymbols.some((item) => item.ticker.toUpperCase() === prev.toUpperCase());
      if (hasPrev) return prev;
      return trackedSymbols[0]?.ticker ?? '';
    });
  }, [trackedSymbols]);

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

  const runLocalExecution = useCallback(async () => {
    if (localExecutionStatus === 'running') return;

    if (nodes.length === 0) {
      setLocalExecutionStatus('failed');
      setLocalExecutionError('Add at least one node before running local execution.');
      setLocalExecutionTraces([]);
      executionStatusByNodeIdRef.current = {};
      return;
    }

    if (!selectedExecutionTicker.trim()) {
      setLocalExecutionStatus('failed');
      setLocalExecutionError('Select a strategy symbol before running local execution.');
      setLocalExecutionTraces([]);
      executionStatusByNodeIdRef.current = {};
      return;
    }

    setLocalExecutionStatus('running');
    setLocalExecutionError(null);

    const nodeById = new Map<string, RFNode>();
    const incomingByNodeId = new Map<string, string[]>();
    const outgoingByNodeId = new Map<string, string[]>();
    const indegree = new Map<string, number>();

    for (const node of nodes) {
      nodeById.set(node.id, node);
      incomingByNodeId.set(node.id, []);
      outgoingByNodeId.set(node.id, []);
      indegree.set(node.id, 0);
    }

    for (const edge of edges) {
      if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
      incomingByNodeId.set(edge.target, [...(incomingByNodeId.get(edge.target) ?? []), edge.source]);
      outgoingByNodeId.set(edge.source, [...(outgoingByNodeId.get(edge.source) ?? []), edge.target]);
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const node of nodes) {
      if ((indegree.get(node.id) ?? 0) === 0) queue.push(node.id);
    }
    queue.sort((a, b) => {
      const nodeA = nodeById.get(a);
      const nodeB = nodeById.get(b);
      const categoryA = normalizeNodeCategory((nodeA?.data as EditorNodeData | undefined)?.category);
      const categoryB = normalizeNodeCategory((nodeB?.data as EditorNodeData | undefined)?.category);
      if (categoryA === categoryB) return a.localeCompare(b);
      if (categoryA === 'trigger') return -1;
      if (categoryB === 'trigger') return 1;
      return categoryA.localeCompare(categoryB);
    });

    const orderedNodeIds: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      orderedNodeIds.push(current);
      for (const next of outgoingByNodeId.get(current) ?? []) {
        const remaining = (indegree.get(next) ?? 0) - 1;
        indegree.set(next, remaining);
        if (remaining === 0) {
          queue.push(next);
        }
      }
    }

    for (const node of nodes) {
      if (!orderedNodeIds.includes(node.id)) {
        orderedNodeIds.push(node.id);
      }
    }

    const tracesById = new Map<string, LocalExecutionNodeTrace>();
    const executionStatusByNodeId: Record<string, LocalExecutionNodeStatus> = {};
    for (const nodeId of orderedNodeIds) {
      const node = nodeById.get(nodeId)!;
      const nodeData = (node.data ?? {}) as EditorNodeData;
      tracesById.set(nodeId, {
        nodeId,
        label: nodeData.label ?? nodeId,
        nodeTypeKey: nodeData.nodeTypeKey ?? 'custom-node',
        nodeTypeVersion: typeof nodeData.nodeTypeVersion === 'number' ? nodeData.nodeTypeVersion : null,
        status: 'pending',
        inputSnapshot: null,
        outputSnapshot: null,
        error: null,
      });
      executionStatusByNodeId[nodeId] = 'pending';
    }

    const syncTracesState = () => {
      executionStatusByNodeIdRef.current = { ...executionStatusByNodeId };
      setLocalExecutionTraces(orderedNodeIds.map((nodeId) => tracesById.get(nodeId)!));
    };

    syncTracesState();

    const outputsByNodeId = new Map<string, unknown>();
    const stateHistory: Array<{ nodeId: string; nodeTypeKey: string; label: string; output: unknown }> = [];
    const executionTime = new Date().toISOString();

    for (let i = 0; i < orderedNodeIds.length; i += 1) {
      const nodeId = orderedNodeIds[i];
      const trace = tracesById.get(nodeId);
      const node = nodeById.get(nodeId);
      if (!trace || !node) continue;

      trace.status = 'running';
      executionStatusByNodeId[nodeId] = 'running';
      syncTracesState();
      await new Promise((resolve) => window.setTimeout(resolve, 120));

      const incomingIds = incomingByNodeId.get(nodeId) ?? [];
      const inputs: Record<string, unknown> = {};
      for (const incomingId of incomingIds) {
        if (outputsByNodeId.has(incomingId)) {
          const incomingNode = nodeById.get(incomingId);
          const incomingData = (incomingNode?.data ?? {}) as EditorNodeData;
          const key = incomingData.nodeTypeKey || incomingData.label || incomingId;
          inputs[`${incomingId}:${key}`] = outputsByNodeId.get(incomingId);
        }
      }

      const nodeData = (node.data ?? {}) as EditorNodeData;

      trace.inputSnapshot = {
        execution_symbol: selectedExecutionSymbol
          ? {
            ticker: selectedExecutionSymbol.ticker,
            name: selectedExecutionSymbol.name,
            market: selectedExecutionSymbol.market,
          }
          : { ticker: selectedExecutionTicker },
        upstreamCount: incomingIds.length,
        upstream: inputs,
        state_history: [...stateHistory],
      };

      try {
        const execution = await strategiesService.executeStrategyNode({
          strategy_id: strategyId,
          node_type_key: nodeData.nodeTypeKey ?? 'custom-node',
          node_type_version: typeof nodeData.nodeTypeVersion === 'number' ? nodeData.nodeTypeVersion : null,
          attributes: nodeData.attributes,
          input_context: {
            execution_symbol: selectedExecutionSymbol
              ? {
                ticker: selectedExecutionSymbol.ticker,
                name: selectedExecutionSymbol.name,
                market: selectedExecutionSymbol.market,
              }
              : { ticker: selectedExecutionTicker },
            upstreamCount: incomingIds.length,
            upstream: inputs,
            state_history: [...stateHistory],
          },
          mode: 'preview',
          execution_time: executionTime,
        });

        trace.inputSnapshot = {
          execution_symbol: selectedExecutionSymbol
            ? {
              ticker: selectedExecutionSymbol.ticker,
              name: selectedExecutionSymbol.name,
              market: selectedExecutionSymbol.market,
            }
            : { ticker: selectedExecutionTicker },
          upstreamCount: incomingIds.length,
          upstream: inputs,
          input_schema: execution.input_schema,
          attributes_used: execution.attributes,
          state_history: [...stateHistory],
        };
        trace.outputSnapshot = execution.output;

        outputsByNodeId.set(nodeId, trace.outputSnapshot);
        trace.status = 'success';
        executionStatusByNodeId[nodeId] = 'success';
        trace.error = null;
        stateHistory.push({
          nodeId,
          nodeTypeKey: trace.nodeTypeKey,
          label: trace.label,
          output: trace.outputSnapshot,
        });
      } catch (error) {
        trace.status = 'error';
        executionStatusByNodeId[nodeId] = 'error';
        trace.error = error instanceof Error ? error.message : 'Execution error';
        setLocalExecutionStatus('failed');
        setLocalExecutionError(`Node failed: ${trace.label}${selectedExecutionTicker ? ` · ${selectedExecutionTicker}` : ''}`);
        syncTracesState();
        return;
      }

      syncTracesState();
    }

    setLocalExecutionStatus('completed');
    setLocalExecutionError(null);
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
              {localExecutionStatus !== 'idle' && (
                <p className={`text-[11px] ${localExecutionStatus === 'running' ? 'text-blue-300' : localExecutionStatus === 'completed' ? 'text-emerald-300' : 'text-red-300'}`}>
                  {localExecutionStatus === 'running' ? 'Execution · Running' : localExecutionStatus === 'completed' ? 'Execution · Completed' : `Execution · Failed${localExecutionError ? ` · ${localExecutionError}` : ''}`}
                </p>
              )}
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
            <div className="h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="flex items-center border-b border-zinc-800 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setNodeEditorNodeId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300"
                  aria-label="Back to node editor"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="ml-2 min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{nodeEditorData?.label ?? 'Node'}</p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {nodeEditorData?.nodeTypeKey ?? 'custom-node'}
                    {typeof nodeEditorData?.nodeTypeVersion === 'number' ? ` @v${nodeEditorData.nodeTypeVersion}` : ''}
                  </p>
                </div>
              </div>
              <div className="border-b border-zinc-800 px-3 py-2">
                <Segmented
                  strong
                  className="w-full [&_button]:flex-1 [&_button]:py-1.5 [&_button]:text-[11px]"
                >
                {nodeDetailsPanelItems.map((item) => {
                  const active = nodeDetailsPanel === item.key;
                  return (
                    <SegmentedButton
                      key={item.key}
                      active={active}
                      onClick={() => setNodeDetailsPanel(item.key)}
                    >
                      {item.label}
                    </SegmentedButton>
                  );
                })}
                </Segmented>
              </div>
              <div className="h-[calc(100%-92px)] overflow-y-auto px-3 py-3 [scrollbar-width:thin] [scrollbar-color:#3f3f46_#09090b] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-950 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-600">
                <div className="space-y-2">
                  {nodeDetailsPanel === 'attributes' ? (
                    panelFields.length === 0 ? (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-zinc-500">
                        No configurable attributes for this node.
                      </div>
                    ) : (
                      <>
                        <List strongIos className="[&_.list]:mx-0 [&_.list]:rounded-none [&_.list]:px-0 [&_.list-ios]:mx-0 [&_.list-ios]:rounded-none [&_.list-ios]:px-0">
                          {panelFields.map((field, index) => (
                            (() => {
                              const fieldType = (field.type || '').trim().toLowerCase();
                              const isTimezone = (field.type || '').trim().toLowerCase() === 'timezone' || (field.key || '').trim().toLowerCase() === 'timezone';
                              const isMultiSelect = fieldType === 'multi_select';
                              const selectOptions = field.options && field.options.length > 0 ? field.options : (isTimezone ? timezoneOptions : []);
                              const isSelect = !isMultiSelect && selectOptions.length > 0;
                              const selectedMultiValues = isMultiSelect ? parseMultiSelectCsv(field.value) : [];
                              return (
                                isMultiSelect ? (
                                  <div key={field.id} className="px-4 py-2">
                                    <p className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                                      <span className="text-[10px] font-semibold text-zinc-400">{getAttributeTypeIcon(field.type)}</span>
                                      <span>{field.name || field.key || 'Attribute'}</span>
                                      {field.required && <span className="text-red-400">*</span>}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      {selectOptions.map((option) => {
                                        const active = selectedMultiValues.includes(option.value);
                                        return (
                                          <button
                                            key={`${field.id}-${option.value}`}
                                            type="button"
                                            disabled={isPreviewMode}
                                            onClick={() => updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => {
                                              const next = [...prev];
                                              const currentValues = parseMultiSelectCsv(next[index]?.value);
                                              const nextValues = currentValues.includes(option.value)
                                                ? currentValues.filter((item) => item !== option.value)
                                                : [...currentValues, option.value];
                                              next[index] = { ...next[index], value: nextValues.join(',') };
                                              return next;
                                            })}
                                            className={`rounded-md border px-1.5 py-1 text-[11px] transition-colors ${active ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300'} ${isPreviewMode ? 'opacity-60' : ''}`}
                                          >
                                            {option.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <ListInput
                                    key={field.id}
                                    type={isSelect ? 'select' : 'text'}
                                    value={field.value ?? ''}
                                    disabled={isPreviewMode}
                                    label={(
                                      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                                        <span className="text-[10px] font-semibold text-zinc-400">{getAttributeTypeIcon(field.type)}</span>
                                        <span>{field.name || field.key || 'Attribute'}</span>
                                        {field.required && <span className="text-red-400">*</span>}
                                      </span>
                                    )}
                                    placeholder="Set value"
                                    onChange={(event) => updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], value: event.target.value };
                                      return next;
                                    })}
                                    className="[&_input]:rounded-md [&_input]:border [&_input]:border-zinc-800 [&_input]:bg-zinc-950 [&_input]:px-1.5 [&_input]:py-1 [&_input]:text-xs [&_input]:text-zinc-100 [&_select]:rounded-md [&_select]:border [&_select]:border-zinc-800 [&_select]:bg-zinc-950 [&_select]:px-1.5 [&_select]:py-1 [&_select]:text-xs [&_select]:text-zinc-100"
                                  >
                                    {isSelect && selectOptions.map((option) => (
                                      <option key={`${field.id}-${option.value}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </ListInput>
                                )
                              );
                            })()
                          ))}
                        </List>
                      </>
                    )
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
          ) : (
            <div className="relative h-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
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
        <div className="absolute bottom-[max(32px,env(safe-area-inset-bottom))] right-[max(20px,env(safe-area-inset-right))] z-[230] flex items-center gap-3">
          <div className="max-w-[56vw] rounded-xl border border-zinc-800 bg-zinc-950/95 px-2.5 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Test Symbol</p>
            <select
              value={selectedExecutionTicker}
              onChange={(event) => setSelectedExecutionTicker(event.target.value)}
              disabled={localExecutionStatus === 'running' || trackedSymbols.length === 0}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-600 disabled:opacity-60"
              aria-label="Select test symbol"
            >
              {trackedSymbols.length === 0 ? (
                <option value="">No symbols configured</option>
              ) : (
                trackedSymbols.map((item) => (
                  <option key={item.ticker} value={item.ticker}>
                    {item.ticker} · {item.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void runLocalExecution()}
            disabled={localExecutionStatus === 'running' || !selectedExecutionTicker}
            className="flex h-11 items-center gap-2 rounded-full border border-emerald-600 bg-emerald-950/70 px-4 text-sm font-semibold text-emerald-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] disabled:opacity-60"
            aria-label="Run local simulation"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {localExecutionStatus === 'running' ? 'Running...' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => setIsNodeTypesDrawerOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl font-light text-zinc-950 shadow-[0_10px_25px_rgba(16,185,129,0.35)]"
            aria-label="Add node"
          >
            +
          </button>
        </div>
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
          void runLocalExecution();
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
