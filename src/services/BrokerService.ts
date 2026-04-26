import { apiClient } from "./ApiClient";

export type BrokerAssetType = "STOCKS" | "CRYPTO" | "FOREX";
export type BrokerOrderSide = "buy" | "sell";
export type BrokerOrderType = "market" | "limit" | "stop" | "stoplimit";
export type BrokerOrderTif = "day" | "gtc";
export type BrokerOrderStatus = "open" | "completed" | "canceled" | "declined";

export interface BrokerAccount {
  id: string;
  name: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface BrokerOrder {
  id: string;
  account_id: string;
  symbol: string;
  asset_type: BrokerAssetType;
  side: BrokerOrderSide;
  quantity: number;
  type: BrokerOrderType;
  action_price: number | number[] | null;
  tif: BrokerOrderTif;
  status: BrokerOrderStatus;
  fill_price: number | null;
  details: Record<string, unknown> | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrokerPosition {
  id: string;
  account_id: string;
  symbol: string;
  asset_type: BrokerAssetType;
  quantity: number;
  avg_price: number;
  current_price: number | null;
  cost_basis: number;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  sym_name: string | null;
  sym_icon_url: string | null;
  price_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountInput {
  name: string;
  balance?: number;
}

export interface CreateOrderInput {
  account_id: string;
  symbol: string;
  asset_type: BrokerAssetType;
  side: BrokerOrderSide;
  quantity: number;
  type: BrokerOrderType;
  action_price?: number | number[] | null;
  tif?: BrokerOrderTif;
}

export interface EditOrderInput {
  quantity?: number;
  action_price?: number | number[] | null;
  tif?: BrokerOrderTif;
}

class BrokerService {
  // ── Accounts ──

  async listAccounts(): Promise<BrokerAccount[]> {
    const res = await apiClient.get<{ accounts: BrokerAccount[] }>("/broker-accounts");
    return res.accounts;
  }

  async createAccount(input: CreateAccountInput): Promise<BrokerAccount> {
    const res = await apiClient.post<{ account: BrokerAccount }>("/broker-accounts", input);
    return res.account;
  }

  async getAccount(accountId: string): Promise<BrokerAccount> {
    const res = await apiClient.get<{ account: BrokerAccount }>(`/broker-accounts/${accountId}`);
    return res.account;
  }

  async renameAccount(accountId: string, name: string): Promise<BrokerAccount> {
    const res = await apiClient.patch<{ account: BrokerAccount }>(
      `/broker-accounts/${accountId}`,
      { name },
    );
    return res.account;
  }

  async fundAccount(accountId: string, amount: number): Promise<BrokerAccount> {
    const res = await apiClient.post<{ account: BrokerAccount }>(
      `/broker-accounts/${accountId}/fund`,
      { amount },
    );
    return res.account;
  }

  async withdrawAccount(accountId: string, amount: number): Promise<BrokerAccount> {
    const res = await apiClient.post<{ account: BrokerAccount }>(
      `/broker-accounts/${accountId}/withdraw`,
      { amount },
    );
    return res.account;
  }

  async deleteAccount(accountId: string): Promise<void> {
    await apiClient.delete(`/broker-accounts/${accountId}`);
  }

  // ── Orders ──

  async listOrders(params: {
    accountId: string;
    assetType?: BrokerAssetType | "all";
    status?: BrokerOrderStatus | "all";
    limit?: number;
  }): Promise<BrokerOrder[]> {
    const search = new URLSearchParams({ account_id: params.accountId });
    if (params.assetType) search.set("asset_type", params.assetType);
    if (params.status) search.set("status", params.status);
    if (params.limit) search.set("limit", String(params.limit));
    const res = await apiClient.get<{ orders: BrokerOrder[] }>(`/broker-orders?${search.toString()}`);
    return res.orders;
  }

  async createOrder(input: CreateOrderInput): Promise<BrokerOrder> {
    const res = await apiClient.post<{ order: BrokerOrder }>("/broker-orders", input);
    return res.order;
  }

  async getOrder(orderId: string): Promise<BrokerOrder> {
    const res = await apiClient.get<{ order: BrokerOrder }>(`/broker-orders/${orderId}`);
    return res.order;
  }

  async editOrder(orderId: string, updates: EditOrderInput): Promise<BrokerOrder> {
    const res = await apiClient.patch<{ order: BrokerOrder }>(
      `/broker-orders/${orderId}`,
      updates,
    );
    return res.order;
  }

  async cancelOrder(orderId: string): Promise<BrokerOrder> {
    const res = await apiClient.delete<{ order: BrokerOrder }>(`/broker-orders/${orderId}`);
    return res.order;
  }

  // ── Positions ──

  async listPositions(params: {
    accountId: string;
    assetType?: BrokerAssetType | "all";
  }): Promise<BrokerPosition[]> {
    const search = new URLSearchParams({ account_id: params.accountId });
    if (params.assetType) search.set("asset_type", params.assetType);
    const res = await apiClient.get<{ positions: BrokerPosition[] }>(
      `/broker-positions?${search.toString()}`,
    );
    return res.positions;
  }
}

export const brokerService = new BrokerService();
