import { supabase } from "@/lib/supabase";

const SYMBOLS_CACHE_KEY = "trady_symbols_cache";
const LAST_UPDATE_KEY = "trady_symbols_last_update";
const DB_NAME = "TradyCache";
const DB_VERSION = 1;
const IMAGES_STORE = "symbolImages";

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

function mapMarket(market: DbSymbol["market"]): SymbolType {
  if (market === "STOCKS") return "STOCK";
  return market;
}

class DataService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private symbolsCache: Symbol[] | null = null;
  private isLoading = false;

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

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IMAGES_STORE)) {
          db.createObjectStore(IMAGES_STORE);
        }
      };
    });

    return this.dbPromise;
  }

  private async saveImage(symbol: string, blob: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMAGES_STORE], "readwrite");
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.put(blob, symbol);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getImage(symbol: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGES_STORE], "readonly");
        const store = transaction.objectStore(IMAGES_STORE);
        const request = store.get(symbol);

        request.onsuccess = () => {
          if (request.result) {
            resolve(URL.createObjectURL(request.result));
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  private async downloadAndCacheImage(url: string, symbol: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch image");
      const blob = await response.blob();
      await this.saveImage(symbol, blob);
    } catch (error) {
      console.error(`Error downloading image for ${symbol}:`, error);
    }
  }

  private async loadCachedImages(symbols: Symbol[]): Promise<Symbol[]> {
    return await Promise.all(
      symbols.map(async (symbol) => {
        const normalized = this.normalizeSymbolRecord(symbol);

        if (normalized.icon_url) {
          const cachedImage = await this.getImage(symbol.symbol);
          return {
            ...normalized,
            photo: cachedImage || normalized.icon_url,
          };
        }

        return normalized;
      })
    );
  }

  private async downloadAllImages(symbols: Symbol[]): Promise<void> {
    const downloadPromises = symbols
      .filter((symbol) => symbol.icon_url)
      .map((symbol) => this.downloadAndCacheImage(symbol.icon_url as string, symbol.symbol));

    await Promise.all(downloadPromises);
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

    return data?.updated_at ?? "0";
  }

  async loadSymbols(): Promise<Symbol[]> {
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.symbolsCache || [];
    }

    if (this.symbolsCache) {
      return this.symbolsCache;
    }

    this.isLoading = true;

    try {
      const cachedData = localStorage.getItem(SYMBOLS_CACHE_KEY);
      const cachedLastUpdate = localStorage.getItem(LAST_UPDATE_KEY);
      const currentLastUpdate = await this.getLastUpdate();

      if (cachedData && cachedLastUpdate === currentLastUpdate) {
        const symbols = (JSON.parse(cachedData) as Partial<Symbol>[]).map((item) => this.normalizeSymbolRecord(item));
        this.symbolsCache = await this.loadCachedImages(symbols);
        return this.symbolsCache;
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

      await this.downloadAllImages(symbols);

      localStorage.setItem(SYMBOLS_CACHE_KEY, JSON.stringify(symbols));
      localStorage.setItem(LAST_UPDATE_KEY, currentLastUpdate);

      this.symbolsCache = await this.loadCachedImages(symbols);
      return this.symbolsCache;
    } catch (error) {
      const cachedData = localStorage.getItem(SYMBOLS_CACHE_KEY);
      if (cachedData) {
        const symbols = (JSON.parse(cachedData) as Partial<Symbol>[]).map((item) => this.normalizeSymbolRecord(item));
        this.symbolsCache = await this.loadCachedImages(symbols);
        return this.symbolsCache;
      }

      throw error;
    } finally {
      this.isLoading = false;
    }
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
