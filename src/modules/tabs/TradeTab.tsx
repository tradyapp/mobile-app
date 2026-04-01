"use client";

import { useEffect, useMemo, useState } from "react";
import AppNavbar from "@/components/AppNavbar";
import { useAuthStore } from "@/stores/authStore";

interface TradingAccountData {
  id: string;
  name: string;
  amount: number;
  accountType?: "simulation";
  createdAt?: string;
}

export default function TradeTab() {
  const user = useAuthStore((state) => state.user);
  const [accounts, setAccounts] = useState<TradingAccountData[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const accountsStorageKey = useMemo(
    () => (user?.uid ? `trady_trading_accounts_${user.uid}` : null),
    [user?.uid]
  );
  const selectedStorageKey = useMemo(
    () => (user?.uid ? `trady_selected_trading_account_${user.uid}` : null),
    [user?.uid]
  );

  useEffect(() => {
    if (!accountsStorageKey) {
      setAccounts([]);
      setSelectedAccountId("");
      return;
    }
    try {
      const raw = localStorage.getItem(accountsStorageKey);
      const parsed = raw ? (JSON.parse(raw) as TradingAccountData[]) : [];
      const safeAccounts = Array.isArray(parsed) ? parsed : [];
      setAccounts(safeAccounts);

      const storedSelected = selectedStorageKey ? localStorage.getItem(selectedStorageKey) : null;
      const defaultId = safeAccounts[0]?.id ?? "";
      const nextSelected = storedSelected && safeAccounts.some((item) => item.id === storedSelected)
        ? storedSelected
        : defaultId;
      setSelectedAccountId(nextSelected);
      if (selectedStorageKey) {
        localStorage.setItem(selectedStorageKey, nextSelected);
      }
    } catch {
      setAccounts([]);
      setSelectedAccountId("");
    }
  }, [accountsStorageKey, selectedStorageKey]);

  const handleAccountChange = (value: string) => {
    setSelectedAccountId(value);
    if (selectedStorageKey) {
      localStorage.setItem(selectedStorageKey, value);
    }
  };

  const leftNode = (
    <div className="relative w-[190px] sm:w-[230px]">
      <span className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-zinc-800 p-1 text-zinc-300">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5m-18 0v9a2.25 2.25 0 0 0 2.25 2.25h12a2.25 2.25 0 0 0 2.25-2.25v-9m-18 0V6.75A2.25 2.25 0 0 1 4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v1.5m-11.25 4.5h3" />
        </svg>
      </span>
      <select
        value={selectedAccountId}
        onChange={(e) => handleAccountChange(e.target.value)}
        disabled={accounts.length === 0}
        className="h-10 w-full appearance-none rounded-full border border-zinc-700/80 bg-zinc-900/90 pl-10 pr-10 text-sm font-medium text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:text-zinc-500"
      >
        {accounts.length === 0 ? (
          <option value="">Sin cuentas</option>
        ) : (
          accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))
        )}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.1 1.02l-4.25 4.5a.75.75 0 0 1-1.1 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );

  return (
    <div>
      <AppNavbar left={leftNode} />
      <div className="p-4">
        <h1 className="text-xl font-bold text-white">Trade</h1>
      </div>
    </div>
  );
}
