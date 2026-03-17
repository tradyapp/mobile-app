import { create } from 'zustand';
import { Timeframe } from '@/services/StockDataService';

export type SymbolType = 'STOCK' | 'CRYPTO' | 'FOREX';

interface ChartStore {
  symbol: string;
  symbolName: string;
  symbolType: SymbolType;
  timeframe: Timeframe;
  setSymbol: (symbol: string, symbolType?: SymbolType, symbolName?: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
}

export const useChartStore = create<ChartStore>((set) => ({
  symbol: 'SPY',
  symbolName: 'SPDR S&P 500 ETF Trust',
  symbolType: 'STOCK',
  timeframe: 'h',

  setSymbol: (symbol, symbolType = 'STOCK', symbolName = '') => set({ symbol, symbolType, symbolName }),

  setTimeframe: (timeframe) => set({ timeframe }),
}));
