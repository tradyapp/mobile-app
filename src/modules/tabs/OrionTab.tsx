/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import AppNavbar from '@/components/AppNavbar';
import CogIcon from '@/components/icons/CogIcon';
import MarketplaceScreen from '@/modules/tabs/orion/MarketplaceScreen';
import NodesEditorView from '@/modules/tabs/orion/NodesEditorView';
import NotificationsScreen from '@/modules/tabs/orion/NotificationsScreen';
import StrategyDetailView from '@/modules/tabs/orion/StrategyDetailView';
import StrategySymbolsView from '@/modules/tabs/orion/StrategySymbolsView';
import { parseOrionRoute } from '@/modules/tabs/orion/routeState';
import { createEmptyDraft, type StrategyDraft } from '@/modules/tabs/orion/shared';
import dataService from '@/services/DataService';
import { strategiesService, type StrategyRecord } from '@/services/StrategiesService';
import { userService } from '@/services/UserService';
import { useAuthStore } from '@/stores/authStore';

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

  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [isStrategiesLoading, setIsStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<StrategyDraft>(createEmptyDraft);
  const [isCreatingStrategy, setIsCreatingStrategy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [enabledSymbols, setEnabledSymbols] = useState<string[]>([]);
  const [symbolIconByTicker, setSymbolIconByTicker] = useState<Record<string, string | null>>({});
  const [isSymbolsLoading, setIsSymbolsLoading] = useState(false);
  const [isSymbolsSaving, setIsSymbolsSaving] = useState(false);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const [strategyAuthors, setStrategyAuthors] = useState<Record<string, { displayName: string; avatarUrl: string | null }>>({});

  const routeState = useMemo(() => parseOrionRoute(location.pathname), [location.pathname]);
  const orionRouteKey = useMemo(() => location.pathname, [location.pathname]);
  const view = routeState.view;
  const marketplaceTab = routeState.marketplaceTab;
  const myStrategiesScreen = routeState.myStrategiesScreen;
  const selectedStrategyId = routeState.selectedStrategyId;
  const isMarketplace = view === 'marketplace';

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

      const authorIds = Array.from(new Set(records.map((item) => item.user_id).filter(Boolean)));
      if (authorIds.length === 0) {
        setStrategyAuthors({});
        return;
      }

      const profiles = await userService.listPublicProfiles(authorIds);
      const profileById = new Map(profiles.map((item) => [item.id, item]));
      const currentUserDisplayName =
        user?.raw?.user_metadata?.display_name
        || user?.raw?.user_metadata?.name
        || user?.email
        || 'User';
      const currentUserAvatar =
        typeof user?.raw?.user_metadata?.avatar_url === 'string'
          ? user.raw.user_metadata.avatar_url
          : null;

      const nextAuthors: Record<string, { displayName: string; avatarUrl: string | null }> = {};
      for (const strategy of records) {
        const profile = profileById.get(strategy.user_id);
        if (profile) {
          nextAuthors[strategy.id] = { displayName: profile.displayName, avatarUrl: profile.avatarUrl };
          continue;
        }
        if (strategy.user_id === user?.uid) {
          nextAuthors[strategy.id] = { displayName: String(currentUserDisplayName), avatarUrl: currentUserAvatar };
          continue;
        }
        nextAuthors[strategy.id] = { displayName: 'User', avatarUrl: null };
      }
      setStrategyAuthors(nextAuthors);
    } catch (err) {
      setStrategiesError(err instanceof Error ? err.message : 'Failed to load strategies');
    } finally {
      setIsStrategiesLoading(false);
    }
  }, [user?.email, user?.raw?.user_metadata?.avatar_url, user?.raw?.user_metadata?.display_name, user?.raw?.user_metadata?.name, user?.uid]);

  useEffect(() => {
    if (!isMarketplace || marketplaceTab !== 'my-strategies') return;
    void loadStrategies();
  }, [isMarketplace, marketplaceTab, loadStrategies]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedStrategyId) ?? null,
    [strategies, selectedStrategyId]
  );
  const isStrategyDetailView = isMarketplace && myStrategiesScreen === 'detail';
  const isSymbolsView = isMarketplace && myStrategiesScreen === 'symbols';
  const isNodesView = isMarketplace && myStrategiesScreen === 'nodes';
  const isCreateStrategyView = isMarketplace && myStrategiesScreen === 'create';
  const isMyStrategiesListView = isMarketplace && marketplaceTab === 'my-strategies' && myStrategiesScreen === 'list';

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

  const loadUserSymbols = useCallback(async (strategy: StrategyRecord) => {
    if (!user?.uid) return;
    const ownerTickers = strategy.symbols.map((item) => item.ticker.toUpperCase());
    const ownerTickerSet = new Set(ownerTickers);

    setIsSymbolsLoading(true);
    setSymbolsError(null);
    try {
      const result = await strategiesService.getStrategyUserEnabledSymbols(strategy.id);
      const next = (result ?? ownerTickers).filter((ticker) => ownerTickerSet.has(ticker.toUpperCase()));
      setEnabledSymbols(next);
    } catch (error) {
      setSymbolsError(error instanceof Error ? error.message : 'Failed to load symbols');
      setEnabledSymbols(ownerTickers);
    } finally {
      setIsSymbolsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!isSymbolsView || !selectedStrategy) return;
    void loadUserSymbols(selectedStrategy);
  }, [isSymbolsView, selectedStrategy, loadUserSymbols]);

  useEffect(() => {
    if (!isSymbolsView) return;
    let active = true;
    const loadCatalog = async () => {
      try {
        const rows = await dataService.loadSymbols();
        if (!active) return;
        const map: Record<string, string | null> = {};
        for (const item of rows) {
          const ticker = String(item.symbol ?? '').toUpperCase();
          if (!ticker) continue;
          map[ticker] = item.photo ?? item.icon_url ?? null;
        }
        setSymbolIconByTicker(map);
      } catch {
        if (active) setSymbolIconByTicker({});
      }
    };
    void loadCatalog();
    return () => {
      active = false;
    };
  }, [isSymbolsView]);

  const handleToggleSymbolEnabled = useCallback(async (ticker: string) => {
    if (!selectedStrategy || !user?.uid || isSymbolsSaving) return;

    const ownerTickerSet = new Set(selectedStrategy.symbols.map((item) => item.ticker.toUpperCase()));
    const normalized = ticker.toUpperCase();
    if (!ownerTickerSet.has(normalized)) return;

    const previous = enabledSymbols;
    const exists = previous.some((item) => item.toUpperCase() === normalized);
    const next = exists
      ? previous.filter((item) => item.toUpperCase() !== normalized)
      : [...previous, normalized];

    setEnabledSymbols(next);
    setIsSymbolsSaving(true);
    setSymbolsError(null);
    try {
      await strategiesService.upsertStrategyUserEnabledSymbols(selectedStrategy.id, next);
    } catch (error) {
      setEnabledSymbols(previous);
      setSymbolsError(error instanceof Error ? error.message : 'Failed to save symbols');
    } finally {
      setIsSymbolsSaving(false);
    }
  }, [enabledSymbols, isSymbolsSaving, selectedStrategy, user?.uid]);

  return (
    <>
      {!isNodesView && (
        <AppNavbar
          title={
            isCreateStrategyView
              ? 'New Strategy'
              : isSymbolsView && selectedStrategy
                ? `${selectedStrategy.name} · ${enabledSymbols.length}/${selectedStrategy.symbols.length}`
                : (isMarketplace ? 'Orion Marketplace' : 'Notifications')
          }
          left={
            isMarketplace ? (
              <button
                type="button"
                onClick={() => {
                  if (isCreateStrategyView) {
                    navigate('/orion/marketplace/my-strategies');
                    setCreateError(null);
                    return;
                  }
                  if (isStrategyDetailView) {
                    navigate('/orion/marketplace/my-strategies');
                    return;
                  }
                  if (isSymbolsView && selectedStrategyId) {
                    navigate(`/orion/marketplace/my-strategies/${encodeURIComponent(selectedStrategyId)}`);
                    return;
                  }
                  navigate('/orion');
                }}
                className="flex h-10 w-10 items-center justify-center text-2xl text-zinc-200"
                aria-label={isCreateStrategyView ? 'Close new strategy' : isStrategyDetailView ? 'Close strategy detail' : isSymbolsView ? 'Close symbols' : 'Close Orion marketplace'}
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
          right={
            isMarketplace
              ? (isCreateStrategyView || isStrategyDetailView || isSymbolsView || !isMyStrategiesListView
                ? null
                : (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateDraft(createEmptyDraft());
                      setCreateError(null);
                      navigate('/orion/marketplace/my-strategies/create');
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl text-zinc-100"
                    aria-label="Create strategy"
                  >
                    +
                  </button>
                ))
              : undefined
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
              strategyPhotoUrl={selectedStrategy?.photo_url ?? null}
              isOwner={selectedStrategy ? selectedStrategy.user_id === (user?.uid ?? '') : false}
              onDeleted={(deletedId) => {
                setStrategies((prev) => prev.filter((item) => item.id !== deletedId));
              }}
              onClose={() => navigate('/orion/marketplace/my-strategies')}
            />
          ) : isStrategyDetailView && selectedStrategy ? (
            <StrategyDetailView
              strategy={selectedStrategy}
              activeVersionLabel={null}
              isOwner={selectedStrategy.user_id === (user?.uid ?? '')}
              onOpenSymbols={() => navigate(`/orion/marketplace/my-strategies/${encodeURIComponent(selectedStrategy.id)}/symbols`)}
              onOpenNodes={() => navigate(`/orion/marketplace/my-strategies/${encodeURIComponent(selectedStrategy.id)}/nodes`)}
            />
          ) : isSymbolsView && selectedStrategy ? (
            <StrategySymbolsView
              strategy={selectedStrategy}
              enabledTickers={enabledSymbols}
              symbolIconByTicker={symbolIconByTicker}
              isLoading={isSymbolsLoading}
              isSaving={isSymbolsSaving}
              error={symbolsError}
              onToggleTicker={(ticker) => {
                void handleToggleSymbolEnabled(ticker);
              }}
              onRetry={() => {
                void loadUserSymbols(selectedStrategy);
              }}
            />
          ) : isMarketplace ? (
            <MarketplaceScreen
              tab={marketplaceTab}
              myStrategiesScreen={myStrategiesScreen === 'nodes' || myStrategiesScreen === 'symbols' ? 'list' : myStrategiesScreen}
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
              strategyAuthors={strategyAuthors}
            />
          ) : (
            <NotificationsScreen />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
