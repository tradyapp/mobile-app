'use client';

import { Toggle } from 'konsta/react';
import { useState } from 'react';
import { type StrategyRecord } from '@/services/StrategiesService';

interface StrategyDetailViewProps {
  strategy: StrategyRecord;
  onOpenNodes: () => void;
  onOpenSymbols: () => void;
  activeVersionLabel: string | null;
  isOwner: boolean;
}

function DetailRow({
  label,
  onClick,
  disabled = false,
  after,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  after?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-500"
    >
      <span>{label}</span>
      <span className="text-xs text-zinc-500">{after ?? '›'}</span>
    </button>
  );
}

export default function StrategyDetailView({ strategy, onOpenNodes, onOpenSymbols, activeVersionLabel, isOwner }: StrategyDetailViewProps) {
  const [isLive, setIsLive] = useState(false);
  const initials = strategy.name
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
            {strategy.photo_url ? (
              <img src={strategy.photo_url} alt={strategy.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base font-semibold text-zinc-300">
                {initials || 'ST'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-zinc-100">{strategy.name}</p>
            <p className="truncate text-sm text-zinc-500">{activeVersionLabel ?? 'Sin versión activa'}</p>
          </div>
          <div className="ml-auto">
            <Toggle
              checked={isLive}
              onChange={() => setIsLive((prev) => !prev)}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <DetailRow label="Symbols" onClick={onOpenSymbols} />
        <div className="border-t border-zinc-800" />
        <DetailRow label="WebHook" after="Soon" />
        {isOwner && (
          <>
            <div className="border-t border-zinc-800" />
            <DetailRow label="Nodes" onClick={onOpenNodes} />
          </>
        )}
      </div>
    </div>
  );
}
