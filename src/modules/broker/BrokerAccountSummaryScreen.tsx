"use client";
import { useEffect, useMemo, useState } from "react";
import { Block, BlockTitle, Button, Card, Segmented, SegmentedButton } from "konsta/react";
import AppNavbar from "@/components/AppNavbar";
import {
  brokerService,
  type BrokerAccount,
  type BrokerOrder,
  type BrokerPosition,
} from "@/services/BrokerService";
import { useBrokerStore, type BrokerSummaryTab } from "@/stores/brokerStore";
import BrokerSymbolImage from "./BrokerSymbolImage";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  pnlColor,
  relativeTime,
  sideColor,
  statusColor,
} from "./utils";

interface Props {
  accountId: string;
  tab: BrokerSummaryTab;
}

export default function BrokerAccountSummaryScreen({ accountId, tab }: Props) {
  const navigate = useBrokerStore((s) => s.navigate);
  const goBack = useBrokerStore((s) => s.goBack);
  const refreshKey = useBrokerStore((s) => s.refreshKey);
  const accounts = useBrokerStore((s) => s.accounts);

  const [account, setAccount] = useState<BrokerAccount | null>(
    () => accounts.find((a) => a.id === accountId) ?? null,
  );
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      brokerService.getAccount(accountId),
      brokerService.listPositions({ accountId }),
      brokerService.listOrders({ accountId, limit: 100 }),
    ])
      .then(([acc, pos, ords]) => {
        if (cancelled) return;
        setAccount(acc);
        setPositions(pos);
        setOrders(ords);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load account");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, refreshKey]);

  const activeOrders = useMemo(() => orders.filter((o) => o.status === "open"), [orders]);
  const historicalOrders = useMemo(
    () => orders.filter((o) => o.status !== "open"),
    [orders],
  );

  const totalUnrealized = useMemo(
    () =>
      positions.reduce((acc, p) => acc + (p.unrealized_pnl ?? 0), 0),
    [positions],
  );

  const equity = account ? Number(account.balance) +
    positions.reduce((acc, p) => acc + (p.market_value ?? p.cost_basis ?? 0), 0)
    : 0;

  const handleTabChange = (next: BrokerSummaryTab) => {
    navigate({ kind: "account-summary", accountId, tab: next });
  };

  const navbarLeft = (
    <button
      onClick={goBack}
      className="ml-2 flex items-center gap-1 text-sm text-emerald-400"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Accounts
    </button>
  );

  return (
    <>
      <AppNavbar title={account?.name ?? "Account"} left={navbarLeft} />

      {/* Balance card */}
      <Block strongIos insetIos>
        <div className="flex flex-col gap-1 py-2">
          <span className="text-xs uppercase tracking-wide text-zinc-400">Cash balance</span>
          <span className="text-3xl font-bold text-white">
            {account ? formatCurrency(account.balance) : "—"}
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-zinc-400">
            <span>
              Equity: <span className="text-zinc-200">{formatCurrency(equity)}</span>
            </span>
            <span>
              Unrealized:{" "}
              <span className={pnlColor(totalUnrealized)}>{formatCurrency(totalUnrealized)}</span>
            </span>
            <span>
              Positions: <span className="text-zinc-200">{positions.length}</span>
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              small
              onClick={() => navigate({ kind: "trade", accountId })}
            >
              New order
            </Button>
            <Button
              small
              outline
              onClick={() => navigate({ kind: "settings", accountId, option: "menu" })}
            >
              Settings
            </Button>
          </div>
        </div>
      </Block>

      {/* Sub-tabs */}
      <Block>
        <Segmented strong>
          <SegmentedButton active={tab === "summary"} onClick={() => handleTabChange("summary")}>
            Summary
          </SegmentedButton>
          <SegmentedButton active={tab === "positions"} onClick={() => handleTabChange("positions")}>
            Positions
          </SegmentedButton>
          <SegmentedButton active={tab === "orders"} onClick={() => handleTabChange("orders")}>
            Orders
          </SegmentedButton>
          <SegmentedButton active={tab === "history"} onClick={() => handleTabChange("history")}>
            History
          </SegmentedButton>
        </Segmented>
      </Block>

      {error && (
        <Block>
          <p className="text-sm text-rose-400">{error}</p>
        </Block>
      )}

      {loading && (
        <Block>
          <p className="py-6 text-center text-sm text-zinc-400">Loading...</p>
        </Block>
      )}

      {!loading && tab === "summary" && (
        <SummaryPane
          positions={positions}
          activeOrders={activeOrders}
          onSeeAllPositions={() => handleTabChange("positions")}
          onSeeAllOrders={() => handleTabChange("orders")}
        />
      )}

      {!loading && tab === "positions" && <PositionsPane positions={positions} />}

      {!loading && tab === "orders" && (
        <OrdersPane orders={activeOrders} emptyText="No open orders. Submit a new order to get started." />
      )}

      {!loading && tab === "history" && (
        <OrdersPane orders={historicalOrders} emptyText="No completed orders yet." />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function SummaryPane({
  positions,
  activeOrders,
  onSeeAllPositions,
  onSeeAllOrders,
}: {
  positions: BrokerPosition[];
  activeOrders: BrokerOrder[];
  onSeeAllPositions: () => void;
  onSeeAllOrders: () => void;
}) {
  const top = positions.slice(0, 3);
  return (
    <>
      <Block>
        <BlockTitle>
          <div className="flex items-center justify-between">
            <span>Top positions</span>
            {positions.length > 3 && (
              <button onClick={onSeeAllPositions} className="text-xs text-emerald-400">
                View all ({positions.length})
              </button>
            )}
          </div>
        </BlockTitle>
        {top.length === 0 ? (
          <p className="py-3 text-sm text-zinc-400">No open positions.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {top.map((p) => (
              <PositionRow key={p.id} position={p} />
            ))}
          </div>
        )}
      </Block>

      <Block>
        <BlockTitle>
          <div className="flex items-center justify-between">
            <span>Open orders</span>
            {activeOrders.length > 3 && (
              <button onClick={onSeeAllOrders} className="text-xs text-emerald-400">
                View all ({activeOrders.length})
              </button>
            )}
          </div>
        </BlockTitle>
        {activeOrders.length === 0 ? (
          <p className="py-3 text-sm text-zinc-400">No open orders.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeOrders.slice(0, 3).map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </Block>
    </>
  );
}

function PositionsPane({ positions }: { positions: BrokerPosition[] }) {
  if (positions.length === 0) {
    return (
      <Block>
        <p className="py-6 text-center text-sm text-zinc-400">No open positions yet.</p>
      </Block>
    );
  }
  return (
    <Block>
      <div className="flex flex-col gap-2">
        {positions.map((p) => (
          <PositionRow key={p.id} position={p} />
        ))}
      </div>
    </Block>
  );
}

function OrdersPane({
  orders,
  emptyText,
}: {
  orders: BrokerOrder[];
  emptyText: string;
}) {
  if (orders.length === 0) {
    return (
      <Block>
        <p className="py-6 text-center text-sm text-zinc-400">{emptyText}</p>
      </Block>
    );
  }
  return (
    <Block>
      <div className="flex flex-col gap-2">
        {orders.map((o) => (
          <OrderRow key={o.id} order={o} />
        ))}
      </div>
    </Block>
  );
}

// ---------------------------------------------------------------------------

function PositionRow({ position }: { position: BrokerPosition }) {
  return (
    <Card className="!m-0">
      <div className="flex items-center gap-3">
        <BrokerSymbolImage symbol={position.symbol} iconUrl={position.sym_icon_url} />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{position.symbol}</span>
            <span className="text-sm font-medium text-zinc-200">
              {formatCurrency(position.market_value)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              {formatNumber(position.quantity, 4)} @ {formatCurrency(position.avg_price)}
            </span>
            <span className={pnlColor(position.unrealized_pnl)}>
              {formatCurrency(position.unrealized_pnl)} ({formatPercent(position.unrealized_pnl_pct)})
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function OrderRow({ order }: { order: BrokerOrder }) {
  return (
    <Card className="!m-0">
      <div className="flex items-center gap-3">
        <BrokerSymbolImage symbol={order.symbol} />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">
              <span className={sideColor(order.side)}>{order.side.toUpperCase()}</span>{" "}
              {order.symbol}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusColor(order.status)}`}
            >
              {order.status}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              {formatNumber(order.quantity, 4)} • {order.type}
              {order.fill_price !== null ? ` @ ${formatCurrency(order.fill_price)}` : ""}
            </span>
            <span>{relativeTime(order.created_at)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
