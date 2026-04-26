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

      <Block>
        <Segmented strong>
          {ASSET_TYPES.map((t) => (
            <SegmentedButton key={t} active={assetType === t} onClick={() => setAssetType(t)}>
              {ASSET_LABEL[t]}
            </SegmentedButton>
          ))}
        </Segmented>
      </Block>

      <Block strongIos insetIos>
        <div className="flex flex-col gap-3 py-2">
          <Field label="Symbol">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={symbolPlaceholder}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm uppercase text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </Field>

          <Field label="Side">
            <Segmented strong>
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </Field>

          <Field label="Order type">
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as BrokerOrderType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
              <option value="stop">Stop</option>
              <option value="stoplimit">Stop-Limit</option>
            </select>
          </Field>

          {(orderType === "stop" || orderType === "stoplimit") && (
            <Field label="Stop price">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </Field>
          )}
          {(orderType === "limit" || orderType === "stoplimit") && (
            <Field label="Limit price">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </Field>
          )}

          <Field label="Time in force">
            <Segmented strong>
              <SegmentedButton active={tif === "day"} onClick={() => setTif("day")}>
                Day
              </SegmentedButton>
              <SegmentedButton active={tif === "gtc"} onClick={() => setTif("gtc")}>
                GTC
              </SegmentedButton>
            </Segmented>
          </Field>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">{success}</p>}

          <div className="mt-2 flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
              {submitting ? "Submitting..." : `Place ${side} order`}
            </Button>
            <Button
              outline
              onClick={() => navigate({ kind: "account-summary", accountId, tab: "summary" })}
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </div>
      </Block>

      <Block>
        <BlockTitle>About instant execution</BlockTitle>
        <p className="text-xs text-zinc-400">
          Market orders execute immediately at the latest known price. Limit and stop orders
          execute instantly if the trigger is already met; otherwise they remain open until a
          background worker picks them up (Phase 2).
        </p>
      </Block>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
