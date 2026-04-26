"use client";
import { useBrokerStore } from "@/stores/brokerStore";
import BrokerAccountsScreen from "@/modules/broker/BrokerAccountsScreen";
import BrokerAccountSummaryScreen from "@/modules/broker/BrokerAccountSummaryScreen";
import BrokerTradeScreen from "@/modules/broker/BrokerTradeScreen";
import BrokerSettingsScreen from "@/modules/broker/BrokerSettingsScreen";

export default function TradeTab() {
  const view = useBrokerStore((s) => s.view);

  switch (view.kind) {
    case "accounts":
      return <BrokerAccountsScreen />;
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
      return <BrokerAccountsScreen />;
  }
}
