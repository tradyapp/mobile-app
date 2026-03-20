'use client';

import { type CSSProperties } from 'react';
import CogIcon from '@/components/icons/CogIcon';

interface OrionNodesHeaderProps {
  strategyName: string;
  strategyPhotoUrl?: string | null;
  strategyInitials: string;
  subtitle: string;
  executionStatusText: string | null;
  executionStatusTone: 'running' | 'completed' | 'failed' | null;
  safeHorizontalInsetStyle: CSSProperties;
  onClose: () => void;
  onAutoLayout?: () => void;
  onOpenSettings: () => void;
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function OrionNodesHeader({
  strategyName,
  strategyPhotoUrl = null,
  strategyInitials,
  subtitle,
  executionStatusText,
  executionStatusTone,
  safeHorizontalInsetStyle,
  onClose,
  onAutoLayout,
  onOpenSettings,
}: OrionNodesHeaderProps) {
  return (
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
          <p className="text-xs text-zinc-500">{subtitle}</p>
          {executionStatusText && (
            <p className={`text-[11px] ${executionStatusTone === 'running' ? 'text-blue-300' : executionStatusTone === 'completed' ? 'text-emerald-300' : 'text-red-300'}`}>
              {executionStatusText}
            </p>
          )}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {onAutoLayout && (
          <button
            type="button"
            onClick={onAutoLayout}
            className="inline-flex h-10 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-3 text-[11px] font-semibold text-zinc-100"
            aria-label="Auto organize nodes"
            title="Auto organize nodes"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m16 22-1-4" />
              <path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1" />
              <path d="M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z" />
              <path d="m8 22 1-4" />
            </svg>
            Tidy
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-100"
          aria-label="Open nodes settings"
        >
          <CogIcon />
        </button>
      </div>
    </header>
  );
}
