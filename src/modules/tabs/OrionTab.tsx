/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { BlockTitle, List, ListItem } from 'konsta/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppNavbar from '@/components/AppNavbar';
import AppDrawer from '@/components/uiux/AppDrawer';
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

const MARKETPLACE_APPS: StrategyApp[] = [
  { id: 'breakout-hunter', name: 'Breakout Hunter', subtitle: 'Detecta rupturas con volumen', category: 'Momentum', icon: 'BH', accent: '#22c55e' },
  { id: 'mean-revert-pro', name: 'Mean Revert Pro', subtitle: 'Señales de reversión intradía', category: 'Mean Reversion', icon: 'MR', accent: '#60a5fa' },
  { id: 'trend-pulse', name: 'Trend Pulse', subtitle: 'Filtro de tendencia multi-timeframe', category: 'Trend', icon: 'TP', accent: '#f59e0b' },
  { id: 'squeeze-lab', name: 'Squeeze Lab', subtitle: 'Compresión y expansión de volatilidad', category: 'Volatility', icon: 'SQ', accent: '#a78bfa' },
  { id: 'session-edge', name: 'Session Edge', subtitle: 'Setups por sesión de mercado', category: 'Session', icon: 'SE', accent: '#14b8a6' },
  { id: 'news-shield', name: 'News Shield', subtitle: 'Bloquea entradas en eventos de alto impacto', category: 'Risk', icon: 'NS', accent: '#fb7185' },
];

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
  if (daysAgo < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const groupByDate = (notifications: Notification[]) => {
  const groups: { [key: string]: Notification[] } = {};

  notifications.forEach((notification) => {
    const label = getDateLabel(notification.timestamp);
    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(notification);
  });

  return groups;
};

const StarRating = ({ stars }: { stars: number }) => {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= stars ? 'text-yellow-400' : 'text-gray-600'}>
          ⭐
        </span>
      ))}
    </div>
  );
};

function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const PHOTO_SIZE_PX = 40;

function optimizeImageToWebp40(file: File): Promise<string> {
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
          URL.revokeObjectURL(url);
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
        ctx.clearRect(0, 0, PHOTO_SIZE_PX, PHOTO_SIZE_PX);
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

        const webpDataUrl = canvas.toDataURL('image/webp', 0.9);
        URL.revokeObjectURL(url);
        resolve(webpDataUrl);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image file'));
    };

    image.src = url;
  });
}

function StrategyLogo({ strategy }: { strategy: Pick<StrategyRecord, 'name' | 'photo_url'> }) {
  if (strategy.photo_url) {
    return <img src={strategy.photo_url} alt={strategy.name} className="h-11 w-11 rounded-xl object-cover" />;
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

interface MarketplaceScreenProps {
  tab: MarketplaceTab;
  onChangeTab: (tab: MarketplaceTab) => void;
  strategies: StrategyRecord[];
  isLoadingStrategies: boolean;
  strategiesError: string | null;
  onOpenCreateStrategy: () => void;
}

function MarketplaceScreen({
  tab,
  onChangeTab,
  strategies,
  isLoadingStrategies,
  strategiesError,
  onOpenCreateStrategy,
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
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">Installed Strategies</h3>
            <button
              type="button"
              onClick={onOpenCreateStrategy}
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
                <article key={strategy.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
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
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CreateStrategyDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (strategy: StrategyRecord) => void;
}

function CreateStrategyDrawer({ isOpen, onOpenChange, onCreated }: CreateStrategyDrawerProps) {
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setPhotoUrl(null);
      setError(null);
      setIsCreating(false);
      setIsProcessingPhoto(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || isCreating || isProcessingPhoto) return;
    if (!user?.uid) {
      setError('You must be signed in to create a strategy.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const created = await strategiesService.createStrategy({
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        photo_url: photoUrl,
      });
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create strategy');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsProcessingPhoto(true);
    setError(null);
    try {
      const optimized = await optimizeImageToWebp40(file);
      setPhotoUrl(optimized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Create Strategy"
      height="auto"
      description="Create a new Orion strategy."
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-1 pb-6">
        <div className="space-y-1.5">
          <label htmlFor="strategy-name" className="text-sm text-zinc-300">Name</label>
          <input
            id="strategy-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My breakout strategy"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="strategy-description" className="text-sm text-zinc-300">Description</label>
          <textarea
            id="strategy-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this strategy does"
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm text-zinc-300">Photo</div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
              {photoUrl ? (
                <img src={photoUrl} alt="Strategy logo preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">40x40</div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadPhoto}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 disabled:opacity-50"
              >
                {isProcessingPhoto ? 'Optimizing...' : 'Upload Photo'}
              </button>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  disabled={isProcessingPhoto}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-400 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isCreating || isProcessingPhoto || !name.trim()}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : 'Create Strategy'}
        </button>
      </form>
    </AppDrawer>
  );
}

export default function OrionTab() {
  const user = useAuthStore((state) => state.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [view, setView] = useState<'notifications' | 'marketplace'>('notifications');
  const [marketplaceTab, setMarketplaceTab] = useState<MarketplaceTab>('explore');
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [isStrategiesLoading, setIsStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);

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
    if (!isMarketplace) return;
    if (marketplaceTab !== 'my-strategies') return;
    void loadStrategies();
  }, [isMarketplace, marketplaceTab, loadStrategies]);

  return (
    <>
      <AppNavbar
        title={isMarketplace ? 'Orion Marketplace' : 'Notifications'}
        left={
          isMarketplace ? (
            <button
              type="button"
              onClick={() => setView('notifications')}
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

      {isMarketplace ? (
        <MarketplaceScreen
          tab={marketplaceTab}
          onChangeTab={setMarketplaceTab}
          strategies={strategies}
          isLoadingStrategies={isStrategiesLoading}
          strategiesError={strategiesError}
          onOpenCreateStrategy={() => setIsCreateDrawerOpen(true)}
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

      <CreateStrategyDrawer
        isOpen={isCreateDrawerOpen}
        onOpenChange={setIsCreateDrawerOpen}
        onCreated={(strategy) => {
          setStrategies((prev) => [strategy, ...prev]);
        }}
      />
    </>
  );
}
