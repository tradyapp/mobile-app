import { create } from "zustand";
import type { BrokerAccount } from "@/services/BrokerService";

export type BrokerView =
  | { kind: "accounts" }
  | { kind: "account-summary"; accountId: string; tab: BrokerSummaryTab }
  | { kind: "trade"; accountId: string; replaceOrderId?: string }
  | { kind: "settings"; accountId: string; option: BrokerSettingsOption }
  | { kind: "order-detail"; accountId: string; orderId: string };

export type BrokerSummaryTab = "summary" | "positions" | "orders" | "transactions";
export type BrokerSettingsOption = "menu" | "rename" | "deposit" | "withdraw" | "delete";

interface BrokerState {
  selectedAccountId: string | null;
  accounts: BrokerAccount[];
  view: BrokerView;
  refreshKey: number;

  setAccounts: (accounts: BrokerAccount[]) => void;
  selectAccount: (accountId: string | null) => void;
  navigate: (view: BrokerView) => void;
  goBack: () => void;
  bumpRefresh: () => void;
}

export const useBrokerStore = create<BrokerState>((set, get) => ({
  selectedAccountId: null,
  accounts: [],
  view: { kind: "accounts" },
  refreshKey: 0,

  setAccounts: (accounts) => {
    const current = get().selectedAccountId;
    const stillExists = accounts.some((a) => a.id === current);
    set({
      accounts,
      selectedAccountId: stillExists ? current : (accounts[0]?.id ?? null),
    });
  },

  selectAccount: (accountId) => set({ selectedAccountId: accountId }),

  navigate: (view) => {
    const updates: Partial<BrokerState> = { view };
    if ("accountId" in view) updates.selectedAccountId = view.accountId;
    set(updates);
  },

  goBack: () => {
    const view = get().view;
    if (view.kind === "accounts") return;
    if (view.kind === "account-summary") {
      set({ view: { kind: "accounts" } });
      return;
    }
    if (view.kind === "trade" || view.kind === "settings" || view.kind === "order-detail") {
      set({
        view: { kind: "account-summary", accountId: view.accountId, tab: "summary" },
      });
    }
  },

  bumpRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));
