import { supabase } from "@/lib/supabase";

export type StrategyNodeCategory = "trigger" | "logic" | "output";

export interface StrategyNodePortRecord {
  key: string;
  type: string;
  label: string;
}

export interface StrategyNodePropertyRecord {
  key: string;
  type: "number" | "text" | "boolean" | string;
  label: string;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
}

export interface StrategyNodeTypeRecord {
  id: string;
  key: string;
  version: number;
  name: string;
  category: StrategyNodeCategory;
  icon_url: string | null;
  description?: string | null;
  input_ports?: StrategyNodePortRecord[];
  output_ports?: StrategyNodePortRecord[];
  properties?: StrategyNodePropertyRecord[];
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
    const normalizePorts = (value: unknown): StrategyNodePortRecord[] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const raw = item as { key?: unknown; type?: unknown; label?: unknown };
          const key = typeof raw.key === "string" ? raw.key : "";
          const type = typeof raw.type === "string" ? raw.type : "any";
          const label = typeof raw.label === "string" ? raw.label : key || "Port";
          if (!key && !label) return null;
          return { key, type, label };
        })
        .filter((item): item is StrategyNodePortRecord => item !== null);
    };

    const normalizeProperties = (value: unknown): StrategyNodePropertyRecord[] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const raw = item as { key?: unknown; type?: unknown; label?: unknown; default?: unknown; options?: unknown };
          const key = typeof raw.key === "string" ? raw.key : "";
          const type = typeof raw.type === "string" ? raw.type : "text";
          const label = typeof raw.label === "string" ? raw.label : key || "Field";
          const options = Array.isArray(raw.options)
            ? raw.options
              .map((opt) => {
                if (typeof opt === "string" || typeof opt === "number" || typeof opt === "boolean") {
                  const value = String(opt);
                  return { value, label: value };
                }
                if (!opt || typeof opt !== "object") return null;
                const optionRaw = opt as { value?: unknown; label?: unknown };
                const optionValue = optionRaw.value;
                if (typeof optionValue !== "string" && typeof optionValue !== "number" && typeof optionValue !== "boolean") return null;
                const value = String(optionValue);
                const optionLabel = typeof optionRaw.label === "string" && optionRaw.label.trim().length > 0
                  ? optionRaw.label
                  : value;
                return { value, label: optionLabel };
              })
              .filter((opt): opt is { value: string; label: string } => opt !== null)
            : undefined;
          return { key, type, label, default: raw.default, options };
        })
        .filter((item): item is StrategyNodePropertyRecord => item !== null);
    };

    return {
      id: row.id ?? "",
      key: row.key ?? "",
      version: typeof row.version === "number" && Number.isFinite(row.version) ? row.version : 1,
      name: row.name ?? "",
      category: (row.category ?? "logic") as StrategyNodeCategory,
      icon_url: row.icon_url ?? null,
      description: row.description ?? null,
      input_ports: normalizePorts(row.input_ports),
      output_ports: normalizePorts(row.output_ports),
      properties: normalizeProperties(row.properties),
      is_active: row.is_active ?? true,
      is_latest: row.is_latest ?? true,
    };
  }

  async listActiveNodeTypes(): Promise<StrategyNodeTypeRecord[]> {
    const withLatest = this.hasIsLatestColumn !== false;

    if (withLatest) {
      const { data, error } = await supabase
        .from("strategy_node_types")
        .select("id,key,version,name,description,category,icon_url,input_ports,output_ports,properties,is_active,is_latest")
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
      .select("id,key,version,name,description,category,icon_url,input_ports,output_ports,properties,is_active")
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
