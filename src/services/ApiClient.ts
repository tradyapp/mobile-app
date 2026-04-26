import { supabase } from "@/lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const API_URL = import.meta.env.VITE_TRADY_API_URL || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : "");

interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  private async prepareHeaders(requireAuth = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (requireAuth) {
      const token = await this.getAuthToken();
      if (!token) throw new Error("Authentication required but no token available");
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options;
    const url = `${this.baseUrl}${endpoint}`;

    const headers = await this.prepareHeaders(requireAuth);
    const response = await fetch(url, {
      method: "GET",
      headers: { ...headers, ...fetchOptions.headers },
      ...fetchOptions,
    });

    if (!response.ok) await this.handleErrorResponse(response);
    return await response.json();
  }

  async post<T>(endpoint: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options;
    const url = `${this.baseUrl}${endpoint}`;

    const headers = await this.prepareHeaders(requireAuth);
    const response = await fetch(url, {
      method: "POST",
      headers: { ...headers, ...fetchOptions.headers },
      body: data ? JSON.stringify(data) : undefined,
      ...fetchOptions,
    });

    if (!response.ok) await this.handleErrorResponse(response);
    return await response.json();
  }

  async put<T>(endpoint: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options;

    const headers = await this.prepareHeaders(requireAuth);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: { ...headers, ...fetchOptions.headers },
      body: data ? JSON.stringify(data) : undefined,
      ...fetchOptions,
    });

    if (!response.ok) await this.handleErrorResponse(response);
    return await response.json();
  }

  async patch<T>(endpoint: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options;

    const headers = await this.prepareHeaders(requireAuth);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PATCH",
      headers: { ...headers, ...fetchOptions.headers },
      body: data ? JSON.stringify(data) : undefined,
      ...fetchOptions,
    });

    if (!response.ok) await this.handleErrorResponse(response);
    return await response.json();
  }

  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options;

    const headers = await this.prepareHeaders(requireAuth);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "DELETE",
      headers: { ...headers, ...fetchOptions.headers },
      ...fetchOptions,
    });

    if (!response.ok) await this.handleErrorResponse(response);
    return await response.json();
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `API error: ${response.status} ${response.statusText}`;

    try {
      const errorData = await response.json();
      if (errorData.error) errorMessage = errorData.error;
    } catch {
      // no-op
    }

    throw new Error(errorMessage);
  }

  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }
}

export const apiClient = new ApiClient();
