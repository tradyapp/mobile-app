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
import { parseOrionRoute } from '@/modules/tabs/orion/routeState';
import { createEmptyDraft, type StrategyDraft } from '@/modules/tabs/orion/shared';
import { strategiesService, type StrategyRecord } from '@/services/StrategiesService';
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

  useEffect(() => {
    if (!isStrategyDetailView || !selectedStrategyId) return;
    navigate(`/orion/marketplace/my-strategies/${encodeURIComponent(selectedStrategyId)}/nodes`, { replace: true });
  }, [isStrategyDetailView, selectedStrategyId]);

  const handleOpenStrategy = (strategy: StrategyRecord) => {
    navigate(`/orion/marketplace/my-strategies/${encodeURIComponent(strategy.id)}/nodes`);
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
          title={isMarketplace ? 'Orion Marketplace' : 'Notifications'}
          left={
            isMarketplace ? (
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
          right={
            isMarketplace ? (
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
            ) : undefined
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
              onClose={() => navigate('/orion/marketplace/my-strategies')}
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
            <NotificationsScreen />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
