const DB_NAME = "TradyClientCache";
const DB_VERSION = 1;
const PAYLOADS_STORE = "payloads";
const ASSETS_STORE = "assets";
const META_PREFIX = "trady_cache_meta:";

interface StoredRecord<T> {
  key: string;
  value: T;
}

interface StoredAsset {
  key: string;
  blob: Blob;
}

export interface CacheMeta {
  version: string | null;
  cachedAt: string;
}

class ClientCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private assetUrlCache = new Map<string, string>();

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PAYLOADS_STORE)) {
          db.createObjectStore(PAYLOADS_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(ASSETS_STORE)) {
          db.createObjectStore(ASSETS_STORE, { keyPath: "key" });
        }
      };
    });

    return this.dbPromise;
  }

  private metaKey(key: string): string {
    return `${META_PREFIX}${key}`;
  }

  readMeta(key: string): CacheMeta | null {
    try {
      const raw = localStorage.getItem(this.metaKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CacheMeta>;
      return {
        version: typeof parsed.version === "string" ? parsed.version : null,
        cachedAt: typeof parsed.cachedAt === "string" ? parsed.cachedAt : new Date(0).toISOString(),
      };
    } catch {
      return null;
    }
  }

  writeMeta(key: string, version: string | null): void {
    try {
      localStorage.setItem(
        this.metaKey(key),
        JSON.stringify({ version, cachedAt: new Date().toISOString() satisfies CacheMeta["cachedAt"] }),
      );
    } catch {
      // Ignore local persistence failures.
    }
  }

  async getPayload<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PAYLOADS_STORE, "readonly");
      const store = tx.objectStore(PAYLOADS_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as StoredRecord<T> | undefined;
        resolve(result?.value ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setPayload<T>(key: string, value: T): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PAYLOADS_STORE, "readwrite");
      const store = tx.objectStore(PAYLOADS_STORE);
      const request = store.put({ key, value } satisfies StoredRecord<T>);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async hasAsset(key: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSETS_STORE, "readonly");
      const store = tx.objectStore(ASSETS_STORE);
      const request = store.getKey(key);

      request.onsuccess = () => resolve(Boolean(request.result));
      request.onerror = () => reject(request.error);
    });
  }

  async setAssetBlob(key: string, blob: Blob): Promise<void> {
    const db = await this.getDB();
    const existingUrl = this.assetUrlCache.get(key);
    if (existingUrl) {
      URL.revokeObjectURL(existingUrl);
      this.assetUrlCache.delete(key);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSETS_STORE, "readwrite");
      const store = tx.objectStore(ASSETS_STORE);
      const request = store.put({ key, blob } satisfies StoredAsset);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cacheAssetFromUrl(key: string, url: string): Promise<void> {
    if (!url) return;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${url}`);
    }
    const blob = await response.blob();
    await this.setAssetBlob(key, blob);
  }

  async getAssetObjectUrl(key: string): Promise<string | null> {
    const memoized = this.assetUrlCache.get(key);
    if (memoized) return memoized;

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSETS_STORE, "readonly");
      const store = tx.objectStore(ASSETS_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as StoredAsset | undefined;
        if (!result?.blob) {
          resolve(null);
          return;
        }
        const objectUrl = URL.createObjectURL(result.blob);
        this.assetUrlCache.set(key, objectUrl);
        resolve(objectUrl);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const clientCacheService = new ClientCacheService();
