import { type EditorNodeData, type EditorNodeField, normalizeNodeCategory } from '@/modules/tabs/orion/nodesEditorTypes';
import { type StrategyNodePropertyRecord, type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { type StrategyTrackedSymbol } from '@/services/StrategiesService';

export type NodeDetailsPanel = 'inputs' | 'attributes' | 'outputs';
export type NodeDetailsPanelItem = { key: NodeDetailsPanel; label: string };
export type NodeSymbolFilter = 'ALL' | StrategyTrackedSymbol['market'];
export type LocalExecutionStatus = 'idle' | 'running' | 'completed' | 'failed';
export type LocalExecutionNodeStatus = 'pending' | 'running' | 'success' | 'error';

export interface LocalExecutionNodeTrace {
  nodeId: string;
  label: string;
  nodeTypeKey: string;
  nodeTypeVersion: number | null;
  status: LocalExecutionNodeStatus;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  error: string | null;
}

const NODE_REFERENCE_PREFIX = 'ref://node/';

export function makeNodeReferenceToken(nodeId: string): string {
  return `${NODE_REFERENCE_PREFIX}${nodeId}/data`;
}

export function parseNodeReferenceToken(raw: string | undefined): { nodeId: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(NODE_REFERENCE_PREFIX)) return null;
  const suffix = trimmed.slice(NODE_REFERENCE_PREFIX.length);
  const [nodeId, terminal] = suffix.split('/');
  if (!nodeId || terminal !== 'data') return null;
  return { nodeId };
}

function makeFieldId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function toFieldDefaultValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function mapPropertiesToInputs(properties: StrategyNodePropertyRecord[] | undefined): EditorNodeField[] {
  if (!Array.isArray(properties)) return [];
  return properties.map((item, index) => ({
    id: makeFieldId('input'),
    key: item.key?.trim() || undefined,
    name: item.label?.trim() || item.key?.trim() || `Input ${index + 1}`,
    type: item.type || 'text',
    value: String(item.type || '').trim().toLowerCase() === 'multi_select' && Array.isArray(item.default)
      ? item.default
        .filter((value): value is string | number | boolean => (
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ))
        .map((value) => String(value))
        .join(',')
      : toFieldDefaultValue(item.default),
    options: Array.isArray(item.options) ? item.options : undefined,
    required: true,
  }));
}

function mapPortsToFlowFields(
  ports: Array<{ label?: string; key?: string; type?: string }> | undefined,
  prefix: 'in' | 'out',
  fallbackLabel: string
): EditorNodeField[] {
  if (!Array.isArray(ports)) return [];
  return ports.map((item, index) => ({
    id: makeFieldId(prefix),
    key: item.key?.trim() || undefined,
    name: item.label?.trim() || item.key?.trim() || `${fallbackLabel} ${index + 1}`,
    type: item.type || 'any',
    required: true,
  }));
}

export function createNodeDefaults(nodeType: StrategyNodeTypeRecord): Pick<EditorNodeData, 'inputs' | 'attributes' | 'outputs'> {
  const normalized = normalizeNodeCategory(nodeType.category);
  const attributesFromProperties = mapPropertiesToInputs(nodeType.properties);
  const inputsFromNodeType = mapPortsToFlowFields(nodeType.input_ports, 'in', 'Input');
  const outputsFromNodeType = mapPortsToFlowFields(nodeType.output_ports, 'out', 'Output');

  if (normalized === 'trigger') {
    return {
      inputs: [],
      attributes: attributesFromProperties,
      outputs: outputsFromNodeType.length > 0
        ? outputsFromNodeType
        : [{ id: makeFieldId('out'), name: 'event', type: 'signal' }],
    };
  }

  if (normalized === 'output') {
    return {
      inputs: inputsFromNodeType.length > 0
        ? inputsFromNodeType
        : [{ id: makeFieldId('in'), name: 'signal', type: 'signal', required: true }],
      attributes: attributesFromProperties,
      outputs: [],
    };
  }

  return {
    inputs: inputsFromNodeType.length > 0
      ? inputsFromNodeType
      : [{ id: makeFieldId('in'), name: 'input', type: 'number', required: true }],
    attributes: attributesFromProperties,
    outputs: outputsFromNodeType.length > 0
      ? outputsFromNodeType
      : [{ id: makeFieldId('out'), name: 'result', type: 'number' }],
  };
}

function formatTimezoneOffset(timeZone: string, date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const tzName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'UTC';
    return tzName.replace(/^GMT/i, 'UTC');
  } catch {
    return 'UTC';
  }
}

export function buildTimezoneOptions(date: Date = new Date()): Array<{ value: string; label: string }> {
  const supported = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

  return supported.map((timeZone) => ({
    value: timeZone,
    label: `${timeZone} (${formatTimezoneOffset(timeZone, date)})`,
  }));
}
