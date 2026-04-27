"use client";
import { useEffect, useMemo, useState } from "react";
import { Block, Button, Segmented, SegmentedButton } from "konsta/react";
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
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="grid gap-4">
            <Field label="Asset">
              <Segmented strong className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1">
                {ASSET_TYPES.map((t) => (
                  <SegmentedButton key={t} active={assetType === t} onClick={() => setAssetType(t)}>
                    {ASSET_LABEL[t]}
                  </SegmentedButton>
                ))}
              </Segmented>
            </Field>

            <Field label="Symbol">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={symbolPlaceholder}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-base uppercase text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </Field>

            <Field label="Side">
              <Segmented strong className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1">
                <SegmentedButton active={side === "buy"} onClick={() => setSide("buy")}>
                  Buy
                </SegmentedButton>
                <SegmentedButton active={side === "sell"} onClick={() => setSide("sell")}>
                  Sell
                </SegmentedButton>
              </Segmented>
            </Field>

            <Field label="Quantity">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-base text-white focus:border-emerald-500 focus:outline-none"
              />
            </Field>

            <Field label="Order Type">
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as BrokerOrderType)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-base text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
                <option value="stoplimit">Stop-Limit</option>
              </select>
            </Field>

            {(orderType === "stop" || orderType === "stoplimit") && (
              <Field label="Stop Price">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-base text-white focus:border-emerald-500 focus:outline-none"
                />
              </Field>
            )}

            {(orderType === "limit" || orderType === "stoplimit") && (
              <Field label="Limit Price">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-base text-white focus:border-emerald-500 focus:outline-none"
                />
              </Field>
            )}

            <Field label="Time in Force">
              <Segmented strong className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1">
                <SegmentedButton active={tif === "day"} onClick={() => setTif("day")}>
                  Day
                </SegmentedButton>
                <SegmentedButton active={tif === "gtc"} onClick={() => setTif("gtc")}>
                  GTC
                </SegmentedButton>
              </Segmented>
            </Field>

            {error && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : `Place ${side} order`}
            </Button>
            <Button
              outline
              onClick={() => navigate({ kind: "account-summary", accountId, tab: "summary" })}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Block>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
