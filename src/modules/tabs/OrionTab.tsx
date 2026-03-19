/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { BlockTitle, List, ListItem } from 'konsta/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import AppNavbar from '@/components/AppNavbar';
import CogIcon from '@/components/icons/CogIcon';
import MarketplaceScreen from '@/modules/tabs/orion/MarketplaceScreen';
import NodesEditorView from '@/modules/tabs/orion/NodesEditorView';
import StrategyDetailView from '@/modules/tabs/orion/StrategyDetailView';
import { createEmptyDraft, type MarketplaceTab, type MyStrategiesScreen, type StrategyDraft } from '@/modules/tabs/orion/shared';
import { strategiesService, type StrategyRecord } from '@/services/StrategiesService';
import { useAuthStore } from '@/stores/authStore';

interface Notification {
  id: number;
  ticker: string;
  stars: number;
  direction: 'up' | 'down';
  timestamp: Date;
}

function parseOrionRoute(pathname: string): {
  view: 'notifications' | 'marketplace';
  marketplaceTab: MarketplaceTab;
  myStrategiesScreen: MyStrategiesScreen;
  selectedStrategyId: string | null;
} {
  const normalized = pathname.replace(/\/+$/, '');

  if (normalized === '/orion' || normalized === '') {
    return {
      view: 'notifications',
      marketplaceTab: 'explore',
      myStrategiesScreen: 'list',
      selectedStrategyId: null,
    };
  }

  if (normalized === '/orion/marketplace') {
    return {
      view: 'marketplace',
      marketplaceTab: 'explore',
      myStrategiesScreen: 'list',
      selectedStrategyId: null,
    };
  }

  if (normalized === '/orion/marketplace/my-strategies') {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'list',
      selectedStrategyId: null,
    };
  }

  if (normalized === '/orion/marketplace/my-strategies/create') {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'create',
      selectedStrategyId: null,
    };
  }

  const nodesMatch = normalized.match(/^\/orion\/marketplace\/my-strategies\/([^/]+)\/nodes$/);
  if (nodesMatch) {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'nodes',
      selectedStrategyId: decodeURIComponent(nodesMatch[1]),
    };
  }

  const detailMatch = normalized.match(/^\/orion\/marketplace\/my-strategies\/([^/]+)$/);
  if (detailMatch) {
    return {
      view: 'marketplace',
      marketplaceTab: 'my-strategies',
      myStrategiesScreen: 'detail',
      selectedStrategyId: decodeURIComponent(detailMatch[1]),
    };
  }

  return {
    view: 'notifications',
    marketplaceTab: 'explore',
    myStrategiesScreen: 'list',
    selectedStrategyId: null,
  };
}

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
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function OrionTab() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isClient, setIsClient] = useState(false);

  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [isStrategiesLoading, setIsStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<StrategyDraft>(createEmptyDraft);
  const [isCreatingStrategy, setIsCreatingStrategy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const routeState = useMemo(() => parseOrionRoute(location.pathname), [location.pathname]);
  const orionRouteKey = useMemo(() => location.pathname, [location.pathname]);
  const view = routeState.view;
  const marketplaceTab = routeState.marketplaceTab;
  const myStrategiesScreen = routeState.myStrategiesScreen;
  const selectedStrategyId = routeState.selectedStrategyId;

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
    navigate(`/orion/marketplace/my-strategies/${encodeURIComponent(strategy.id)}`);
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
      navigate('/orion/marketplace/my-strategies');
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
                  navigate('/orion/marketplace/my-strategies');
                }}
                className="flex h-10 w-10 items-center justify-center text-2xl text-zinc-200"
                aria-label="Close strategy view"
              >
                <CloseIcon />
              </button>
            ) : isMarketplace ? (
              <button
                type="button"
                onClick={() => {
                  navigate('/orion');
                  setCreateDraft(createEmptyDraft());
                  setCreateError(null);
                }}
                className="flex h-10 w-10 items-center justify-center text-2xl text-zinc-200"
                aria-label="Close Orion marketplace"
              >
                <CloseIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/orion/marketplace')}
                className="flex h-10 w-10 items-center justify-center text-2xl text-zinc-200"
                aria-label="Open Orion marketplace"
              >
                <CogIcon />
              </button>
            )
          }
        />
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={orionRouteKey}
          initial={isNodesView ? { opacity: 0, scale: 0.96 } : { opacity: 0, y: 14 }}
          animate={isNodesView ? { opacity: 1, scale: 1 } : { opacity: 1, y: 0 }}
          exit={isNodesView ? { opacity: 0, scale: 0.96 } : { opacity: 0, y: -10 }}
          transition={{ duration: isNodesView ? 0.22 : 0.18, ease: 'easeOut' }}
        >
          {isNodesView && selectedStrategyId ? (
            <NodesEditorView
              strategyId={selectedStrategyId}
              strategyName={selectedStrategy?.name ?? 'Strategy'}
              onClose={() => navigate(`/orion/marketplace/my-strategies/${encodeURIComponent(selectedStrategyId)}`)}
            />
          ) : isStrategyDetailView && selectedStrategy ? (
            <StrategyDetailView
              strategy={selectedStrategy}
              onOpenNodes={() => navigate(`/orion/marketplace/my-strategies/${encodeURIComponent(selectedStrategy.id)}/nodes`)}
            />
          ) : isMarketplace ? (
            <MarketplaceScreen
              tab={marketplaceTab}
              myStrategiesScreen={myStrategiesScreen === 'detail' || myStrategiesScreen === 'nodes' ? 'list' : myStrategiesScreen}
              onChangeTab={(tab) => {
                navigate(tab === 'my-strategies' ? '/orion/marketplace/my-strategies' : '/orion/marketplace');
              }}
              onChangeMyStrategiesScreen={(screen) => {
                if (screen === 'create') {
                  setCreateDraft(createEmptyDraft());
                  setCreateError(null);
                  navigate('/orion/marketplace/my-strategies/create');
                }
                if (screen === 'list') navigate('/orion/marketplace/my-strategies');
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
            <div className="mx-auto max-w-xl space-y-2 pb-24">
              {isClient && Object.entries(groupedNotifications).map(([dateLabel, items]) => (
                <div key={dateLabel}>
                  <BlockTitle className="mt-4">{dateLabel}</BlockTitle>
                  <List strong inset>
                    {items.map((notification) => (
                      <ListItem
                        key={notification.id}
                        title={notification.ticker}
                        after={(
                          <div className="flex items-center gap-2">
                            <StarRating stars={notification.stars} />
                            <span className={`text-2xl ${notification.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                              {notification.direction === 'up' ? '▲' : '▼'}
                            </span>
                          </div>
                        )}
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
        </motion.div>
      </AnimatePresence>
    </>
  );
}
