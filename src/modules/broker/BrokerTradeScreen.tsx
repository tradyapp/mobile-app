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
import dataService from "@/services/DataService";
import { formatCurrency } from "./utils";

interface Props {
  accountId: string;
  assetType: BrokerAssetType;
}

const ASSET_LABEL: Record<BrokerAssetType, string> = {
  STOCKS: "Stocks",
  CRYPTO: "Crypto",
  FOREX: "Forex",
};

interface SymbolOption {
  ticker: string;
  name: string | null;
}

export default function BrokerTradeScreen({ accountId, assetType }: Props) {
  const goBack = useBrokerStore((s) => s.goBack);
  const navigate = useBrokerStore((s) => s.navigate);
  const bumpRefresh = useBrokerStore((s) => s.bumpRefresh);

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

  const [symbolsLoading, setSymbolsLoading] = useState(true);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const [symbols, setSymbols] = useState<SymbolOption[]>([]);

  // Fetch the symbol catalog and filter to the chosen asset type.
  useEffect(() => {
    let cancelled = false;
    setSymbolsLoading(true);
    setSymbolsError(null);
    setSymbol("");

    const targetType = assetType === "STOCKS" ? "STOCK" : assetType;

    dataService
      .loadSymbols()
      .then((list) => {
        if (cancelled) return;
        const filtered = list
          .filter((s) => s.type === targetType)
          .map((s) => ({ ticker: s.symbol, name: s.name }))
          .sort((a, b) => a.ticker.localeCompare(b.ticker));
        setSymbols(filtered);
        if (filtered.length > 0) setSymbol(filtered[0].ticker);
      })
      .catch((err) => {
        if (!cancelled) {
          setSymbolsError(err instanceof Error ? err.message : "Failed to load symbols");
        }
      })
      .finally(() => {
        if (!cancelled) setSymbolsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assetType]);

  const navbarLeft = (
    <button onClick={goBack} className="ml-2 flex items-center gap-1 text-sm text-emerald-400">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Asset
    </button>
  );

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
      setError("Please pick a symbol");
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
      setQuantity("1");
      setLimitPrice("");
      setStopPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  const symbolHint = useMemo(() => {
    const found = symbols.find((s) => s.ticker === symbol);
    return found?.name ?? null;
  }, [symbol, symbols]);

  return (
    <>
      <AppNavbar title={`New ${ASSET_LABEL[assetType]} Order`} left={navbarLeft} />

      <Block className="mb-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="grid gap-4">
            <Field label="Symbol">
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                disabled={symbolsLoading || symbols.length === 0}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-base text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              >
                {symbolsLoading && <option value="">Loading symbols…</option>}
                {!symbolsLoading && symbols.length === 0 && (
                  <option value="">No symbols available for {ASSET_LABEL[assetType]}</option>
                )}
                {!symbolsLoading &&
                  symbols.map((s) => (
                    <option key={s.ticker} value={s.ticker}>
                      {s.ticker}
                      {s.name ? ` — ${s.name}` : ""}
                    </option>
                  ))}
              </select>
              {symbolHint && (
                <span className="mt-1 text-xs text-zinc-500">{symbolHint}</span>
              )}
              {symbolsError && (
                <span className="mt-1 text-xs text-rose-400">{symbolsError}</span>
              )}
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

            <Button onClick={handleSubmit} disabled={submitting || symbolsLoading || symbols.length === 0}>
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
