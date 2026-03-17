/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import type { SymbolType } from "@/stores/chartStore";

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "h" | "d" | "w" | "mo";

export interface CandleData {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface RealtimePrice {
  price: number;
  open?: number;
  high?: number;
  low?: number;
  marketOpen?: boolean;
  timestamp: number;
  datetime: string;
}

export interface RealtimeMeta {
  marketOpen: boolean;
  postMarketPrice?: number;
}

interface MinuteRealtimeRow {
  symbol: string;
  last_price: number;
  last_candle: {
    datetime?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
  };
  previous_candle?: {
    datetime?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
  };
  updated_at: string;
}

const MARKET_PREFIX: Record<SymbolType, string> = {
  STOCK: "stock",
  CRYPTO: "crypto",
  FOREX: "forex",
};

const MARKET_NAME: Record<SymbolType, "STOCKS" | "CRYPTO" | "FOREX"> = {
  STOCK: "STOCKS",
  CRYPTO: "CRYPTO",
  FOREX: "FOREX",
};

function tableFor(symbolType: SymbolType, timeframe: Timeframe): string {
  return `hd_${MARKET_PREFIX[symbolType]}_${timeframe}`;
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

function sortAsc(candles: CandleData[]): CandleData[] {
  return candles.sort((a, b) => a.datetime.localeCompare(b.datetime));
}

function toCandle(row: Record<string, any>): CandleData {
  return {
    datetime: String(row.datetime),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: row.volume != null ? Number(row.volume) : undefined,
  };
}

export class StockDataService {
  static async getStockData(
    symbol: string,
    timeframe: Timeframe = "d",
    limit = 200,
    symbolType: SymbolType = "STOCK"
  ): Promise<CandleData[]> {
    const normalized = normalizeSymbol(symbol);
    const table = tableFor(symbolType, timeframe);

    const selectCols = symbolType === "STOCK"
      ? "symbol, datetime, open, high, low, close, volume"
      : "symbol, datetime, open, high, low, close";

    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .eq("symbol", normalized)
      .order("datetime", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return sortAsc((data ?? []).map((row) => toCandle(row as Record<string, any>)));
  }

  static async getOlderCandles(
    symbol: string,
    timeframe: Timeframe,
    beforeKey: string,
    limit = 200,
    symbolType: SymbolType = "STOCK"
  ): Promise<CandleData[]> {
    const normalized = normalizeSymbol(symbol);
    const table = tableFor(symbolType, timeframe);

    const selectCols = symbolType === "STOCK"
      ? "symbol, datetime, open, high, low, close, volume"
      : "symbol, datetime, open, high, low, close";

    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .eq("symbol", normalized)
      .lt("datetime", beforeKey)
      .order("datetime", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching older candles:", error);
      return [];
    }

    return sortAsc((data ?? []).map((row) => toCandle(row as Record<string, any>)));
  }

  static subscribeToStockData(
    symbol: string,
    timeframe: Timeframe,
    callback: (data: CandleData[]) => void,
    limit = 200,
    symbolType: SymbolType = "STOCK"
  ): () => void {
    let active = true;
    const normalized = normalizeSymbol(symbol);
    const table = tableFor(symbolType, timeframe);
    let candles: CandleData[] = [];

    const emit = () => {
      if (!active) return;
      callback(sortAsc([...candles]));
    };

    this.getStockData(symbol, timeframe, limit, symbolType)
      .then((rows) => {
        candles = rows;
        emit();
      })
      .catch((error) => {
        console.error("Error loading candles:", error);
        callback([]);
      });

    const channel = supabase
      .channel(`candles-${table}-${normalized}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `symbol=eq.${normalized}` },
        (payload) => {
          const row = (payload.new || payload.old) as Record<string, any>;
          if (!row?.datetime) return;

          if (payload.eventType === "DELETE") {
            candles = candles.filter((c) => c.datetime !== String(row.datetime));
            emit();
            return;
          }

          const next = toCandle(row);
          const index = candles.findIndex((c) => c.datetime === next.datetime);

          if (index >= 0) {
            candles[index] = next;
          } else {
            candles.push(next);
          }

          if (candles.length > limit) {
            candles = sortAsc(candles).slice(-limit);
          }

          emit();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }

  static subscribeToStockDataWithRealtimePrice(
    symbol: string,
    timeframe: Timeframe,
    callback: (data: CandleData[], meta?: RealtimeMeta) => void,
    limit = 200,
    symbolType: SymbolType = "STOCK"
  ): () => void {
    let active = true;
    let marketOpen = true;
    let postMarketPrice: number | undefined;
    let candles: CandleData[] = [];

    const normalized = normalizeSymbol(symbol);
    const table = tableFor(symbolType, timeframe);

    const emit = () => {
      if (!active) return;

      if (symbolType === "STOCK" && !marketOpen && postMarketPrice != null) {
        callback(sortAsc([...candles]), { marketOpen: false, postMarketPrice });
        return;
      }

      callback(sortAsc([...candles]), { marketOpen: true });
    };

    const unsubscribeCandles = this.subscribeToStockData(
      symbol,
      timeframe,
      (rows) => {
        candles = rows;
        emit();
      },
      limit,
      symbolType
    );

    const realtimeChannel = supabase
      .channel(`minute-${normalized}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "symbol_minute_candles", filter: `symbol=eq.${normalized}` },
        (payload) => {
          const row = payload.new as MinuteRealtimeRow;
          if (!row?.last_price) return;

          postMarketPrice = Number(row.last_price);

          if (candles.length > 0 && marketOpen) {
            const last = candles[candles.length - 1];
            const patched: CandleData = {
              ...last,
              close: postMarketPrice,
              high: Math.max(last.high, Number(row.last_candle?.high ?? postMarketPrice)),
              low: Math.min(last.low, Number(row.last_candle?.low ?? postMarketPrice)),
            };
            candles = [...candles.slice(0, -1), patched];
          }

          emit();
        }
      )
      .subscribe();

    let marketChannel: ReturnType<typeof supabase.channel> | null = null;

    if (symbolType === "STOCK" || symbolType === "FOREX") {
      const market = symbolType === "STOCK" ? "NYSE" : "FOREX";

      marketChannel = supabase
        .channel(`market-${market}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "market_status", filter: `market=eq.${market}` },
          (payload) => {
            const row = payload.new as { market_is_open?: boolean };
            if (row?.market_is_open != null) {
              marketOpen = Boolean(row.market_is_open);
              emit();
            }
          }
        )
        .subscribe();

      supabase
        .from("market_status")
        .select("market_is_open")
        .eq("market", market)
        .single()
        .then(({ data }) => {
          if (data?.market_is_open != null) {
            marketOpen = Boolean(data.market_is_open);
            emit();
          }
        });
    }

    if (symbolType === "CRYPTO") {
      marketOpen = true;
    }

    return () => {
      active = false;
      unsubscribeCandles();
      supabase.removeChannel(realtimeChannel);
      if (marketChannel) supabase.removeChannel(marketChannel);
    };
  }

  static toBackendMarket(symbolType: SymbolType): "STOCKS" | "CRYPTO" | "FOREX" {
    return MARKET_NAME[symbolType];
  }
}
