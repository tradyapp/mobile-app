"use client";
import { useEffect, useState } from "react";
import { Block, Button } from "konsta/react";
import { AnimatePresence, motion } from "framer-motion";
import { useBrokerStore } from "@/stores/brokerStore";
import BrokerAccountSummaryScreen from "@/modules/broker/BrokerAccountSummaryScreen";
import BrokerAssetTypePickerScreen from "@/modules/broker/BrokerAssetTypePickerScreen";
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

  let content: React.ReactNode;
  let viewKey = view.kind;

  switch (view.kind) {
    case "accounts":
      if (loadingActiveAccount) {
        content = <TradeLoadingSkeleton />;
        viewKey = "accounts-loading";
        break;
      }
      if (!selectedAccountId) {
        content = <TradeEmptyState message="Create or select a trading account from your profile drawer to start trading." />;
        break;
      }
      content = <BrokerAccountSummaryScreen accountId={selectedAccountId} tab="summary" />;
      viewKey = `accounts-${selectedAccountId}`;
      break;
    case "account-summary":
      content = <BrokerAccountSummaryScreen accountId={view.accountId} tab={view.tab} />;
      viewKey = `account-summary-${view.accountId}-${view.tab}`;
      break;
    case "asset-picker":
      content = <BrokerAssetTypePickerScreen accountId={view.accountId} />;
      viewKey = `asset-picker-${view.accountId}`;
      break;
    case "trade":
      content = <BrokerTradeScreen accountId={view.accountId} assetType={view.assetType} />;
      viewKey = `trade-${view.accountId}-${view.assetType}`;
      break;
    case "settings":
      content = <BrokerSettingsScreen accountId={view.accountId} option={view.option} />;
      viewKey = `settings-${view.accountId}-${view.option}`;
      break;
    case "order-detail":
      content = <BrokerAccountSummaryScreen accountId={view.accountId} tab="orders" />;
      viewKey = `order-detail-${view.accountId}-${view.orderId}`;
      break;
    default:
      if (!selectedAccountId) {
        content = <TradeEmptyState message="Create or select a trading account from your profile drawer to start trading." />;
        viewKey = "empty";
        break;
      }
      content = <BrokerAccountSummaryScreen accountId={selectedAccountId} tab="summary" />;
      viewKey = `default-${selectedAccountId}`;
  }

  return (
    <TradeViewport>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={viewKey}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </TradeViewport>
  );
}

function TradeViewport({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 top-0 bottom-0 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+88px)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
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

function TradeLoadingSkeleton() {
  return (
    <>
      <AppNavbar title="Trade" />
      <Block className="mb-2">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] px-4 pt-4 pb-3 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <div className="flex min-h-[136px] items-start justify-between gap-4">
            <div className="w-[50%] min-w-0">
              <div className="h-3 w-24 rounded-full bg-white/8 animate-pulse" />
              <div className="mt-3 h-9 w-40 rounded-full bg-white/10 animate-pulse" />
              <div className="mt-3 h-3 w-32 rounded-full bg-white/8 animate-pulse" />
            </div>
            <div className="w-[46%] pt-1">
              <div className="h-24 w-full rounded-2xl bg-white/6 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 border-t border-white/8 pt-3">
            <div className="h-10 rounded-2xl bg-white/6 animate-pulse" />
          </div>
        </div>
      </Block>

      <Block className="mb-1">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1 grid grid-cols-4 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded-xl bg-white/6 animate-pulse" />
          ))}
        </div>
      </Block>

      <Block>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-28 rounded-full bg-white/8 animate-pulse" />
          <div className="h-3 w-20 rounded-full bg-white/6 animate-pulse" />
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-transparent px-4 py-3 shadow-lg shadow-black/10">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-white/6 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-24 rounded-full bg-white/8 animate-pulse" />
                  <div className="mt-2 h-3 w-32 rounded-full bg-white/6 animate-pulse" />
                </div>
                <div className="h-4 w-14 rounded-full bg-white/8 animate-pulse shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-24 rounded-full bg-white/8 animate-pulse" />
          <div className="h-3 w-20 rounded-full bg-white/6 animate-pulse" />
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-transparent px-4 py-3 shadow-lg shadow-black/10">
              <div className="h-4 w-32 rounded-full bg-white/8 animate-pulse" />
              <div className="mt-2 h-3 w-24 rounded-full bg-white/6 animate-pulse" />
            </div>
          ))}
        </div>
      </Block>
    </>
  );
}
