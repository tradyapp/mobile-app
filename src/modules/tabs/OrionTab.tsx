/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { BlockTitle, List, ListItem } from 'konsta/react';
import { useEffect, useMemo, useState } from 'react';
import AppNavbar from '@/components/AppNavbar';
import CogIcon from '@/components/icons/CogIcon';

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

function BackArrow() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function MarketplaceScreen() {
  const [tab, setTab] = useState<'explore' | 'my-strategies'>('explore');
  const categories = [...new Set(MARKETPLACE_APPS.map((item) => item.category))];
  const myStrategies = MARKETPLACE_APPS.slice(0, 3);

  return (
    <div className="mx-auto max-w-xl px-4 pb-24">
      <div className="mt-3 grid grid-cols-2 rounded-xl bg-zinc-900 p-1">
        <button
          type="button"
          onClick={() => setTab('explore')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === 'explore' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
        >
          Explore
        </button>
        <button
          type="button"
          onClick={() => setTab('my-strategies')}
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
        <div className="mt-4 space-y-3">
          {myStrategies.map((app) => (
            <article key={app.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: app.accent }}
                  >
                    {app.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{app.name}</h4>
                    <p className="text-xs text-zinc-400">{app.subtitle}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                  Enabled
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrionTab() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [view, setView] = useState<'notifications' | 'marketplace'>('notifications');
  const groupedNotifications = useMemo(() => groupByDate(notifications), [notifications]);
  const isMarketplace = view === 'marketplace';

  useEffect(() => {
    setIsClient(true);
    setNotifications(generateMockNotifications());
  }, []);

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
              aria-label="Back to notifications"
            >
              <BackArrow />
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
        <MarketplaceScreen />
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
    </>
  );
}
