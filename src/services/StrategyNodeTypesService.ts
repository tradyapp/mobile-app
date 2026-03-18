import { supabase } from "@/lib/supabase";

export type StrategyNodeCategory = "trigger" | "logic" | "output";

export interface StrategyNodeTypeRecord {
  id: string;
  key: string;
  name: string;
  category: StrategyNodeCategory;
  icon_url: string | null;
  is_active: boolean;
  is_latest: boolean;
}

class StrategyNodeTypesService {
  private hasIsLatestColumn: boolean | null = null;

  private isMissingIsLatestColumn(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
    return message.includes("is_latest") && (
      message.includes("column") ||
      message.includes("schema cache") ||
      message.includes("does not exist")
    );
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === "object") {
      const maybe = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
      const parts = [maybe.message, maybe.details, maybe.hint, maybe.code]
        .filter((part): part is string => typeof part === "string" && part.length > 0);
      if (parts.length > 0) return parts.join(" | ");
    }
    return fallback;
  }

  private normalizeRow(row: Partial<StrategyNodeTypeRecord>): StrategyNodeTypeRecord {
    return {
      id: row.id ?? "",
      key: row.key ?? "",
      name: row.name ?? "",
      category: (row.category ?? "logic") as StrategyNodeCategory,
      icon_url: row.icon_url ?? null,
      is_active: row.is_active ?? true,
      is_latest: row.is_latest ?? true,
    };
  }

  async listActiveNodeTypes(): Promise<StrategyNodeTypeRecord[]> {
    const withLatest = this.hasIsLatestColumn !== false;

    if (withLatest) {
      const { data, error } = await supabase
        .from("strategy_node_types")
        .select("id,key,name,category,icon_url,is_active,is_latest")
        .eq("is_active", true)
        .eq("is_latest", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (!error) {
        if (this.hasIsLatestColumn === null) this.hasIsLatestColumn = true;
        return ((data ?? []) as Partial<StrategyNodeTypeRecord>[]).map((item) => this.normalizeRow(item));
      }

      if (!this.isMissingIsLatestColumn(error)) {
        throw new Error(this.toErrorMessage(error, "Failed to load node types"));
      }

      this.hasIsLatestColumn = false;
    }

    const { data, error } = await supabase
      .from("strategy_node_types")
      .select("id,key,name,category,icon_url,is_active")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(this.toErrorMessage(error, "Failed to load node types"));
    }

    return ((data ?? []) as Partial<StrategyNodeTypeRecord>[]).map((item) => this.normalizeRow(item));
  }
}

export const strategyNodeTypesService = new StrategyNodeTypesService();
