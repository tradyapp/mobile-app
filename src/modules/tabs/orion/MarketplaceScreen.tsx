'use client';

import { type StrategyRecord } from '@/services/StrategiesService';
import StrategyFormScreen from '@/modules/tabs/orion/StrategyFormScreen';
import { MARKETPLACE_APPS, type MarketplaceTab, type MyStrategiesScreen, type StrategyDraft } from '@/modules/tabs/orion/shared';

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

export default function MarketplaceScreen({
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
  const isCreateScreen = tab === 'my-strategies' && myStrategiesScreen === 'create';

  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      {!isCreateScreen && (
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
      )}

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
                  You have no strategies yet. Tap <span className="font-medium text-zinc-200">+</span> to add your first one.
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
              draft={createDraft}
              onChangeDraft={onChangeCreateDraft}
              isSubmitting={isCreatingStrategy}
              error={createError}
              submitLabel="Create Strategy"
              onSubmit={onCreate}
            />
          )}
        </>
      )}
    </div>
  );
}
