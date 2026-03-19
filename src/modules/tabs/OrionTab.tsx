/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { BlockTitle, List, ListItem, Toggle } from 'konsta/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import AppNavbar from '@/components/AppNavbar';
import CogIcon from '@/components/icons/CogIcon';
import AppDrawer from '@/components/uiux/AppDrawer';
import { strategyNodeTypesService, type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { strategiesService, type StrategyNodeMap, type StrategyNodeVersionRecord, type StrategyRecord } from '@/services/StrategiesService';
import { useAuthStore } from '@/stores/authStore';

interface Notification {
  id: number;
  ticker: string;
  stars: number;
  direction: 'up' | 'down';
  timestamp: Date;
}

interface StrategyApp {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  icon: string;
  accent: string;
}

interface StrategyDraft {
  name: string;
  description: string;
  photoUrl: string | null;
}

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

const MARKETPLACE_APPS: StrategyApp[] = [
  { id: 'breakout-hunter', name: 'Breakout Hunter', subtitle: 'Detecta rupturas con volumen', category: 'Momentum', icon: 'BH', accent: '#22c55e' },
  { id: 'mean-revert-pro', name: 'Mean Revert Pro', subtitle: 'Señales de reversión intradía', category: 'Mean Reversion', icon: 'MR', accent: '#60a5fa' },
  { id: 'trend-pulse', name: 'Trend Pulse', subtitle: 'Filtro de tendencia multi-timeframe', category: 'Trend', icon: 'TP', accent: '#f59e0b' },
  { id: 'squeeze-lab', name: 'Squeeze Lab', subtitle: 'Compresión y expansión de volatilidad', category: 'Volatility', icon: 'SQ', accent: '#a78bfa' },
  { id: 'session-edge', name: 'Session Edge', subtitle: 'Setups por sesión de mercado', category: 'Session', icon: 'SE', accent: '#14b8a6' },
  { id: 'news-shield', name: 'News Shield', subtitle: 'Bloquea entradas en eventos de alto impacto', category: 'Risk', icon: 'NS', accent: '#fb7185' },
];

const PHOTO_SIZE_PX = 250;

const createEmptyDraft = (): StrategyDraft => ({
  name: '',
  description: '',
  photoUrl: null,
});

const generateMockNotifications = (): Notification[] => {
  const tickers = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA', 'AMD', 'NFLX', 'DIS', 'BAC', 'JPM', 'GS', 'WMT', 'TGT', 'COST', 'NKE', 'SBUX', 'MCD', 'KO'];
  const notifications: Notification[] = [];
  const now = new Date();

  for (let i = 0; i < 200; i++) {
    const hoursAgo = Math.floor(Math.random() * 720);
    const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    notifications.push({
      id: i,
      ticker: tickers[Math.floor(Math.random() * tickers.length)],
      stars: Math.floor(Math.random() * 5) + 1,
      direction: Math.random() > 0.5 ? 'up' : 'down',
      timestamp,
    });
  }

  return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const getDateLabel = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (inputDate.getTime() === today.getTime()) return 'Today';
  if (inputDate.getTime() === yesterday.getTime()) return 'Yesterday';

  const daysAgo = Math.floor((today.getTime() - inputDate.getTime()) / (24 * 60 * 60 * 1000));
  if (daysAgo < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });

  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const groupByDate = (notifications: Notification[]) => {
  const groups: { [key: string]: Notification[] } = {};
  notifications.forEach((notification) => {
    const label = getDateLabel(notification.timestamp);
    if (!groups[label]) groups[label] = [];
    groups[label].push(notification);
  });
  return groups;
};

function optimizeImageToWebp250(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = PHOTO_SIZE_PX;
        canvas.height = PHOTO_SIZE_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to process image'));
          return;
        }

        const sourceAspect = image.width / image.height;
        const targetAspect = 1;
        let sourceWidth = image.width;
        let sourceHeight = image.height;
        let sourceX = 0;
        let sourceY = 0;

        if (sourceAspect > targetAspect) {
          sourceWidth = image.height;
          sourceX = (image.width - sourceWidth) / 2;
        } else if (sourceAspect < targetAspect) {
          sourceHeight = image.width;
          sourceY = (image.height - sourceHeight) / 2;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          PHOTO_SIZE_PX,
          PHOTO_SIZE_PX
        );

        resolve(canvas.toDataURL('image/webp', 0.9));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image file'));
    };

    image.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image file'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
}

async function processStrategyPhoto(file: File): Promise<string> {
  if (isSvgFile(file)) return readFileAsDataUrl(file);
  return optimizeImageToWebp250(file);
}

const StarRating = ({ stars }: { stars: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <span key={star} className={star <= stars ? 'text-yellow-400' : 'text-gray-600'}>
        ⭐
      </span>
    ))}
  </div>
);

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

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 3.487a2.1 2.1 0 113.02 2.915L8.64 18.273l-4.14.824.86-4.01L16.862 3.487z" />
    </svg>
  );
}

function StrategyLogo({ strategy }: { strategy: Pick<StrategyRecord, 'name' | 'photo_url'> }) {
  if (strategy.photo_url) {
    return <img src={strategy.photo_url} alt={strategy.name} className="h-11 w-11 rounded-xl bg-zinc-800 object-contain" />;
  }

  const initials = strategy.name
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-700 text-sm font-semibold text-white">
      {initials || 'ST'}
    </div>
  );
}

type MarketplaceTab = 'explore' | 'my-strategies';
type MyStrategiesScreen = 'list' | 'create' | 'detail' | 'nodes';

interface StrategyFormScreenProps {
  title: string;
  draft: StrategyDraft;
  onChangeDraft: (updater: (prev: StrategyDraft) => StrategyDraft) => void;
  isSubmitting: boolean;
  error: string | null;
  submitLabel: string;
  onBack: () => void;
  onSubmit: () => void;
  onDelete?: () => void;
}

function StrategyFormScreen({
  title,
  draft,
  onChangeDraft,
  isSubmitting,
  error,
  submitLabel,
  onBack,
  onSubmit,
  onDelete,
}: StrategyFormScreenProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsProcessingPhoto(true);
    setPhotoError(null);
    try {
      const processed = await processStrategyPhoto(file);
      onChangeDraft((prev) => ({ ...prev, photoUrl: processed }));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Image processing error');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-zinc-300"
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>

      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <div className="h-[250px] w-[250px] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800">
              {draft.photoUrl ? (
                <img src={draft.photoUrl} alt="Strategy logo" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">250x250</div>
              )}
            </div>
            {draft.photoUrl && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-200"
                aria-label="Edit photo"
              >
                <PencilIcon />
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.svg"
            onChange={handleUpload}
            className="hidden"
          />

          {!draft.photoUrl && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingPhoto}
              className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 disabled:opacity-50"
            >
              {isProcessingPhoto ? 'Processing...' : 'Upload Photo'}
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="strategy-form-name" className="text-sm text-zinc-300">Name</label>
          <input
            id="strategy-form-name"
            type="text"
            value={draft.name}
            onChange={(e) => onChangeDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="My breakout strategy"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="strategy-form-description" className="text-sm text-zinc-300">Description</label>
          <textarea
            id="strategy-form-description"
            value={draft.description}
            onChange={(e) => onChangeDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this strategy does"
            rows={4}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
          />
        </div>

        {(error || photoError) && (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error || photoError}
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || isProcessingPhoto || !draft.name.trim()}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-red-900 bg-red-950/40 px-4 py-2.5 text-sm font-semibold text-red-300 disabled:opacity-50"
          >
            Delete Strategy
          </button>
        )}
      </div>
    </div>
  );
}

interface MarketplaceScreenProps {
  tab: MarketplaceTab;
  myStrategiesScreen: MyStrategiesScreen;
  onChangeTab: (tab: MarketplaceTab) => void;
  onChangeMyStrategiesScreen: (screen: MyStrategiesScreen) => void;
  strategies: StrategyRecord[];
  isLoadingStrategies: boolean;
  strategiesError: string | null;
  onOpenStrategy: (strategy: StrategyRecord) => void;
  createDraft: StrategyDraft;
  onChangeCreateDraft: (updater: (prev: StrategyDraft) => StrategyDraft) => void;
  isCreatingStrategy: boolean;
  createError: string | null;
  onCreate: () => void;
}

interface StrategyDetailViewProps {
  strategy: StrategyRecord;
  onOpenNodes: () => void;
}

function StrategyDetailView({
  strategy,
  onOpenNodes,
}: StrategyDetailViewProps) {
  const [isLive, setIsLive] = useState(false);
  const initials = strategy.name
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      <List strong className="mt-6 overflow-hidden rounded-xl">
        <ListItem
          title={(
            <div className="flex flex-col">
              <span className="text-base font-medium text-zinc-200">{strategy.name}</span>
              <span className="text-sm text-zinc-500">Strategy workspace</span>
            </div>
          )}
          media={(
            <div className="h-14 w-14 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
              {strategy.photo_url ? (
                <img src={strategy.photo_url} alt={strategy.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-base font-semibold text-zinc-300">
                  {initials || 'ST'}
                </div>
              )}
            </div>
          )}
        />
      </List>

      <List strong className="mt-4 overflow-hidden rounded-xl">
        <ListItem link title="Nodes" onClick={onOpenNodes} />
        <ListItem link title="Back Testing" />
        <ListItem
          title="Live"
          after={(
            <Toggle
              checked={isLive}
              onChange={() => setIsLive((prev) => !prev)}
            />
          )}
        />
      </List>
    </div>
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
  const [versionNameDraft, setVersionNameDraft] = useState('');
  const [isPublishingVersion, setIsPublishingVersion] = useState(false);
  const [isActivatingVersionId, setIsActivatingVersionId] = useState<string | null>(null);
  const hasHydratedNodeMapRef = useRef(false);
  const lastSavedNodeMapRef = useRef('');
  const saveRequestIdRef = useRef(0);

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

    const payload: StrategyNodeMap = {
      version: 1,
      nodes: nodes as unknown[],
      edges: edges as unknown[],
    };
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
  }, [strategyId, nodes, edges]);

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
  }, []);

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

  const handlePublishVersion = useCallback(async () => {
    if (isPublishingVersion) return;
    setIsPublishingVersion(true);
    setNodeVersionsError(null);

    try {
      await handleSaveNodeMap();
      const created = await strategiesService.createStrategyNodeVersion(strategyId, versionNameDraft, true);
      setVersionNameDraft('');
      setNodeVersions((prev) => {
        const next = prev.map((item) => ({ ...item, is_active: false }));
        const withoutSame = next.filter((item) => item.id !== created.id);
        return [created, ...withoutSame].sort((a, b) => b.version_number - a.version_number);
      });
    } catch (error) {
      setNodeVersionsError(error instanceof Error ? error.message : 'Failed to publish version');
    } finally {
      setIsPublishingVersion(false);
    }
  }, [isPublishingVersion, handleSaveNodeMap, strategyId, versionNameDraft]);

  const handleActivateVersion = useCallback(async (version: StrategyNodeVersionRecord) => {
    if (isActivatingVersionId) return;
    setIsActivatingVersionId(version.id);
    setNodeVersionsError(null);

    try {
      await strategiesService.activateStrategyNodeVersion(strategyId, version.id);
      const nextMap = version.node_map ?? { version: 1, nodes: [], edges: [] };
      applyNodeMapToCanvas(nextMap);
      lastSavedNodeMapRef.current = JSON.stringify(nextMap);
      setSaveStatus('saved');
      setNodeVersions((prev) =>
        prev.map((item) => ({ ...item, is_active: item.id === version.id }))
      );
    } catch (error) {
      setNodeVersionsError(error instanceof Error ? error.message : 'Failed to activate version');
    } finally {
      setIsActivatingVersionId(null);
    }
  }, [isActivatingVersionId, strategyId, applyNodeMapToCanvas]);

  const handleLoadVersionDraft = useCallback((version: StrategyNodeVersionRecord) => {
    if (!version.node_map) return;
    applyNodeMapToCanvas(version.node_map);
    setSaveStatus('idle');
  }, [applyNodeMapToCanvas]);

  const handleSaveNodeMap = useCallback(async () => {
    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setSaveStatus('saving');
    setSaveError(null);

    const payload: StrategyNodeMap = {
      version: 1,
      nodes: nodes as unknown[],
      edges: edges as unknown[],
    };
    const serialized = JSON.stringify(payload);

    try {
      await strategiesService.saveStrategyNodeMap(strategyId, payload);
      if (saveRequestIdRef.current !== requestId) return;
      lastSavedNodeMapRef.current = serialized;
      setSaveStatus('saved');
    } catch (error) {
      if (saveRequestIdRef.current !== requestId) return;
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save node map');
    }
  }, [strategyId, nodes, edges]);

  return (
    <div className="fixed inset-0 z-[220] overflow-hidden bg-zinc-950">
      <div className="flex h-full flex-col overflow-hidden">
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
              {isNodeMapLoading ? 'Loading map...' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save error' : 'Nodes Editor'}
            </p>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => setIsSettingsDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-100"
              aria-label="Open nodes settings"
            >
              <CogIcon />
            </button>
          </div>
        </header>

        <div
          className="flex-1 overflow-hidden pb-4 pt-4"
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
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
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
      </div>

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
            <h3 className="text-sm font-semibold text-white">Node Settings</h3>
            <button
              type="button"
              onClick={() => handleSettingsDrawerOpenChange(false)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleSaveNodeMap()}
              disabled={saveStatus === 'saving'}
              className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left disabled:opacity-50"
            >
              <span className="text-sm font-medium text-zinc-100">Guardar</span>
              <span className="text-xs text-zinc-400">{saveStatus === 'saving' ? 'Guardando...' : 'Guardar ahora'}</span>
            </button>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-300">Publicar Draft</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={versionNameDraft}
                  onChange={(event) => setVersionNameDraft(event.target.value)}
                  placeholder="Nombre de versión (opcional)"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => void handlePublishVersion()}
                  disabled={isPublishingVersion}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                >
                  {isPublishingVersion ? 'Publicando...' : 'Activar'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-300">Versiones</p>
              <button
                type="button"
                onClick={() => void loadNodeVersions()}
                className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300"
              >
                Refresh
              </button>
            </div>

            {isNodeVersionsLoading ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-400">
                Loading versions...
              </div>
            ) : nodeVersions.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-400">
                No published versions yet.
              </div>
            ) : (
              <div className="space-y-2">
                {nodeVersions.map((version) => (
                  <div key={version.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">v{version.version_number} · {version.name}</p>
                        <p className="truncate text-[11px] text-zinc-500">{new Date(version.created_at).toLocaleString('en-US')}</p>
                      </div>
                      {version.is_active && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-medium text-emerald-300">Active</span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadVersionDraft(version)}
                        className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
                      >
                        Cargar Draft
                      </button>
                      {!version.is_active && (
                        <button
                          type="button"
                          onClick={() => void handleActivateVersion(version)}
                          disabled={isActivatingVersionId === version.id}
                          className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                        >
                          {isActivatingVersionId === version.id ? 'Activando...' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {nodeVersionsError && (
            <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {nodeVersionsError}
            </div>
          )}
        </div>
      </AppDrawer>
    </div>
  );
}

function MarketplaceScreen({
  tab,
  myStrategiesScreen,
  onChangeTab,
  onChangeMyStrategiesScreen,
  strategies,
  isLoadingStrategies,
  strategiesError,
  onOpenStrategy,
  createDraft,
  onChangeCreateDraft,
  isCreatingStrategy,
  createError,
  onCreate,
}: MarketplaceScreenProps) {
  const categories = [...new Set(MARKETPLACE_APPS.map((item) => item.category))];

  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      <div className="mt-3 grid grid-cols-2 rounded-xl bg-zinc-900 p-1">
        <button
          type="button"
          onClick={() => onChangeTab('explore')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === 'explore' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
        >
          Explore
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('my-strategies')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === 'my-strategies' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
        >
          My Strategies
        </button>
      </div>

      {tab === 'explore' ? (
        <>
          <div className="mt-3 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-400">Featured pack</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Orion Starter Bundle</h3>
            <p className="mt-1 text-sm text-zinc-400">Colección curada de estrategias para comenzar rápido. Placeholder mock.</p>
            <button className="mt-4 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-zinc-900">
              Preview
            </button>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <span key={category} className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                {category}
              </span>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {MARKETPLACE_APPS.map((app) => (
              <article key={app.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: app.accent }}
                  >
                    {app.icon}
                  </div>
                  <button className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200">
                    Get
                  </button>
                </div>
                <h4 className="mt-3 text-sm font-semibold text-white">{app.name}</h4>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{app.subtitle}</p>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          {myStrategiesScreen === 'list' && (
            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-300">Installed Strategies</h3>
                <button
                  type="button"
                  onClick={() => onChangeMyStrategiesScreen('create')}
                  className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-900"
                >
                  Create Strategy
                </button>
              </div>

              {isLoadingStrategies ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
                  Loading strategies...
                </div>
              ) : strategiesError ? (
                <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                  {strategiesError}
                </div>
              ) : strategies.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
                  You have no strategies yet. Tap <span className="text-zinc-200 font-medium">Create Strategy</span> to add your first one.
                </div>
              ) : (
                <div className="space-y-3">
                  {strategies.map((strategy) => (
                    <button
                      key={strategy.id}
                      type="button"
                      onClick={() => onOpenStrategy(strategy)}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <StrategyLogo strategy={strategy} />
                          <div>
                            <h4 className="text-sm font-semibold text-white">{strategy.name}</h4>
                            <p className="line-clamp-2 text-xs text-zinc-400">{strategy.description || 'No description'}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                          Saved
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {myStrategiesScreen === 'create' && (
            <StrategyFormScreen
              title="Create Strategy"
              draft={createDraft}
              onChangeDraft={onChangeCreateDraft}
              isSubmitting={isCreatingStrategy}
              error={createError}
              submitLabel="Create Strategy"
              onBack={() => onChangeMyStrategiesScreen('list')}
              onSubmit={onCreate}
            />
          )}

        </>
      )}
    </div>
  );
}

export default function OrionTab() {
  const user = useAuthStore((state) => state.user);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [view, setView] = useState<'notifications' | 'marketplace'>('notifications');
  const [marketplaceTab, setMarketplaceTab] = useState<MarketplaceTab>('explore');
  const [myStrategiesScreen, setMyStrategiesScreen] = useState<MyStrategiesScreen>('list');

  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [isStrategiesLoading, setIsStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<StrategyDraft>(createEmptyDraft);
  const [isCreatingStrategy, setIsCreatingStrategy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const groupedNotifications = useMemo(() => groupByDate(notifications), [notifications]);
  const isMarketplace = view === 'marketplace';

  useEffect(() => {
    setIsClient(true);
    setNotifications(generateMockNotifications());
  }, []);

  const loadStrategies = useCallback(async () => {
    if (!user?.uid) {
      setStrategies([]);
      setStrategiesError('Sign in to load your strategies.');
      return;
    }

    setIsStrategiesLoading(true);
    setStrategiesError(null);
    try {
      const records = await strategiesService.listStrategies();
      setStrategies(records);
    } catch (err) {
      setStrategiesError(err instanceof Error ? err.message : 'Failed to load strategies');
    } finally {
      setIsStrategiesLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!isMarketplace || marketplaceTab !== 'my-strategies') return;
    void loadStrategies();
  }, [isMarketplace, marketplaceTab, loadStrategies]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedStrategyId) ?? null,
    [strategies, selectedStrategyId]
  );
  const isStrategyDetailView = isMarketplace && myStrategiesScreen === 'detail';
  const isNodesView = isMarketplace && myStrategiesScreen === 'nodes';

  const handleOpenStrategy = (strategy: StrategyRecord) => {
    setSelectedStrategyId(strategy.id);
    setMyStrategiesScreen('detail');
  };

  const handleCreateStrategy = async () => {
    if (!createDraft.name.trim() || isCreatingStrategy || !user?.uid) return;
    setIsCreatingStrategy(true);
    setCreateError(null);

    try {
      const created = await strategiesService.createStrategy({
        name: createDraft.name.trim(),
        description: createDraft.description.trim() ? createDraft.description.trim() : null,
        photo_url: createDraft.photoUrl,
      });
      setStrategies((prev) => [created, ...prev]);
      setCreateDraft(createEmptyDraft());
      setMyStrategiesScreen('list');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create strategy');
    } finally {
      setIsCreatingStrategy(false);
    }
  };

  return (
    <>
      {!isNodesView && (
        <AppNavbar
          title={isStrategyDetailView ? (selectedStrategy?.name ?? 'Strategy') : (isMarketplace ? 'Orion Marketplace' : 'Notifications')}
          left={
            isStrategyDetailView ? (
              <button
                type="button"
                onClick={() => {
                  setMyStrategiesScreen('list');
                  setSelectedStrategyId(null);
                }}
                className="text-2xl w-10 h-10 flex items-center justify-center text-zinc-200"
                aria-label="Close strategy view"
              >
                <CloseIcon />
              </button>
            ) : isMarketplace ? (
              <button
                type="button"
                onClick={() => {
                  setView('notifications');
                  setMarketplaceTab('explore');
                  setMyStrategiesScreen('list');
                  setSelectedStrategyId(null);
                  setCreateDraft(createEmptyDraft());
                  setCreateError(null);
                }}
                className="text-2xl w-10 h-10 flex items-center justify-center text-zinc-200"
                aria-label="Close Orion marketplace"
              >
                <CloseIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setView('marketplace')}
                className="text-2xl w-10 h-10 flex items-center justify-center text-zinc-200"
                aria-label="Open Orion marketplace"
              >
                <CogIcon />
              </button>
            )
          }
        />
      )}

      {isNodesView && selectedStrategy ? (
        <NodesView
          strategyId={selectedStrategy.id}
          strategyName={selectedStrategy.name}
          onClose={() => setMyStrategiesScreen('detail')}
        />
      ) : isStrategyDetailView && selectedStrategy ? (
        <StrategyDetailView
          strategy={selectedStrategy}
          onOpenNodes={() => setMyStrategiesScreen('nodes')}
        />
      ) : isMarketplace ? (
        <MarketplaceScreen
          tab={marketplaceTab}
          myStrategiesScreen={myStrategiesScreen === 'detail' || myStrategiesScreen === 'nodes' ? 'list' : myStrategiesScreen}
          onChangeTab={(tab) => {
            setMarketplaceTab(tab);
            if (tab === 'my-strategies') setMyStrategiesScreen('list');
          }}
          onChangeMyStrategiesScreen={(screen) => {
            setMyStrategiesScreen(screen);
            if (screen === 'create') {
              setCreateDraft(createEmptyDraft());
              setCreateError(null);
            }
            if (screen === 'list') {
              setSelectedStrategyId(null);
            }
          }}
          strategies={strategies}
          isLoadingStrategies={isStrategiesLoading}
          strategiesError={strategiesError}
          onOpenStrategy={handleOpenStrategy}
          createDraft={createDraft}
          onChangeCreateDraft={(updater) => setCreateDraft((prev) => updater(prev))}
          isCreatingStrategy={isCreatingStrategy}
          createError={createError}
          onCreate={handleCreateStrategy}
        />
      ) : (
        <div className="space-y-2 max-w-xl mx-auto pb-24">
          {isClient && Object.entries(groupedNotifications).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <BlockTitle className="mt-4">{dateLabel}</BlockTitle>
              <List strong inset>
                {items.map((notification) => (
                  <ListItem
                    key={notification.id}
                    title={notification.ticker}
                    after={
                      <div className="flex items-center gap-2">
                        <StarRating stars={notification.stars} />
                        <span className={`text-2xl ${notification.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                          {notification.direction === 'up' ? '▲' : '▼'}
                        </span>
                      </div>
                    }
                    subtitle={notification.timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                ))}
              </List>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
