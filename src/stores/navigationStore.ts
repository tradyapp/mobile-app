import { create } from 'zustand';

type TabName = 'orion' | 'chart' | 'trade' | 'wallet' | 'learn' | 'search';
const LAST_ROUTE_KEY = "trady_last_route";

interface NavigationState {
  currentTab: TabName;
  lastRoute: string;
  setCurrentTab: (tab: TabName) => void;
  setLastRoute: (route: string) => void;
}

const getInitialLastRoute = () => {
  if (typeof window === "undefined") return "/orion";
  return localStorage.getItem(LAST_ROUTE_KEY) || "/orion";
};

export const useNavigationStore = create<NavigationState>((set) => ({
  currentTab: 'orion',
  lastRoute: getInitialLastRoute(),
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setLastRoute: (route) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_ROUTE_KEY, route);
    }
    set({ lastRoute: route });
  },
}));
