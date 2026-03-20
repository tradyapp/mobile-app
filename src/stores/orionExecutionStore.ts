import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrionExecutionState {
  selectedSymbolByStrategyId: Record<string, string>;
  setSymbolForStrategy: (strategyId: string, ticker: string) => void;
  clearSymbolForStrategy: (strategyId: string) => void;
}

export const useOrionExecutionStore = create<OrionExecutionState>()(
  persist(
    (set) => ({
      selectedSymbolByStrategyId: {},
      setSymbolForStrategy: (strategyId, ticker) =>
        set((state) => ({
          selectedSymbolByStrategyId: {
            ...state.selectedSymbolByStrategyId,
            [strategyId]: ticker,
          },
        })),
      clearSymbolForStrategy: (strategyId) =>
        set((state) => {
          if (!(strategyId in state.selectedSymbolByStrategyId)) return state;
          const next = { ...state.selectedSymbolByStrategyId };
          delete next[strategyId];
          return { selectedSymbolByStrategyId: next };
        }),
    }),
    {
      name: 'orion-execution-store-v1',
      partialize: (state) => ({
        selectedSymbolByStrategyId: state.selectedSymbolByStrategyId,
      }),
    }
  )
);
