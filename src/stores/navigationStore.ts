import { create } from 'zustand';

type TabName = 'orion' | 'chart' | 'trade' | 'wallet' | 'learn' | 'search';

interface NavigationState {
  currentTab: TabName;
  setCurrentTab: (tab: TabName) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentTab: 'orion',
  setCurrentTab: (tab) => set({ currentTab: tab }),
}));
