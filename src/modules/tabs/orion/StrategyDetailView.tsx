'use client';

import { List, ListItem, Toggle } from 'konsta/react';
import { useState } from 'react';
import { type StrategyRecord } from '@/services/StrategiesService';

interface StrategyDetailViewProps {
  strategy: StrategyRecord;
  onOpenNodes: () => void;
}

export default function StrategyDetailView({ strategy, onOpenNodes }: StrategyDetailViewProps) {
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
            <Toggle
              checked={isLive}
              onChange={() => setIsLive((prev) => !prev)}
            />
          )}
        />
      </List>
    </div>
  );
}
