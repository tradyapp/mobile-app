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
    <div className="relative w-[170px] sm:w-[210px]">
      <select
        value={selectedAccountId}
        onChange={(e) => handleAccountChange(e.target.value)}
        disabled={accounts.length === 0}
        className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 pl-3 pr-8 text-sm text-zinc-100 appearance-none focus:outline-none disabled:opacity-60"
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
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
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
