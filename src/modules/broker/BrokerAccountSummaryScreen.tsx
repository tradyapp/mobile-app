"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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

const MOCK_EQUITY_POINTS = [
  42, 44, 43, 46, 49, 52, 51, 55, 58, 61,
  60, 64, 67, 69, 68, 72, 75, 79, 82, 86,
];

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

  const equity = account ? Number(account.balance) +
    positions.reduce((acc, p) => acc + (p.market_value ?? p.cost_basis ?? 0), 0)
    : 0;

  const handleTabChange = (next: BrokerSummaryTab) => {
    navigate({ kind: "account-summary", accountId, tab: next });
  };

  return (
    <>
      <AppNavbar title={account?.name ?? "Account"} />

      <Block className="mb-2">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <div className="pointer-events-none absolute inset-0 rounded-[30px] border border-emerald-400/10" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-80" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute left-5 top-5 h-14 w-24 rounded-full bg-white/6 blur-2xl" />

          <div className="relative flex min-h-[176px] items-end justify-between gap-4">
            <div className="w-[50%] min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Account Value</div>
              <AutoFitText
                text={formatCurrency(equity)}
                baseFontSize={34.4}
                minFontSize={10}
                className="mt-3 font-semibold tracking-tight text-white"
              />
              <div className="mt-3 text-xs text-zinc-500">
                Buying Power
                <span className="ml-2 inline-block max-w-full align-bottom">
                  <AutoFitText
                    text={account ? formatCurrency(account.balance) : "—"}
                    baseFontSize={14}
                    minFontSize={8}
                    className="font-medium text-zinc-300"
                  />
                </span>
              </div>
            </div>

            <div className="flex w-[46%] justify-end">
              <MockGrowthChart values={MOCK_EQUITY_POINTS} />
            </div>
          </div>

          <div className="mt-5 border-t border-white/8 pt-3">
            <button
              onClick={() => navigate({ kind: "settings", accountId, option: "menu" })}
              className="flex w-full items-center justify-between rounded-2xl px-1 py-1 text-left"
              aria-label="Open account settings"
            >
              <span className="text-sm font-medium text-zinc-200">Account Settings</span>
              <span className="text-lg leading-none text-zinc-500">›</span>
            </button>
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
        <OrdersPane
          orders={activeOrders}
          emptyText="No open orders. Submit a new order to get started."
        />
      )}

      {!loading && tab === "history" && (
        <OrdersPane orders={historicalOrders} emptyText="No completed orders yet." />
      )}

      {!loading && (
        <button
          onClick={() => navigate({ kind: "trade", accountId })}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400 text-black shadow-[0_18px_40px_rgba(16,185,129,0.35)] transition-transform active:scale-95"
          aria-label="New order"
        >
          <span className="text-2xl font-semibold leading-none">$</span>
        </button>
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
  return (
    <Block>
      {orders.length === 0 ? (
        <EmptyPanel title="Nothing to show yet" description={emptyText} />
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </div>
      )}
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

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 px-4 py-8 text-center">
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function AutoFitText({
  text,
  className,
  baseFontSize,
  minFontSize,
}: {
  text: string;
  className?: string;
  baseFontSize: number;
  minFontSize: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(baseFontSize);

  useEffect(() => {
    const updateFontSize = () => {
      const container = containerRef.current;
      const textElement = textRef.current;
      if (!container || !textElement) return;

      const availableWidth = container.clientWidth;
      if (!availableWidth) {
        setFontSize(baseFontSize);
        return;
      }

      let nextFontSize = baseFontSize;
      textElement.style.fontSize = `${nextFontSize}px`;

      while (textElement.scrollWidth > availableWidth && nextFontSize > minFontSize) {
        nextFontSize = Math.max(minFontSize, nextFontSize - 0.5);
        textElement.style.fontSize = `${nextFontSize}px`;
      }

      setFontSize(nextFontSize);
    };

    updateFontSize();
    const resizeObserver = new ResizeObserver(updateFontSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [baseFontSize, minFontSize, text]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap ${className ?? ""}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {text}
      </span>
    </div>
  );
}

function MockGrowthChart({ values }: { values: number[] }) {
  const width = 180;
  const height = 108;
  const padding = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const normalized = (value - min) / range;
    const y = height - padding - normalized * (height - padding * 2);
    return { x, y };
  });

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="relative w-full max-w-[180px]">
      <div className="mb-2 text-right text-[10px] uppercase tracking-[0.18em] text-zinc-600">
        Last 20 updates
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[108px] w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="trade-growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(52, 211, 153, 0.30)" />
            <stop offset="100%" stopColor="rgba(52, 211, 153, 0)" />
          </linearGradient>
          <linearGradient id="trade-growth-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#86efac" />
          </linearGradient>
        </defs>

        <path
          d={areaPath}
          fill="url(#trade-growth-fill)"
        />
        <path
          d={linePath}
          fill="none"
          stroke="url(#trade-growth-line)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 3.5 : 0}
            fill="#86efac"
          />
        ))}
      </svg>
    </div>
  );
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] ?? current;
    const afterNext = points[index + 2] ?? next;

    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = current.y + (next.y - previous.y) / 6;
    const cp2x = next.x - (afterNext.x - current.x) / 6;
    const cp2y = next.y - (afterNext.y - current.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }

  return path;
}
