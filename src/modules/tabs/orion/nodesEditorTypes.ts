import { type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';

export interface EditorNodeData {
  label: string;
  nodeTypeKey?: string;
  category?: string;
  iconUrl?: string | null;
  inputs?: EditorNodeField[];
  attributes?: EditorNodeField[];
  outputs?: EditorNodeField[];
}

export interface EditorNodeField {
  id: string;
  key?: string;
  name: string;
  type: string;
  required?: boolean;
  value?: string;
}

export interface NodeTypeCategoryGroup {
  key: string;
  label: string;
  items: StrategyNodeTypeRecord[];
}

const NODE_CATEGORY_SORT_WEIGHT: Record<string, number> = {
  trigger: 0,
  condition: 1,
  logic: 2,
  action: 3,
  output: 4,
  uncategorized: 99,
};

export function normalizeNodeCategory(value?: string | null): string {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : 'uncategorized';
}

export function formatNodeCategoryLabel(key: string): string {
  if (key === 'uncategorized') return 'Uncategorized';
  return key
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export function compareNodeCategory(a: string, b: string): number {
  const weightA = NODE_CATEGORY_SORT_WEIGHT[a] ?? 50;
  const weightB = NODE_CATEGORY_SORT_WEIGHT[b] ?? 50;
  if (weightA !== weightB) return weightA - weightB;
  return a.localeCompare(b);
}
