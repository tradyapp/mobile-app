"use client";
import { useEffect, useMemo, useState } from "react";
import { Block, BlockTitle, Button, Segmented, SegmentedButton } from "konsta/react";
import AppNavbar from "@/components/AppNavbar";
import {
  brokerService,
  type BrokerAssetType,
  type BrokerOrderSide,
  type BrokerOrderType,
  type BrokerOrderTif,
  type CreateOrderInput,
} from "@/services/BrokerService";
import { useBrokerStore } from "@/stores/brokerStore";
import { formatCurrency } from "./utils";

interface Props {
  accountId: string;
}

const ASSET_TYPES: BrokerAssetType[] = ["STOCKS", "CRYPTO", "FOREX"];

const ASSET_LABEL: Record<BrokerAssetType, string> = {
  STOCKS: "Stocks",
  CRYPTO: "Crypto",
  FOREX: "Forex",
};

export default function BrokerTradeScreen({ accountId }: Props) {
  const goBack = useBrokerStore((s) => s.goBack);
  const navigate = useBrokerStore((s) => s.navigate);
  const bumpRefresh = useBrokerStore((s) => s.bumpRefresh);

  const [assetType, setAssetType] = useState<BrokerAssetType>("STOCKS");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<BrokerOrderSide>("buy");
  const [orderType, setOrderType] = useState<BrokerOrderType>("market");
  const [quantity, setQuantity] = useState("1");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [tif, setTif] = useState<BrokerOrderTif>("day");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const navbarLeft = (
    <button onClick={goBack} className="ml-2 flex items-center gap-1 text-sm text-emerald-400">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );

  const symbolPlaceholder = useMemo(() => {
    if (assetType === "STOCKS") return "AAPL";
    if (assetType === "CRYPTO") return "BTC/USD";
    return "EUR/USD";
  }, [assetType]);
  const actionPriceHint = useMemo(() => {
    if (orderType === "market") return "Executes immediately at the latest available price.";
    if (orderType === "limit") return "Only fills at your limit price or better.";
    if (orderType === "stop") return "Activates once the stop price is touched.";
    return "Activates at the stop price and submits a limit order.";
  }, [orderType]);

  const buildActionPrice = (): number | number[] | null | "invalid" => {
    if (orderType === "market") return null;
    const limit = Number(limitPrice);
    const stop = Number(stopPrice);
    if (orderType === "limit") {
      if (!Number.isFinite(limit) || limit <= 0) return "invalid";
      return limit;
    }
    if (orderType === "stop") {
      if (!Number.isFinite(stop) || stop <= 0) return "invalid";
      return stop;
    }
    if (orderType === "stoplimit") {
      if (!Number.isFinite(stop) || stop <= 0 || !Number.isFinite(limit) || limit <= 0) {
        return "invalid";
      }
      return [stop, limit];
    }
    return "invalid";
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setError("Please enter a symbol");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }
    const actionPrice = buildActionPrice();
    if (actionPrice === "invalid") {
      setError("Please enter valid price(s) for this order type");
      return;
    }

    const input: CreateOrderInput = {
      account_id: accountId,
      symbol: sym,
      asset_type: assetType,
      side,
      quantity: qty,
      type: orderType,
      action_price: actionPrice,
      tif,
    };

    setSubmitting(true);
    try {
      const order = await brokerService.createOrder(input);
      bumpRefresh();
      if (order.status === "completed") {
        setSuccess(
          `Order filled at ${formatCurrency(order.fill_price)}. Position updated.`,
        );
      } else if (order.status === "declined") {
        const reason = (order.details?.reason as string | undefined) ?? "Order declined";
        setError(reason);
      } else {
        setSuccess("Order placed and waiting for the trigger to be hit.");
      }
      // Reset transient fields
      setQuantity("1");
      setLimitPrice("");
      setStopPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppNavbar title="New Order" left={navbarLeft} />

      <Block className="mb-2">
        <div className="overflow-hidden rounded-[28px] border border-sky-500/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-[0.22em] text-sky-200/70">
                Order ticket
              </span>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Build a simulated trade
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Choose a market, define risk, and submit directly to your active paper account.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
              Sim account
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <QuickInfo label="Asset class" value={ASSET_LABEL[assetType]} />
            <QuickInfo label="Side" value={side === "buy" ? "Buy" : "Sell"} />
            <QuickInfo label="Execution" value={orderType === "market" ? "Instant" : "Conditional"} />
          </div>
        </div>
      </Block>

      <Block className="mb-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/90 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <SectionLabel>Market</SectionLabel>
          <Segmented strong className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1">
            {ASSET_TYPES.map((t) => (
              <SegmentedButton key={t} active={assetType === t} onClick={() => setAssetType(t)}>
                {ASSET_LABEL[t]}
              </SegmentedButton>
            ))}
          </Segmented>

          <div className="mt-4 grid gap-3">
            <Field label="Symbol" hint="Enter the ticker you want to simulate">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={symbolPlaceholder}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm uppercase text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </Field>

            <Field label="Side" hint="Buy opens or adds. Sell reduces or closes.">
              <Segmented strong className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1">
                <SegmentedButton active={side === "buy"} onClick={() => setSide("buy")}>
                  Buy
                </SegmentedButton>
                <SegmentedButton active={side === "sell"} onClick={() => setSide("sell")}>
                  Sell
                </SegmentedButton>
              </Segmented>
            </Field>
          </div>
        </div>
      </Block>

      <Block className="mb-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/90 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <SectionLabel>Order Details</SectionLabel>
          <div className="grid gap-3">
            <Field label="Quantity" hint="Supports decimal amounts when the asset allows it">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </Field>

            <Field label="Order type" hint={actionPriceHint}>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as BrokerOrderType)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
                <option value="stoplimit">Stop-Limit</option>
              </select>
            </Field>

            {(orderType === "stop" || orderType === "stoplimit") && (
              <Field label="Stop price" hint="Trigger price for stop execution">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </Field>
            )}

            {(orderType === "limit" || orderType === "stoplimit") && (
              <Field label="Limit price" hint="Maximum buy or minimum sell price">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </Field>
            )}

            <Field label="Time in force" hint="How long the order stays active">
              <Segmented strong className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1">
                <SegmentedButton active={tif === "day"} onClick={() => setTif("day")}>
                  Day
                </SegmentedButton>
                <SegmentedButton active={tif === "gtc"} onClick={() => setTif("gtc")}>
                  GTC
                </SegmentedButton>
              </Segmented>
            </Field>
          </div>
        </div>
      </Block>

      <Block className="mb-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/90 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <SectionLabel>Review</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <ReviewTile label="Symbol" value={symbol.trim().toUpperCase() || symbolPlaceholder} />
            <ReviewTile label="Quantity" value={quantity || "0"} />
            <ReviewTile label="Order" value={orderType} />
            <ReviewTile label="TIF" value={tif.toUpperCase()} />
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {success}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
              {submitting ? "Submitting..." : `Place ${side} order`}
            </Button>
            <Button
              outline
              onClick={() => navigate({ kind: "account-summary", accountId, tab: "summary" })}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Block>

      <Block>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <BlockTitle className="!mt-0 !mb-2">Execution model</BlockTitle>
          <p className="text-xs leading-relaxed text-zinc-400">
            Market orders execute immediately at the latest known price. Limit and stop orders
            execute instantly if the trigger is already met; otherwise they remain open until a
            background worker picks them up.
          </p>
        </div>
      </Block>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs uppercase tracking-[0.18em] text-zinc-400">{label}</span>
        {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 text-[11px] uppercase tracking-[0.22em] text-zinc-500">{children}</div>
  );
}

function QuickInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function ReviewTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}
