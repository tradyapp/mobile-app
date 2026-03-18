/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { BlockTitle, List, ListItem } from 'konsta/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppNavbar from '@/components/AppNavbar';
import CogIcon from '@/components/icons/CogIcon';
import { strategiesService, type StrategyRecord } from '@/services/StrategiesService';
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
            <button
              type="button"
              role="switch"
              aria-checked={isLive}
              onClick={() => setIsLive((prev) => !prev)}
              className={`relative h-7 w-12 rounded-full transition-colors ${isLive ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              aria-label="Toggle live mode"
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${isLive ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          )}
        />
      </List>
    </div>
  );
}

function NodesView() {
  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      <div className="mt-6 min-h-[68vh] rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex h-full min-h-[60vh] items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950/70">
          <p className="text-sm text-zinc-400">Node WIP!</p>
        </div>
      </div>
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
      <AppNavbar
        title={isNodesView ? 'Nodes' : (isStrategyDetailView ? (selectedStrategy?.name ?? 'Strategy') : (isMarketplace ? 'Orion Marketplace' : 'Notifications'))}
        left={
          isNodesView ? (
            <button
              type="button"
              onClick={() => setMyStrategiesScreen('detail')}
              className="text-2xl w-10 h-10 flex items-center justify-center text-zinc-200"
              aria-label="Close nodes view"
            >
              <CloseIcon />
            </button>
          ) : isStrategyDetailView ? (
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

      {isNodesView && selectedStrategy ? (
        <NodesView />
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
