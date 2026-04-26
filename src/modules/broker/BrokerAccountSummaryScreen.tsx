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
  const totalMarketValue = useMemo(
    () => positions.reduce((acc, p) => acc + (p.market_value ?? 0), 0),
    [positions],
  );
  const completedOrders = historicalOrders.filter((order) => order.status === "completed").length;

  const handleTabChange = (next: BrokerSummaryTab) => {
    navigate({ kind: "account-summary", accountId, tab: next });
  };

  return (
    <>
      <AppNavbar title={account?.name ?? "Account"} />

      <Block className="mb-2">
        <div className="overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_38%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/70">
                Active simulation account
              </span>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {account ? formatCurrency(account.balance) : "—"}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Cash balance ready for new orders
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-300">
              Paper trading
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <MetricTile label="Equity" value={formatCurrency(equity)} tone="neutral" />
            <MetricTile label="Market Value" value={formatCurrency(totalMarketValue)} tone="neutral" />
            <MetricTile label="Unrealized PnL" value={formatCurrency(totalUnrealized)} tone={totalUnrealized >= 0 ? "positive" : "negative"} />
            <MetricTile label="Open Positions" value={String(positions.length)} tone="neutral" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1">
              {activeOrders.length} open orders
            </span>
            <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1">
              {completedOrders} completed orders
            </span>
          </div>

          <div className="mt-5 flex gap-2">
            <Button
              large
              onClick={() => navigate({ kind: "trade", accountId })}
              className="flex-1"
            >
              New order
            </Button>
            <Button
              large
              outline
              onClick={() => navigate({ kind: "settings", accountId, option: "menu" })}
              className="flex-1"
            >
              Settings
            </Button>
          </div>
        </div>
      </Block>

      <Block className="mb-1">
        <Segmented strong className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1">
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
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        </Block>
      )}

      {loading && (
        <Block>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-8 text-center text-sm text-zinc-400">
            Loading account activity...
          </div>
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
        <BlockTitle className="!mb-3">
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
          <EmptyPanel
            title="No open positions"
            description="Executed buys will appear here with live paper profit and loss."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {top.map((p) => (
              <PositionRow key={p.id} position={p} />
            ))}
          </div>
        )}
      </Block>

      <Block>
        <BlockTitle className="!mb-3">
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
          <EmptyPanel
            title="No active orders"
            description="Market orders fill immediately. Waiting limit and stop orders will stay here."
          />
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
        <EmptyPanel
          title="No open positions yet"
          description="Use New order to open a paper position and track its performance here."
        />
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
        <EmptyPanel title="Nothing to show yet" description={emptyText} />
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
    <Card className="!m-0 overflow-hidden !rounded-2xl border border-zinc-800/90 bg-zinc-950/90 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-3">
        <BrokerSymbolImage symbol={position.symbol} iconUrl={position.sym_icon_url} />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-semibold text-white">{position.symbol}</span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                Position
              </span>
            </div>
            <span className="text-sm font-medium text-zinc-200">
              {formatCurrency(position.market_value)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
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
    <Card className="!m-0 overflow-hidden !rounded-2xl border border-zinc-800/90 bg-zinc-950/90 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
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
          <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
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

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-rose-300"
        : "text-white";

  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className={`mt-2 text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 px-4 py-8 text-center">
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </div>
  );
}
