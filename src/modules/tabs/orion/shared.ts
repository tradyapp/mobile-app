export interface StrategyDraft {
  name: string;
  description: string;
  photoUrl: string | null;
}

export type MarketplaceTab = 'explore' | 'my-strategies';
export type MyStrategiesScreen = 'list' | 'create' | 'detail' | 'symbols' | 'webhook' | 'nodes';

export interface StrategyApp {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  icon: string;
  accent: string;
}

export const MARKETPLACE_APPS: StrategyApp[] = [
  { id: 'red-velvet', name: 'Red Velvet', subtitle: 'Estrategia de alta precisión', category: 'Momentum', icon: 'RV', accent: '#ef4444' },
  { id: 'green-twins', name: 'Green Twins', subtitle: 'Doble confirmación de tendencia', category: 'Trend', icon: 'GT', accent: '#22c55e' },
  { id: 'ronaldinho', name: 'Ronaldinho', subtitle: 'Jugadas maestras del mercado', category: 'Momentum', icon: 'RO', accent: '#f59e0b' },
  { id: 'stronger-green', name: 'Stronger Green', subtitle: 'Impulso alcista reforzado', category: 'Trend', icon: 'SG', accent: '#10b981' },
];

export const createEmptyDraft = (): StrategyDraft => ({
  name: '',
  description: '',
  photoUrl: null,
});
