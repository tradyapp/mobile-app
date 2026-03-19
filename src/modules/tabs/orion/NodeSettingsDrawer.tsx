'use client';

import { createPortal } from 'react-dom';
import { List, ListItem, Toggle } from 'konsta/react';
import { useMemo, useState } from 'react';
import AppDrawer from '@/components/uiux/AppDrawer';
import { type StrategyNodeVersionRecord, type StrategySymbolMarket, type StrategyTrackedSymbol } from '@/services/StrategiesService';

function BackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function SymbolIcon({ iconUrl, ticker }: { iconUrl: string | null; ticker: string }) {
  if (iconUrl) {
    return <img src={iconUrl} alt={ticker} className="h-8 w-8 rounded-md object-cover" />;
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-semibold text-zinc-300">
      {ticker.slice(0, 3)}
    </div>
  );
}

function SymbolRow({
  ticker,
  name,
  iconUrl,
  selected,
  onToggle,
  disabled,
}: {
  ticker: string;
  name: string;
  iconUrl: string | null;
  selected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
      <SymbolIcon iconUrl={iconUrl} ticker={ticker} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-100">{ticker}</p>
        <p className="truncate text-xs text-zinc-400">{name}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none ${selected ? 'border-red-900 bg-red-950/60 text-red-300' : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'} disabled:opacity-60`}
        aria-label={selected ? `Remove ${ticker}` : `Add ${ticker}`}
      >
        {selected ? '−' : '+'}
      </button>
    </div>
  );
}

export interface StrategySymbolCatalogItem {
  ticker: string;
  name: string;
  icon_url: string | null;
  market: StrategySymbolMarket;
}

interface NodeSettingsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  settingsPanel: 'menu' | 'versions' | 'symbols' | 'symbols-library' | 'danger';
  onSettingsPanelChange: (panel: 'menu' | 'versions' | 'symbols' | 'symbols-library' | 'danger') => void;
  isPreviewMode: boolean;
  isPublishingVersion: boolean;
  previewVersion: StrategyNodeVersionRecord | null;
  onActivateButtonClick: () => Promise<void>;
  onOpenVersions: () => void;
  isNodeVersionsLoading: boolean;
  nodeVersions: StrategyNodeVersionRecord[];
  onEnterPreviewVersion: (version: StrategyNodeVersionRecord) => void;
  nodeVersionsError: string | null;
  isLive: boolean;
  onToggleLive: () => void;
  onOpenBacktesting: () => void;
  isOwner: boolean;
  trackedSymbols: StrategyTrackedSymbol[];
  availableSymbols: StrategySymbolCatalogItem[];
  isSymbolsLoading: boolean;
  isSymbolsSaving: boolean;
  symbolsError: string | null;
  onOpenSymbols: () => void;
  onOpenSymbolsLibrary: () => void;
  onRetryLoadSymbols: () => void;
  onToggleSymbol: (symbol: StrategySymbolCatalogItem | StrategyTrackedSymbol) => void;
  strategyName: string;
  isDeletingStrategy: boolean;
  onDeleteStrategyRequest: () => void;
}

export function NodeSettingsDrawer({
  isOpen,
  onOpenChange,
  settingsPanel,
  onSettingsPanelChange,
  isPreviewMode,
  isPublishingVersion,
  previewVersion,
  onActivateButtonClick,
  onOpenVersions,
  isNodeVersionsLoading,
  nodeVersions,
  onEnterPreviewVersion,
  nodeVersionsError,
  isLive,
  onToggleLive,
  onOpenBacktesting,
  isOwner,
  trackedSymbols,
  availableSymbols,
  isSymbolsLoading,
  isSymbolsSaving,
  symbolsError,
  onOpenSymbols,
  onOpenSymbolsLibrary,
  onRetryLoadSymbols,
  onToggleSymbol,
  strategyName,
  isDeletingStrategy,
  onDeleteStrategyRequest,
}: NodeSettingsDrawerProps) {
  const [activeMarketFilter, setActiveMarketFilter] = useState<'ALL' | StrategySymbolMarket>('ALL');

  const selectedTickerSet = useMemo(
    () => new Set(trackedSymbols.map((item) => item.ticker.toUpperCase())),
    [trackedSymbols]
  );

  const visibleSymbolCatalog = useMemo(() => {
    if (activeMarketFilter === 'ALL') return availableSymbols;
    return availableSymbols.filter((item) => item.market === activeMarketFilter);
  }, [activeMarketFilter, availableSymbols]);

  const title =
    settingsPanel === 'menu'
      ? 'Node Settings'
      : settingsPanel === 'versions'
        ? 'Versiones anteriores'
        : settingsPanel === 'danger'
          ? 'Danger Zone'
        : settingsPanel === 'symbols'
          ? 'Symbols'
          : 'Add Symbols';

  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      height="full"
      showHeader
      headerLeft={settingsPanel === 'menu' ? null : (
        <button
          type="button"
          onClick={() => onSettingsPanelChange(settingsPanel === 'symbols-library' ? 'symbols' : 'menu')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300"
          aria-label="Volver"
        >
          <BackIcon />
        </button>
      )}
    >
      <div className="pb-4">
        {settingsPanel === 'menu' && (
          <div className="space-y-4">
            <List strong className="overflow-hidden rounded-xl">
              <ListItem
                title="Live"
                after={(
                  <Toggle
                    checked={isLive}
                    onChange={onToggleLive}
                  />
                )}
              />
              <ListItem
                link
                title="Back Testing"
                after={<span className="text-[11px] text-zinc-500">Soon</span>}
                onClick={onOpenBacktesting}
              />
              <ListItem
                link
                title="Symbols"
                after={<span className="text-[11px] text-zinc-500">{trackedSymbols.length}</span>}
                onClick={onOpenSymbols}
                disabled={!isOwner}
              />
              <ListItem
                link
                title="Activar version"
                after={(
                  <span className="text-[11px] text-zinc-500">
                    {isPublishingVersion
                      ? 'Activando...'
                      : isPreviewMode
                        ? (previewVersion?.is_active ? 'Ya activa' : 'Activar esta versión')
                        : 'Publicar y activar'}
                  </span>
                )}
                onClick={() => void onActivateButtonClick()}
                disabled={isPublishingVersion || (isPreviewMode && Boolean(previewVersion?.is_active))}
              />
              <ListItem
                link
                title="Versiones anteriores"
                onClick={onOpenVersions}
              />
              {isOwner && (
                <ListItem
                  link
                  title={<span className="text-red-300">Danger Zone</span>}
                  onClick={() => onSettingsPanelChange('danger')}
                />
              )}
            </List>
          </div>
        )}

        {settingsPanel === 'versions' && (
          <div>
            {isNodeVersionsLoading ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                Loading versions...
              </div>
            ) : nodeVersions.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                No hay versiones anteriores.
              </div>
            ) : (
              <List strong className="overflow-hidden rounded-xl">
                {nodeVersions.map((version) => (
                  <ListItem
                    key={version.id}
                    link
                    title={`v${version.version_number} · ${version.name}`}
                    subtitle={new Date(version.created_at).toLocaleString('en-US')}
                    after={
                      version.is_active ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-medium text-emerald-300">Active</span>
                      ) : undefined
                    }
                    onClick={() => onEnterPreviewVersion(version)}
                  />
                ))}
              </List>
            )}
          </div>
        )}

        {settingsPanel === 'symbols' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onOpenSymbolsLibrary}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100"
              disabled={!isOwner}
            >
              Add Symbols
            </button>

            {trackedSymbols.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-4 text-sm text-zinc-400">
                No symbols configured for this strategy.
              </div>
            ) : (
              <div className="space-y-2">
                {trackedSymbols.map((item) => (
                  <SymbolRow
                    key={item.ticker}
                    ticker={item.ticker}
                    name={item.name}
                    iconUrl={item.icon_url}
                    selected
                    onToggle={() => onToggleSymbol(item)}
                    disabled={isSymbolsSaving || !isOwner}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {settingsPanel === 'symbols-library' && (
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'STOCKS', label: 'Stocks' },
                { key: 'FOREX', label: 'Forex' },
                { key: 'CRYPTO', label: 'Crypto' },
              ].map((filter) => {
                const isActive = activeMarketFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveMarketFilter(filter.key as 'ALL' | StrategySymbolMarket)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${isActive ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-300'}`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {isSymbolsLoading ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                Loading symbols...
              </div>
            ) : visibleSymbolCatalog.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                No symbols available.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleSymbolCatalog.map((item) => {
                  const selected = selectedTickerSet.has(item.ticker.toUpperCase());
                  return (
                    <SymbolRow
                      key={`${item.market}-${item.ticker}`}
                      ticker={item.ticker}
                      name={item.name}
                      iconUrl={item.icon_url}
                      selected={selected}
                      onToggle={() => onToggleSymbol(item)}
                      disabled={isSymbolsSaving || !isOwner}
                    />
                  );
                })}
              </div>
            )}

            {!isSymbolsLoading && (
              <button
                type="button"
                onClick={onRetryLoadSymbols}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100"
              >
                Reload Symbols
              </button>
            )}
          </div>
        )}

        {settingsPanel === 'danger' && (
          <div className="rounded-xl border border-red-900/70 bg-red-950/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-red-300">Danger Zone</p>
            <p className="mt-1 text-xs text-red-200/80">Eliminar la estrategia y todos sus datos asociados.</p>
            <button
              type="button"
              onClick={onDeleteStrategyRequest}
              disabled={isDeletingStrategy}
              className="mt-3 w-full rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-300 disabled:opacity-60"
            >
              {isDeletingStrategy ? 'Eliminando...' : `Delete "${strategyName}"`}
            </button>
          </div>
        )}

        {(!isOwner && settingsPanel === 'menu') && (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
            Solo el dueño de la estrategia puede editar Symbols.
          </div>
        )}

        {(nodeVersionsError || symbolsError) && (
          <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {nodeVersionsError || symbolsError}
          </div>
        )}
      </div>
    </AppDrawer>
  );
}

interface VersionNameDialogProps {
  isOpen: boolean;
  versionNameInput: string;
  onVersionNameInputChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isPublishingVersion: boolean;
}

export function VersionNameDialog({
  isOpen,
  versionNameInput,
  onVersionNameInputChange,
  onClose,
  onConfirm,
  isPublishingVersion,
}: VersionNameDialogProps) {
  if (typeof window === 'undefined' || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] pointer-events-none">
      <div className="pointer-events-auto">
        <button
          type="button"
          className="absolute inset-0 bg-black/70"
          onClick={onClose}
          aria-label="Close version name dialog"
        />
        <div className="absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-sm font-semibold text-white">Activar version</h3>
          <p className="mt-1 text-xs text-zinc-400">Nombre de la nueva versión</p>
          <input
            type="text"
            value={versionNameInput}
            onChange={(event) => onVersionNameInputChange(event.target.value)}
            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={isPublishingVersion}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50"
            >
              {isPublishingVersion ? 'Activando...' : 'Activar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
