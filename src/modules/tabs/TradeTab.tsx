"use client";
import { useEffect, useState } from "react";
import { Block, Button } from "konsta/react";
import { useBrokerStore } from "@/stores/brokerStore";
import BrokerAccountSummaryScreen from "@/modules/broker/BrokerAccountSummaryScreen";
import BrokerTradeScreen from "@/modules/broker/BrokerTradeScreen";
import BrokerSettingsScreen from "@/modules/broker/BrokerSettingsScreen";
import AppNavbar from "@/components/AppNavbar";
import { brokerService } from "@/services/BrokerService";

export default function TradeTab() {
  const view = useBrokerStore((s) => s.view);
  const selectedAccountId = useBrokerStore((s) => s.selectedAccountId);
  const accounts = useBrokerStore((s) => s.accounts);
  const setAccounts = useBrokerStore((s) => s.setAccounts);
  const navigate = useBrokerStore((s) => s.navigate);
  const [loadingActiveAccount, setLoadingActiveAccount] = useState(false);

  useEffect(() => {
    if (selectedAccountId || accounts.length > 0) return;
    let cancelled = false;
    setLoadingActiveAccount(true);

    brokerService
      .listAccounts()
      .then((list) => {
        if (cancelled) return;
        setAccounts(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingActiveAccount(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accounts.length, selectedAccountId, setAccounts]);

  useEffect(() => {
    if (!selectedAccountId) return;
    if (view.kind === "accounts") {
      navigate({ kind: "account-summary", accountId: selectedAccountId, tab: "summary" });
      return;
    }
    if (view.kind === "account-summary" && view.accountId !== selectedAccountId) {
      navigate({ kind: "account-summary", accountId: selectedAccountId, tab: view.tab });
    }
  }, [navigate, selectedAccountId, view]);

  switch (view.kind) {
    case "accounts":
      if (loadingActiveAccount) {
        return <TradeEmptyState message="Loading your trading account..." />;
      }
      if (!selectedAccountId) {
        return (
          <TradeEmptyState message="Create or select a trading account from your profile drawer to start trading." />
        );
      }
      return <BrokerAccountSummaryScreen accountId={selectedAccountId} tab="summary" />;
    case "account-summary":
      return <BrokerAccountSummaryScreen accountId={view.accountId} tab={view.tab} />;
    case "trade":
      return <BrokerTradeScreen accountId={view.accountId} />;
    case "settings":
      return <BrokerSettingsScreen accountId={view.accountId} option={view.option} />;
    case "order-detail":
      // Order detail not implemented in Phase 1 MVP — fall through to summary.
      return <BrokerAccountSummaryScreen accountId={view.accountId} tab="orders" />;
    default:
      if (!selectedAccountId) {
        return (
          <TradeEmptyState message="Create or select a trading account from your profile drawer to start trading." />
        );
      }
      return <BrokerAccountSummaryScreen accountId={selectedAccountId} tab="summary" />;
  }
}

function TradeEmptyState({ message }: { message: string }) {
  return (
    <>
      <AppNavbar title="Trade" />
      <Block>
        <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_36%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.98))] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h3" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">No active trading account</h2>
          <p className="mt-2 text-sm text-zinc-300">{message}</p>
          <p className="mt-2 text-xs text-zinc-500">
            Open your profile avatar, go to Trading Accounts, and choose the account you want to use here.
          </p>
          <Button className="mt-5" disabled>
            Select account in profile
          </Button>
        </div>
      </Block>
    </>
  );
}
