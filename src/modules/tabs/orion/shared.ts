export interface StrategyDraft {
  name: string;
  description: string;
  photoUrl: string | null;
}

export type MarketplaceTab = 'explore' | 'my-strategies';
export type MyStrategiesScreen = 'list' | 'create' | 'detail' | 'symbols' | 'nodes';

export interface StrategyApp {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  icon: string;
  accent: string;
}

export const MARKETPLACE_APPS: StrategyApp[] = [
  { id: 'breakout-hunter', name: 'Breakout Hunter', subtitle: 'Detecta rupturas con volumen', category: 'Momentum', icon: 'BH', accent: '#22c55e' },
  { id: 'mean-revert-pro', name: 'Mean Revert Pro', subtitle: 'Señales de reversión intradía', category: 'Mean Reversion', icon: 'MR', accent: '#60a5fa' },
  { id: 'trend-pulse', name: 'Trend Pulse', subtitle: 'Filtro de tendencia multi-timeframe', category: 'Trend', icon: 'TP', accent: '#f59e0b' },
  { id: 'squeeze-lab', name: 'Squeeze Lab', subtitle: 'Compresión y expansión de volatilidad', category: 'Volatility', icon: 'SQ', accent: '#a78bfa' },
  { id: 'session-edge', name: 'Session Edge', subtitle: 'Setups por sesión de mercado', category: 'Session', icon: 'SE', accent: '#14b8a6' },
  { id: 'news-shield', name: 'News Shield', subtitle: 'Bloquea entradas en eventos de alto impacto', category: 'Risk', icon: 'NS', accent: '#fb7185' },
];

export const createEmptyDraft = (): StrategyDraft => ({
  name: '',
  description: '',
  photoUrl: null,
});
