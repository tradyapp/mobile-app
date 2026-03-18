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
  created_at: string;
  updated_at: string;
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

  private normalizeRow(row: Partial<StrategyRecord>): StrategyRecord {
    return {
      id: row.id ?? "",
      user_id: row.user_id ?? "",
      name: row.name ?? "",
      description: row.description ?? null,
      photo_url: row.photo_url ?? null,
      created_at: row.created_at ?? "",
      updated_at: row.updated_at ?? "",
    };
  }

  private getSelectFields(includePhoto: boolean): string {
    const fields = ["id", "user_id", "name", "description"];
    if (includePhoto) fields.push("photo_url");
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
}

export const strategiesService = new StrategiesService();
