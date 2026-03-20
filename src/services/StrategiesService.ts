import { supabase } from "@/lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase env vars for strategies service");
}

export interface StrategyRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  symbols: StrategyTrackedSymbol[];
  created_at: string;
  updated_at: string;
}

export type StrategySymbolMarket = "STOCKS" | "FOREX" | "CRYPTO";

export interface StrategyTrackedSymbol {
  ticker: string;
  name: string;
  icon_url: string | null;
  market: StrategySymbolMarket;
}

export type StrategyWebhookAuthType =
  | "none"
  | "api_key_header"
  | "bearer_token"
  | "basic_auth"
  | "custom_headers"
  | "auth0_client_credentials";

export interface StrategyWebhookHeader {
  key: string;
  value: string;
}

export interface StrategyUserWebhookConfig {
  enabled: boolean;
  endpoint_url: string;
  auth_type: StrategyWebhookAuthType;
  api_key_header_name: string;
  api_key_value: string;
  bearer_token: string;
  basic_username: string;
  basic_password: string;
  custom_headers: StrategyWebhookHeader[];
  auth0_token_url: string;
  auth0_client_id: string;
  auth0_client_secret: string;
  auth0_audience: string;
  auth0_scope: string;
}

export interface StrategyNodeMap {
  version: number;
  nodes: unknown[];
  edges: unknown[];
}

export interface StrategyNodeVersionRecord {
  id: string;
  strategy_id: string;
  name: string;
  version_number: number;
  is_active: boolean;
  node_map: StrategyNodeMap | null;
  created_at: string;
  updated_at: string;
}

export interface StrategyNodeExecutionField {
  id?: string;
  key?: string;
  name?: string;
  type?: string;
  value?: string;
}

export interface ExecuteStrategyNodeInput {
  strategy_id?: string | null;
  owner_user_id?: string | null;
  node_type_key: string;
  node_type_version?: number | null;
  attributes?: StrategyNodeExecutionField[];
  input_context?: unknown;
  mode?: "preview" | "cloud" | "live";
  execution_time?: string | null;
}

export interface ExecuteStrategyNodeResult {
  node_type_key: string;
  node_type_version: number | null;
  input_schema: unknown[];
  output_schema: unknown[];
  attributes: Record<string, unknown>;
  output: unknown;
  execution_time: string;
}

export interface StrategyBacktestMetadataInput {
  strategy_id?: string;
  node_map?: StrategyNodeMap;
  symbol: string;
  market?: StrategySymbolMarket;
}

export interface StrategyBacktestTimeframeStat {
  timeframe: string;
  count: number;
  oldest: string | null;
  newest: string | null;
}

export interface StrategyBacktestMetadataResult {
  status: "ok";
  symbol: string;
  market: StrategySymbolMarket;
  requested_timeframes: string[];
  timeframe_stats: StrategyBacktestTimeframeStat[];
  base_timeframe: string;
  warnings: string[];
}

export interface StrategyBacktestRunInput {
  strategy_id?: string;
  node_map?: StrategyNodeMap;
  symbol: string;
  market?: StrategySymbolMarket;
  from?: string;
  to?: string;
  max_bars?: number;
  mode?: "preview" | "cloud" | "live";
}

export interface StrategyBacktestRunEvent {
  execution_time: string;
  anchor_time: string;
  signal_kind: "true" | "rating";
  rating: number | null;
  output_node_id: string;
  output_node_type: string;
  output: unknown;
}

export interface StrategyBacktestRunResult {
  status: "completed";
  symbol: string;
  market: StrategySymbolMarket;
  requested_timeframes: string[];
  timeframe_stats: StrategyBacktestTimeframeStat[];
  base_timeframe: string;
  from: string;
  to: string;
  bars_available: number;
  bars_evaluated: number;
  mode: "preview" | "cloud" | "live";
  stats: {
    events_total: number;
    true_events: number;
    rating_events: number;
    avg_rating: number | null;
  };
  warnings: string[];
  events: StrategyBacktestRunEvent[];
}

interface CreateStrategyInput {
  name: string;
  description?: string | null;
  photo_url?: string | null;
}

interface UpdateStrategyInput {
  name?: string;
  description?: string | null;
  photo_url?: string | null;
}

class StrategiesService {
  private hasPhotoUrlColumn: boolean | null = null;
  private hasNodeMapColumn: boolean | null = null;
  private hasNodeVersionsTable: boolean | null = null;
  private hasNodeVersionRpc: boolean | null = null;
  private hasSymbolsColumn: boolean | null = null;
  private hasStrategyUserSettingsTable: boolean | null = null;

  private async getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Authentication required");
    return token;
  }

  private async getUserId(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error("Authentication required");
    return userId;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    const headers: HeadersInit = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let message = `Strategies API error: ${response.status}`;
      try {
        const payload = await response.json();
        const parts = [payload?.message, payload?.details, payload?.hint, payload?.code]
          .filter((part): part is string => typeof part === "string" && part.length > 0);
        if (parts.length > 0) message = parts.join(" | ");
      } catch {
        // no-op
      }
      throw new Error(message);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private async invokeFunction<T>(functionName: string, payload: unknown): Promise<T> {
    const token = await this.getAuthToken();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = `Function ${functionName} error: ${response.status}`;
      try {
        const body = await response.json();
        const parts = [body?.error, body?.message, body?.details]
          .filter((item): item is string => typeof item === "string" && item.length > 0);
        if (parts.length > 0) message = parts.join(" | ");
      } catch {
        // no-op
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  private isMissingPhotoUrlColumn(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    if (!msg.includes("photo_url")) return false;
    return (
      msg.includes("column") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist")
    );
  }

  private isMissingNodeMapColumn(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    if (!msg.includes("node_map")) return false;
    return (
      msg.includes("column") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist")
    );
  }

  private isMissingNodeVersionsTable(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    if (!msg.includes("strategy_node_versions")) return false;
    return (
      msg.includes("relation") ||
      msg.includes("does not exist") ||
      msg.includes("schema cache")
    );
  }

  private isMissingSymbolsColumn(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    if (!msg.includes("symbols")) return false;
    return (
      msg.includes("column") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist")
    );
  }

  private isMissingRpcFunction(error: unknown, functionName: string): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return msg.includes(functionName.toLowerCase()) && (
      msg.includes("function") ||
      msg.includes("does not exist") ||
      msg.includes("schema cache")
    );
  }

  private isMissingStrategyUserSettingsTable(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    if (!msg.includes("strategy_user_settings")) return false;
    return (
      msg.includes("relation") ||
      msg.includes("does not exist") ||
      msg.includes("schema cache")
    );
  }

  private normalizeRow(row: Partial<StrategyRecord>): StrategyRecord {
    return {
      id: row.id ?? "",
      user_id: row.user_id ?? "",
      name: row.name ?? "",
      description: row.description ?? null,
      photo_url: row.photo_url ?? null,
      symbols: this.normalizeTrackedSymbols(row.symbols),
      created_at: row.created_at ?? "",
      updated_at: row.updated_at ?? "",
    };
  }

  private normalizeTrackedSymbols(value: unknown): StrategyTrackedSymbol[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Partial<StrategyTrackedSymbol>;
        const ticker = typeof row.ticker === "string" ? row.ticker.toUpperCase() : "";
        if (!ticker) return null;

        const market = row.market === "FOREX" || row.market === "CRYPTO" ? row.market : "STOCKS";

        return {
          ticker,
          name: typeof row.name === "string" && row.name.trim().length > 0 ? row.name : ticker,
          icon_url:
            typeof row.icon_url === "string" && !row.icon_url.startsWith("blob:")
              ? row.icon_url
              : null,
          market,
        } satisfies StrategyTrackedSymbol;
      })
      .filter((item): item is StrategyTrackedSymbol => item !== null);
  }

  private normalizeTickerList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === "string" ? item.toUpperCase() : ""))
      .filter((item) => item.length > 0);
  }

  private defaultWebhookConfig(): StrategyUserWebhookConfig {
    return {
      enabled: false,
      endpoint_url: "",
      auth_type: "none",
      api_key_header_name: "x-api-key",
      api_key_value: "",
      bearer_token: "",
      basic_username: "",
      basic_password: "",
      custom_headers: [],
      auth0_token_url: "",
      auth0_client_id: "",
      auth0_client_secret: "",
      auth0_audience: "",
      auth0_scope: "",
    };
  }

  private normalizeWebhookHeaders(value: unknown): StrategyWebhookHeader[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Partial<StrategyWebhookHeader>;
        const key = typeof row.key === "string" ? row.key.trim() : "";
        const val = typeof row.value === "string" ? row.value : "";
        if (!key) return null;
        return { key, value: val } satisfies StrategyWebhookHeader;
      })
      .filter((item): item is StrategyWebhookHeader => item !== null);
  }

  private normalizeWebhookConfig(value: unknown): StrategyUserWebhookConfig {
    const base = this.defaultWebhookConfig();
    if (!value || typeof value !== "object") return base;

    const payload = value as Partial<StrategyUserWebhookConfig>;
    const authType = payload.auth_type;
    const normalizedAuthType: StrategyWebhookAuthType =
      authType === "api_key_header"
      || authType === "bearer_token"
      || authType === "basic_auth"
      || authType === "custom_headers"
      || authType === "auth0_client_credentials"
        ? authType
        : "none";

    return {
      enabled: Boolean(payload.enabled),
      endpoint_url: typeof payload.endpoint_url === "string" ? payload.endpoint_url.trim() : "",
      auth_type: normalizedAuthType,
      api_key_header_name: typeof payload.api_key_header_name === "string" && payload.api_key_header_name.trim().length > 0
        ? payload.api_key_header_name.trim()
        : "x-api-key",
      api_key_value: typeof payload.api_key_value === "string" ? payload.api_key_value : "",
      bearer_token: typeof payload.bearer_token === "string" ? payload.bearer_token : "",
      basic_username: typeof payload.basic_username === "string" ? payload.basic_username : "",
      basic_password: typeof payload.basic_password === "string" ? payload.basic_password : "",
      custom_headers: this.normalizeWebhookHeaders(payload.custom_headers),
      auth0_token_url: typeof payload.auth0_token_url === "string" ? payload.auth0_token_url : "",
      auth0_client_id: typeof payload.auth0_client_id === "string" ? payload.auth0_client_id : "",
      auth0_client_secret: typeof payload.auth0_client_secret === "string" ? payload.auth0_client_secret : "",
      auth0_audience: typeof payload.auth0_audience === "string" ? payload.auth0_audience : "",
      auth0_scope: typeof payload.auth0_scope === "string" ? payload.auth0_scope : "",
    };
  }

  private normalizeNodeMap(row: unknown): StrategyNodeMap | null {
    if (!row || typeof row !== "object") return null;
    const payload = row as Partial<StrategyNodeMap>;
    if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) return null;
    return {
      version: typeof payload.version === "number" ? payload.version : 1,
      nodes: payload.nodes,
      edges: payload.edges,
    };
  }

  private normalizeNodeVersionRow(row: Partial<StrategyNodeVersionRecord>): StrategyNodeVersionRecord {
    return {
      id: row.id ?? "",
      strategy_id: row.strategy_id ?? "",
      name: row.name ?? "",
      version_number: row.version_number ?? 0,
      is_active: row.is_active ?? false,
      node_map: this.normalizeNodeMap(row.node_map) ?? null,
      created_at: row.created_at ?? "",
      updated_at: row.updated_at ?? "",
    };
  }

  private getSelectFields(includePhoto: boolean): string {
    const fields = ["id", "user_id", "name", "description"];
    if (includePhoto) fields.push("photo_url");
    if (this.hasSymbolsColumn !== false) fields.push("symbols");
    fields.push("created_at", "updated_at");
    return fields.join(",");
  }

  async listStrategies(): Promise<StrategyRecord[]> {
    const includePhoto = this.hasPhotoUrlColumn !== false;
    const select = this.getSelectFields(includePhoto);

    try {
      const rows = await this.request<Partial<StrategyRecord>[]>(
        `/strategies?select=${select}&order=created_at.desc`,
        { method: "GET" }
      );
      if (this.hasPhotoUrlColumn === null) this.hasPhotoUrlColumn = includePhoto;
      return rows.map((row) => this.normalizeRow(row));
    } catch (error) {
      if (includePhoto && this.hasPhotoUrlColumn !== false && this.isMissingPhotoUrlColumn(error)) {
        this.hasPhotoUrlColumn = false;
        const fallbackSelect = this.getSelectFields(false);
        const rows = await this.request<Partial<StrategyRecord>[]>(
          `/strategies?select=${fallbackSelect}&order=created_at.desc`,
          { method: "GET" }
        );
        return rows.map((row) => this.normalizeRow(row));
      }
      if (this.hasSymbolsColumn !== false && this.isMissingSymbolsColumn(error)) {
        this.hasSymbolsColumn = false;
        const fallbackSelect = this.getSelectFields(includePhoto);
        const rows = await this.request<Partial<StrategyRecord>[]>(
          `/strategies?select=${fallbackSelect}&order=created_at.desc`,
          { method: "GET" }
        );
        return rows.map((row) => this.normalizeRow(row));
      }
      throw error;
    }
  }

  async createStrategy(input: CreateStrategyInput): Promise<StrategyRecord> {
    const user_id = await this.getUserId();
    const payload: Record<string, unknown> = {
      user_id,
      name: input.name,
      description: input.description ?? null,
    };
    if (this.hasPhotoUrlColumn !== false) {
      payload.photo_url = input.photo_url ?? null;
    }

    try {
      const rows = await this.request<Partial<StrategyRecord>[]>("/strategies", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify([payload]),
      });
      if (this.hasPhotoUrlColumn === null) this.hasPhotoUrlColumn = "photo_url" in (rows[0] ?? {});
      if (!rows[0]) throw new Error("Strategy creation failed");
      return this.normalizeRow(rows[0]);
    } catch (error) {
      if (this.hasPhotoUrlColumn !== false && this.isMissingPhotoUrlColumn(error)) {
        this.hasPhotoUrlColumn = false;
        const fallbackPayload = [{
          user_id,
          name: input.name,
          description: input.description ?? null,
        }];
        const rows = await this.request<Partial<StrategyRecord>[]>("/strategies", {
          method: "POST",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify(fallbackPayload),
        });
        if (!rows[0]) throw new Error("Strategy creation failed");
        return this.normalizeRow(rows[0]);
      }
      throw error;
    }
  }

  async updateStrategy(id: string, input: UpdateStrategyInput): Promise<StrategyRecord | null> {
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.photo_url !== undefined && this.hasPhotoUrlColumn !== false) payload.photo_url = input.photo_url;

    try {
      const rows = await this.request<Partial<StrategyRecord>[]>(
        `/strategies?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        }
      );
      return rows[0] ? this.normalizeRow(rows[0]) : null;
    } catch (error) {
      if (this.hasPhotoUrlColumn !== false && this.isMissingPhotoUrlColumn(error)) {
        this.hasPhotoUrlColumn = false;
        const fallbackPayload: Record<string, unknown> = {};
        if (input.name !== undefined) fallbackPayload.name = input.name;
        if (input.description !== undefined) fallbackPayload.description = input.description;

        const rows = await this.request<Partial<StrategyRecord>[]>(
          `/strategies?id=eq.${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(fallbackPayload),
          }
        );
        return rows[0] ? this.normalizeRow(rows[0]) : null;
      }
      throw error;
    }
  }

  async deleteStrategy(id: string): Promise<void> {
    await this.request<void>(`/strategies?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }

  async getStrategyNodeMap(id: string): Promise<StrategyNodeMap | null> {
    const includeNodeMap = this.hasNodeMapColumn !== false;
    if (!includeNodeMap) return null;

    try {
      const rows = await this.request<Array<{ id?: string; node_map?: unknown }>>(
        `/strategies?id=eq.${encodeURIComponent(id)}&select=id,node_map&limit=1`,
        { method: "GET" }
      );

      const raw = rows[0]?.node_map;
      const normalized = this.normalizeNodeMap(raw);
      if (!normalized) return null;

      if (this.hasNodeMapColumn === null) this.hasNodeMapColumn = true;
      return normalized;
    } catch (error) {
      if (this.isMissingNodeMapColumn(error)) {
        this.hasNodeMapColumn = false;
        return null;
      }
      throw error;
    }
  }

  async getStrategySymbols(id: string): Promise<StrategyTrackedSymbol[]> {
    if (this.hasSymbolsColumn === false) return [];

    try {
      const rows = await this.request<Array<{ id?: string; symbols?: unknown }>>(
        `/strategies?id=eq.${encodeURIComponent(id)}&select=id,symbols&limit=1`,
        { method: "GET" }
      );
      if (this.hasSymbolsColumn === null) this.hasSymbolsColumn = true;
      return this.normalizeTrackedSymbols(rows[0]?.symbols);
    } catch (error) {
      if (this.isMissingSymbolsColumn(error)) {
        this.hasSymbolsColumn = false;
        return [];
      }
      throw error;
    }
  }

  async saveStrategySymbols(id: string, symbols: StrategyTrackedSymbol[]): Promise<void> {
    if (this.hasSymbolsColumn === false) {
      throw new Error("Missing symbols column. Run backend migration first.");
    }

    const normalized = this.normalizeTrackedSymbols(symbols);

    try {
      await this.request<void>(`/strategies?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ symbols: normalized }),
      });
      if (this.hasSymbolsColumn === null) this.hasSymbolsColumn = true;
    } catch (error) {
      if (this.isMissingSymbolsColumn(error)) {
        this.hasSymbolsColumn = false;
        throw new Error("Missing symbols column. Run backend migration first.");
      }
      throw error;
    }
  }

  async getStrategyUserEnabledSymbols(strategyId: string): Promise<string[] | null> {
    if (this.hasStrategyUserSettingsTable === false) return null;
    const userId = await this.getUserId();

    try {
      const rows = await this.request<Array<{ enabled_symbols?: unknown }>>(
        `/strategy_user_settings?strategy_id=eq.${encodeURIComponent(strategyId)}&user_id=eq.${encodeURIComponent(userId)}&select=enabled_symbols&limit=1`,
        { method: "GET" }
      );
      if (this.hasStrategyUserSettingsTable === null) this.hasStrategyUserSettingsTable = true;
      if (!rows[0]) return null;
      return this.normalizeTickerList(rows[0].enabled_symbols);
    } catch (error) {
      if (this.isMissingStrategyUserSettingsTable(error)) {
        this.hasStrategyUserSettingsTable = false;
        return null;
      }
      throw error;
    }
  }

  async upsertStrategyUserEnabledSymbols(strategyId: string, enabledSymbols: string[]): Promise<string[]> {
    if (this.hasStrategyUserSettingsTable === false) {
      throw new Error("Missing strategy_user_settings table. Run backend migration first.");
    }
    const userId = await this.getUserId();
    const normalized = this.normalizeTickerList(enabledSymbols);

    try {
      const rows = await this.request<Array<{ enabled_symbols?: unknown }>>(
        `/strategy_user_settings?on_conflict=strategy_id,user_id&select=enabled_symbols`,
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify([{
            strategy_id: strategyId,
            user_id: userId,
            enabled_symbols: normalized,
          }]),
        }
      );
      if (this.hasStrategyUserSettingsTable === null) this.hasStrategyUserSettingsTable = true;
      return this.normalizeTickerList(rows[0]?.enabled_symbols ?? normalized);
    } catch (error) {
      if (this.isMissingStrategyUserSettingsTable(error)) {
        this.hasStrategyUserSettingsTable = false;
        throw new Error("Missing strategy_user_settings table. Run backend migration first.");
      }
      throw error;
    }
  }

  async getStrategyUserWebhookConfig(strategyId: string): Promise<StrategyUserWebhookConfig | null> {
    if (this.hasStrategyUserSettingsTable === false) return null;
    const userId = await this.getUserId();

    try {
      const rows = await this.request<Array<{ webhook_config?: unknown }>>(
        `/strategy_user_settings?strategy_id=eq.${encodeURIComponent(strategyId)}&user_id=eq.${encodeURIComponent(userId)}&select=webhook_config&limit=1`,
        { method: "GET" }
      );
      if (this.hasStrategyUserSettingsTable === null) this.hasStrategyUserSettingsTable = true;
      if (!rows[0]) return null;
      return this.normalizeWebhookConfig(rows[0].webhook_config);
    } catch (error) {
      if (this.isMissingStrategyUserSettingsTable(error)) {
        this.hasStrategyUserSettingsTable = false;
        return null;
      }
      throw error;
    }
  }

  async upsertStrategyUserWebhookConfig(strategyId: string, config: StrategyUserWebhookConfig): Promise<StrategyUserWebhookConfig> {
    if (this.hasStrategyUserSettingsTable === false) {
      throw new Error("Missing strategy_user_settings table. Run backend migration first.");
    }
    const userId = await this.getUserId();
    const normalized = this.normalizeWebhookConfig(config);

    try {
      const rows = await this.request<Array<{ webhook_config?: unknown }>>(
        `/strategy_user_settings?on_conflict=strategy_id,user_id&select=webhook_config`,
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify([{
            strategy_id: strategyId,
            user_id: userId,
            webhook_config: normalized,
          }]),
        }
      );
      if (this.hasStrategyUserSettingsTable === null) this.hasStrategyUserSettingsTable = true;
      return this.normalizeWebhookConfig(rows[0]?.webhook_config ?? normalized);
    } catch (error) {
      if (this.isMissingStrategyUserSettingsTable(error)) {
        this.hasStrategyUserSettingsTable = false;
        throw new Error("Missing strategy_user_settings table. Run backend migration first.");
      }
      throw error;
    }
  }

  async saveStrategyNodeMap(id: string, nodeMap: StrategyNodeMap): Promise<void> {
    if (this.hasNodeMapColumn === false) {
      throw new Error("Missing node_map column. Run backend migration first.");
    }

    try {
      await this.request<void>(`/strategies?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ node_map: nodeMap }),
      });
      if (this.hasNodeMapColumn === null) this.hasNodeMapColumn = true;
    } catch (error) {
      if (this.isMissingNodeMapColumn(error)) {
        this.hasNodeMapColumn = false;
        throw new Error("Missing node_map column. Run backend migration first.");
      }
      throw error;
    }
  }

  async listStrategyNodeVersions(strategyId: string): Promise<StrategyNodeVersionRecord[]> {
    if (this.hasNodeVersionsTable === false) return [];

    try {
      const rows = await this.request<Partial<StrategyNodeVersionRecord>[]>(
        `/strategy_node_versions?select=id,strategy_id,name,version_number,is_active,node_map,created_at,updated_at&strategy_id=eq.${encodeURIComponent(strategyId)}&order=version_number.desc`,
        { method: "GET" }
      );
      if (this.hasNodeVersionsTable === null) this.hasNodeVersionsTable = true;
      return rows.map((row) => this.normalizeNodeVersionRow(row));
    } catch (error) {
      if (this.isMissingNodeVersionsTable(error)) {
        this.hasNodeVersionsTable = false;
        return [];
      }
      throw error;
    }
  }

  async createStrategyNodeVersion(strategyId: string, name?: string, activate = true): Promise<StrategyNodeVersionRecord> {
    if (this.hasNodeVersionRpc === false) {
      throw new Error("Missing versioning RPC functions. Run backend migration first.");
    }

    try {
      const row = await this.request<Partial<StrategyNodeVersionRecord>>("/rpc/create_strategy_node_version", {
        method: "POST",
        body: JSON.stringify({
          p_strategy_id: strategyId,
          p_name: name?.trim() ? name.trim() : null,
          p_activate: activate,
        }),
      });
      if (this.hasNodeVersionRpc === null) this.hasNodeVersionRpc = true;
      return this.normalizeNodeVersionRow(row);
    } catch (error) {
      if (this.isMissingRpcFunction(error, "create_strategy_node_version")) {
        this.hasNodeVersionRpc = false;
        throw new Error("Missing versioning RPC functions. Run backend migration first.");
      }
      throw error;
    }
  }

  async activateStrategyNodeVersion(strategyId: string, versionId: string): Promise<StrategyNodeVersionRecord> {
    if (this.hasNodeVersionRpc === false) {
      throw new Error("Missing versioning RPC functions. Run backend migration first.");
    }

    try {
      const row = await this.request<Partial<StrategyNodeVersionRecord>>("/rpc/activate_strategy_node_version", {
        method: "POST",
        body: JSON.stringify({
          p_strategy_id: strategyId,
          p_version_id: versionId,
        }),
      });
      if (this.hasNodeVersionRpc === null) this.hasNodeVersionRpc = true;
      return this.normalizeNodeVersionRow(row);
    } catch (error) {
      if (this.isMissingRpcFunction(error, "activate_strategy_node_version")) {
        this.hasNodeVersionRpc = false;
        throw new Error("Missing versioning RPC functions. Run backend migration first.");
      }
      throw error;
    }
  }

  async executeStrategyNode(input: ExecuteStrategyNodeInput): Promise<ExecuteStrategyNodeResult> {
    return this.invokeFunction<ExecuteStrategyNodeResult>("node-execute", input);
  }

  async getStrategyBacktestMetadata(input: StrategyBacktestMetadataInput): Promise<StrategyBacktestMetadataResult> {
    return this.invokeFunction<StrategyBacktestMetadataResult>("strategy-backtest", {
      action: "metadata",
      strategy_id: input.strategy_id,
      node_map: input.node_map,
      symbol: input.symbol,
      market: input.market,
    });
  }

  async runStrategyBacktest(input: StrategyBacktestRunInput): Promise<StrategyBacktestRunResult> {
    return this.invokeFunction<StrategyBacktestRunResult>("strategy-backtest", {
      action: "run",
      strategy_id: input.strategy_id,
      node_map: input.node_map,
      symbol: input.symbol,
      market: input.market,
      from: input.from,
      to: input.to,
      max_bars: input.max_bars,
      mode: input.mode ?? "preview",
    });
  }
}

export const strategiesService = new StrategiesService();
