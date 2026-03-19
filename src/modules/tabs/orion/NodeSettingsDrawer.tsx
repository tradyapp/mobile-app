'use client';

import { createPortal } from 'react-dom';
import AppDrawer from '@/components/uiux/AppDrawer';
import { type StrategyNodeVersionRecord } from '@/services/StrategiesService';

function BackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

interface NodeSettingsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  settingsPanel: 'menu' | 'versions';
  onSettingsPanelChange: (panel: 'menu' | 'versions') => void;
  isPreviewMode: boolean;
  isPublishingVersion: boolean;
  previewVersion: StrategyNodeVersionRecord | null;
  onActivateButtonClick: () => Promise<void>;
  onOpenVersions: () => void;
  isNodeVersionsLoading: boolean;
  nodeVersions: StrategyNodeVersionRecord[];
  onEnterPreviewVersion: (version: StrategyNodeVersionRecord) => void;
  nodeVersionsError: string | null;
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
}: NodeSettingsDrawerProps) {
  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={settingsPanel === 'menu' ? 'Node Settings' : 'Versiones anteriores'}
      height="full"
      showHeader
      headerLeft={settingsPanel === 'versions' ? (
        <button
          type="button"
          onClick={() => onSettingsPanelChange('menu')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300"
          aria-label="Volver"
        >
          <BackIcon />
        </button>
      ) : null}
    >
      <div className="pb-4">
        {settingsPanel === 'menu' ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void onActivateButtonClick()}
              disabled={isPublishingVersion || (isPreviewMode && Boolean(previewVersion?.is_active))}
              className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left disabled:opacity-50"
            >
              <span className="text-sm font-medium text-zinc-100">Activar version</span>
              <span className="text-xs text-zinc-400">
                {isPublishingVersion
                  ? 'Activando...'
                  : isPreviewMode
                    ? (previewVersion?.is_active ? 'Ya activa' : 'Activar esta versión')
                    : 'Publicar y activar'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenVersions}
              className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left"
            >
              <span className="text-sm font-medium text-zinc-100">Versiones anteriores</span>
              <span className="text-lg leading-none text-zinc-400">›</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {isNodeVersionsLoading ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                Loading versions...
              </div>
            ) : nodeVersions.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
                No hay versiones anteriores.
              </div>
            ) : (
              <div className="space-y-2">
                {nodeVersions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => onEnterPreviewVersion(version)}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">v{version.version_number} · {version.name}</p>
                      <p className="truncate text-[11px] text-zinc-500">{new Date(version.created_at).toLocaleString('en-US')}</p>
                    </div>
                    {version.is_active && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-medium text-emerald-300">Active</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {nodeVersionsError && (
          <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {nodeVersionsError}
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
