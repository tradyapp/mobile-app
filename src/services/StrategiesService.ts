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
        if (payload?.message) message = payload.message;
      } catch {
        // no-op
      }
      throw new Error(message);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async listStrategies(): Promise<StrategyRecord[]> {
    return this.request<StrategyRecord[]>(
      "/strategies?select=id,user_id,name,description,photo_url,created_at,updated_at&order=created_at.desc",
      { method: "GET" }
    );
  }

  async createStrategy(input: CreateStrategyInput): Promise<StrategyRecord> {
    const user_id = await this.getUserId();
    const payload = [{
      user_id,
      name: input.name,
      description: input.description ?? null,
      photo_url: input.photo_url ?? null,
    }];

    const rows = await this.request<StrategyRecord[]>("/strategies", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!rows[0]) throw new Error("Strategy creation failed");
    return rows[0];
  }

  async updateStrategy(id: string, input: UpdateStrategyInput): Promise<StrategyRecord | null> {
    const rows = await this.request<StrategyRecord[]>(
      `/strategies?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(input),
      }
    );
    return rows[0] ?? null;
  }

  async deleteStrategy(id: string): Promise<void> {
    await this.request<void>(`/strategies?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }
}

export const strategiesService = new StrategiesService();
