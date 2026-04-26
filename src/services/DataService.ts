import { supabase } from "@/lib/supabase";
import { clientCacheService } from "@/services/cache/ClientCacheService";

type SymbolType = "STOCK" | "FOREX" | "CRYPTO";

interface Symbol {
  symbol: string;
  type: SymbolType | null;
  name: string | null;
  photo: string | null;
  icon_url: string | null;
}

interface DbSymbol {
  ticker: string;
  market: "STOCKS" | "FOREX" | "CRYPTO";
  name: string | null;
  icon_url: string | null;
  updated_at?: string;
}

const SYMBOLS_PAYLOAD_KEY = "symbols:catalog";

function mapMarket(market: DbSymbol["market"]): SymbolType {
  if (market === "STOCKS") return "STOCK";
  return market;
}

class DataService {
  private symbolsCache: Symbol[] | null = null;
  private inFlightPromise: Promise<Symbol[]> | null = null;

  private isBlobUrl(value: string | null | undefined): boolean {
    return typeof value === "string" && value.startsWith("blob:");
  }

  private normalizeSymbolRecord(value: Partial<Symbol>): Symbol {
    const photo = typeof value.photo === "string" ? value.photo : null;
    const iconUrl = typeof value.icon_url === "string" ? value.icon_url : null;
    const canonicalIconUrl = !this.isBlobUrl(iconUrl)
      ? iconUrl
      : (!this.isBlobUrl(photo) ? photo : null);

    return {
      symbol: typeof value.symbol === "string" ? value.symbol : "",
      type: value.type ?? null,
      name: typeof value.name === "string" ? value.name : null,
      photo: photo ?? canonicalIconUrl,
      icon_url: canonicalIconUrl,
    };
  }

  private assetKey(symbol: string): string {
    return `symbols:asset:${symbol}`;
  }

  private async primeSymbolAssets(symbols: Symbol[]): Promise<void> {
    await Promise.all(
      symbols
        .filter((symbol) => symbol.icon_url)
        .map(async (symbol) => {
          try {
            const key = this.assetKey(symbol.symbol);
            const exists = await clientCacheService.hasAsset(key);
            if (exists) return;
            await clientCacheService.cacheAssetFromUrl(key, symbol.icon_url as string);
          } catch {
            // Ignore individual image failures.
          }
        }),
    );
  }

  private async hydrateSymbolAssets(symbols: Symbol[]): Promise<Symbol[]> {
    return Promise.all(
      symbols.map(async (symbol) => {
        const normalized = this.normalizeSymbolRecord(symbol);
        if (!normalized.icon_url) return normalized;
        const cachedAssetUrl = await clientCacheService.getAssetObjectUrl(this.assetKey(normalized.symbol));
        return {
          ...normalized,
          photo: cachedAssetUrl || normalized.icon_url,
        };
      }),
    );
  }

  async getLastUpdate(): Promise<string> {
    const { data, error } = await supabase
      .from("symbols")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return (data as { updated_at?: string } | null)?.updated_at ?? "0";
  }

  async loadSymbols(): Promise<Symbol[]> {
    if (this.inFlightPromise) return this.inFlightPromise;
    if (this.symbolsCache) return this.symbolsCache;

    this.inFlightPromise = (async () => {
      const cachedPayload = await clientCacheService.getPayload<Symbol[]>(SYMBOLS_PAYLOAD_KEY);
      const cachedVersion = clientCacheService.readMeta(SYMBOLS_PAYLOAD_KEY)?.version ?? null;

      if (cachedPayload) {
        this.symbolsCache = await this.hydrateSymbolAssets(cachedPayload.map((item) => this.normalizeSymbolRecord(item)));
      }

      try {
        const currentVersion = await this.getLastUpdate();
        if (cachedPayload && cachedVersion === currentVersion) {
          return this.symbolsCache ?? [];
        }

        const { data, error } = await supabase
          .from("symbols")
          .select("ticker, market, name, icon_url")
          .order("ticker", { ascending: true });

        if (error) throw error;

        const symbols = (data as DbSymbol[]).map((item) => this.normalizeSymbolRecord({
          symbol: item.ticker,
          type: mapMarket(item.market),
          name: item.name,
          photo: item.icon_url,
          icon_url: item.icon_url,
        }));

        await clientCacheService.setPayload(SYMBOLS_PAYLOAD_KEY, symbols);
        clientCacheService.writeMeta(SYMBOLS_PAYLOAD_KEY, currentVersion);
        void this.primeSymbolAssets(symbols);

        this.symbolsCache = await this.hydrateSymbolAssets(symbols);
        return this.symbolsCache;
      } catch (error) {
        if (this.symbolsCache) {
          return this.symbolsCache;
        }
        throw error;
      } finally {
        this.inFlightPromise = null;
      }
    })();

    return this.inFlightPromise;
  }

  getSymbols(): Symbol[] {
    return this.symbolsCache ?? [];
  }

  isSymbolsLoaded(): boolean {
    return this.symbolsCache !== null;
  }
}

const dataService = new DataService();
export default dataService;
