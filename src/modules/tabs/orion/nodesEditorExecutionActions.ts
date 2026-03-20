import { type Edge as RFEdge, type Node as RFNode } from '@xyflow/react';
import { type EditorNodeData, type EditorNodeField, normalizeNodeCategory } from '@/modules/tabs/orion/nodesEditorTypes';
import { getValueType } from '@/modules/tabs/orion/OrionValueView';
import { type LocalExecutionNodeStatus, type LocalExecutionNodeTrace, parseNodeReferenceToken, makeNodeReferenceToken } from '@/modules/tabs/orion/nodesEditorUtils';
import { type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { strategiesService } from '@/services/StrategiesService';

type StateHistoryItem = { nodeId: string; data: unknown };
type SelectedExecutionSymbol = { ticker: string; name: string; market: string } | null;
type ReferenceSourceItem = {
  nodeId: string;
  label: string;
  nodeTypeKey: string;
  data: unknown;
  dataType: string;
  refToken: string;
};
type LocalEvalSpec = { op?: unknown };

function normalizeHandleId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRouteHandlesFromOutput(output: unknown): Set<string> | null {
  if (typeof output === 'boolean') {
    return new Set([output ? 'true' : 'false']);
  }
  if (!isPlainObject(output)) return null;
  if (typeof output.result === 'string') {
    return new Set([normalizeHandleId(output.result)]);
  }
  if (typeof output.result === 'boolean') {
    return new Set([output.result ? 'true' : 'false']);
  }
  return null;
}

function shouldFollowEdge(edge: RFEdge, routeHandles: Set<string> | null, siblingEdges: RFEdge[]): boolean {
  if (!routeHandles) return true;
  const hasNamedHandles = siblingEdges.some((item) => Boolean(item.sourceHandle && item.sourceHandle.trim().length > 0));
  if (!hasNamedHandles) return true;
  if (!edge.sourceHandle) return false;
  return routeHandles.has(normalizeHandleId(edge.sourceHandle));
}

function normalizeFieldKey(field: EditorNodeField): string {
  if (field.key && field.key.trim()) return field.key.trim();
  const base = (field.name ?? '').trim().toLowerCase();
  return base.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function parseFieldValue(field: EditorNodeField): unknown {
  const resolved = (field as EditorNodeField & { resolved?: unknown }).resolved;
  if (resolved !== undefined) return resolved;
  const raw = field.value ?? '';
  const type = (field.type ?? '').toLowerCase();
  if (type === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === 'boolean') {
    const value = raw.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(value)) return true;
    if (['false', '0', 'no'].includes(value)) return false;
    return null;
  }
  return raw;
}

function fieldsToObject(fields: EditorNodeField[] | undefined): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const field of fields ?? []) {
    const key = normalizeFieldKey(field);
    if (!key) continue;
    output[key] = parseFieldValue(field);
  }
  return output;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (isPlainObject(value)) {
    const numericKeys = ['value', 'result', 'percentage', 'change', 'close', 'open', 'high', 'low'];
    for (const key of numericKeys) {
      const nested = normalizeNumber(value[key]);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function findLatestNumericInHistory(history: StateHistoryItem[]): number | null {
  for (const entry of history) {
    const direct = normalizeNumber(entry.data);
    if (direct !== null) return direct;

    if (isPlainObject(entry.data)) {
      const byKeys = ['value', 'result', 'rating', 'close', 'open', 'high', 'low'];
      for (const key of byKeys) {
        const candidate = normalizeNumber(entry.data[key]);
        if (candidate !== null) return candidate;
      }
    }
  }
  return null;
}

function evaluateNumberComparison(left: number, operator: string, right: number): boolean {
  const op = operator.trim().toLowerCase();
  if (op === 'equals' || op === 'eq') return left === right;
  if (op === 'not_equals' || op === 'neq') return left !== right;
  if (op === 'greater_than' || op === 'gt') return left > right;
  if (op === 'greater_or_equal' || op === 'gte') return left >= right;
  if (op === 'less_than' || op === 'lt') return left < right;
  if (op === 'less_or_equal' || op === 'lte') return left <= right;
  return false;
}

function findNodeDataByIdInHistory(history: StateHistoryItem[], nodeId: string): unknown {
  for (const entry of history) {
    if (entry.nodeId === nodeId) return entry.data;
  }
  return null;
}

function resolveExpressionReferences(expression: string, history: StateHistoryItem[]): string {
  const pattern = /ref:\/\/node\/([A-Za-z0-9_-]+)\/data/g;
  return expression.replace(pattern, (_full, nodeId: string) => {
    const data = findNodeDataByIdInHistory(history, nodeId);
    const numeric = normalizeNumber(data);
    if (numeric === null) {
      throw new Error(`Reference ${nodeId} is not a valid number`);
    }
    return String(numeric);
  });
}

function tokenizeMathExpression(expression: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < expression.length) {
    const ch = expression[index];
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }

    if ('+-*/()'.includes(ch)) {
      tokens.push(ch);
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let end = index;
      while (end < expression.length && /[0-9.]/.test(expression[end])) end += 1;
      if (end < expression.length && /[eE]/.test(expression[end])) {
        end += 1;
        if (end < expression.length && /[+-]/.test(expression[end])) end += 1;
        while (end < expression.length && /[0-9]/.test(expression[end])) end += 1;
      }
      const numericToken = expression.slice(index, end);
      const parsed = Number(numericToken);
      if (!Number.isFinite(parsed)) throw new Error(`Invalid number token: ${numericToken}`);
      tokens.push(numericToken);
      index = end;
      continue;
    }

    throw new Error(`Unexpected character in expression: ${ch}`);
  }

  return tokens;
}

function evaluateArithmeticExpression(expression: string): number {
  const tokens = tokenizeMathExpression(expression);
  if (tokens.length === 0) throw new Error('Expression is empty');

  const values: number[] = [];
  const ops: string[] = [];
  const precedence = (op: string): number => (op === '+' || op === '-') ? 1 : 2;

  const applyOp = () => {
    const op = ops.pop();
    if (!op || op === '(') throw new Error('Invalid expression');
    const right = values.pop();
    const left = values.pop();
    if (left === undefined || right === undefined) throw new Error('Invalid expression');

    if (op === '+') values.push(left + right);
    else if (op === '-') values.push(left - right);
    else if (op === '*') values.push(left * right);
    else if (op === '/') {
      if (right === 0) throw new Error('Division by zero');
      values.push(left / right);
    }
  };

  let previous: 'start' | 'number' | 'operator' | 'lparen' | 'rparen' = 'start';
  for (const token of tokens) {
    const numeric = Number(token);
    const isNumber = Number.isFinite(numeric) && !'+-*/()'.includes(token);
    if (isNumber) {
      values.push(numeric);
      previous = 'number';
      continue;
    }

    if (token === '(') {
      ops.push(token);
      previous = 'lparen';
      continue;
    }

    if (token === ')') {
      while (ops.length > 0 && ops[ops.length - 1] !== '(') applyOp();
      if (ops.pop() !== '(') throw new Error('Unbalanced parentheses');
      previous = 'rparen';
      continue;
    }

    if (!'+-*/'.includes(token)) throw new Error('Invalid expression token');

    const isUnaryMinus = token === '-' && (previous === 'start' || previous === 'operator' || previous === 'lparen');
    if (isUnaryMinus) {
      values.push(0);
    } else if (previous !== 'number' && previous !== 'rparen') {
      throw new Error('Invalid expression');
    }

    while (ops.length > 0 && ops[ops.length - 1] !== '(' && precedence(ops[ops.length - 1]) >= precedence(token)) {
      applyOp();
    }
    ops.push(token);
    previous = 'operator';
  }

  while (ops.length > 0) {
    if (ops[ops.length - 1] === '(') throw new Error('Unbalanced parentheses');
    applyOp();
  }

  if (values.length !== 1 || !Number.isFinite(values[0])) throw new Error('Invalid expression result');
  return values[0];
}

function toTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function formatTimestampUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${toTwoDigits(date.getUTCMonth() + 1)}-${toTwoDigits(date.getUTCDate())} ${toTwoDigits(date.getUTCHours())}:${toTwoDigits(date.getUTCMinutes())}:${toTwoDigits(date.getUTCSeconds())}`;
}

function dayOfWeekNameUTC(dayIdx: number): string {
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[dayIdx] ?? 'unknown';
}

function localEvalKey(nodeTypeKey: string, nodeTypeVersion: number | null): string {
  return nodeTypeVersion === null ? nodeTypeKey : `${nodeTypeKey}@${nodeTypeVersion}`;
}

function buildNodeTypeLookup(nodeTypesCatalog: StrategyNodeTypeRecord[] | undefined): Map<string, StrategyNodeTypeRecord> {
  const map = new Map<string, StrategyNodeTypeRecord>();
  for (const item of nodeTypesCatalog ?? []) {
    map.set(localEvalKey(item.key, item.version), item);
    if (item.is_latest) map.set(item.key, item);
  }
  return map;
}

function normalizeLocalEvalSpec(value: unknown): LocalEvalSpec | null {
  if (!isPlainObject(value)) return null;
  return value as LocalEvalSpec;
}

function executeLocalNodeIfSupported(params: {
  nodeData: EditorNodeData;
  resolvedAttributes: EditorNodeField[] | undefined;
  history: StateHistoryItem[];
  nodeTypeLookup: Map<string, StrategyNodeTypeRecord>;
  executionTimeISO: string;
}): { handled: boolean; output?: unknown } {
  const { nodeData, resolvedAttributes, history, nodeTypeLookup, executionTimeISO } = params;
  const key = nodeData.nodeTypeKey ?? '';
  const version = typeof nodeData.nodeTypeVersion === 'number' ? nodeData.nodeTypeVersion : null;
  if (!key) return { handled: false };

  const nodeTypeDef = nodeTypeLookup.get(localEvalKey(key, version)) ?? nodeTypeLookup.get(key);
  if (!nodeTypeDef || nodeTypeDef.local_eval_kind !== 'dsl_v1') return { handled: false };

  const spec = normalizeLocalEvalSpec(nodeTypeDef.local_eval_spec);
  const op = typeof spec?.op === 'string' ? spec.op : '';

  if (key === 'logic.expression' && op === 'math_expression_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const rawExpression = String(attributesObj.expression ?? attributesObj.formula ?? '').trim();
    if (!rawExpression) throw new Error('expression is required');
    if (rawExpression.length > 600) throw new Error('expression is too long');

    const resolvedExpression = resolveExpressionReferences(rawExpression, history);
    const value = evaluateArithmeticExpression(resolvedExpression);

    return {
      handled: true,
      output: {
        result: value,
        value,
        expression: rawExpression,
        resolved_expression: resolvedExpression,
      },
    };
  }

  if (key === 'trigger.schedule' && op === 'schedule_now_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const executionDate = new Date(executionTimeISO);
    const configuredTimezone = typeof attributesObj.timezone === 'string' && attributesObj.timezone.trim().length > 0
      ? attributesObj.timezone
      : 'UTC';

    return {
      handled: true,
      output: {
        type: 'schedule_event',
        timestamp: formatTimestampUTC(executionDate),
        year: executionDate.getUTCFullYear(),
        month: executionDate.getUTCMonth() + 1,
        day: executionDate.getUTCDate(),
        hour: executionDate.getUTCHours(),
        minute: executionDate.getUTCMinutes(),
        second: executionDate.getUTCSeconds(),
        day_of_week: executionDate.getUTCDay(),
        day_of_week_name: dayOfWeekNameUTC(executionDate.getUTCDay()),
        iso_utc: executionDate.toISOString(),
        timezone: configuredTimezone,
        config: {
          hour: Number(attributesObj.hour ?? 9),
          minute: Number(attributesObj.minute ?? 0),
          days_of_week: attributesObj.days_of_week ?? ['mon', 'tue', 'wed', 'thu', 'fri'],
          timezone: configuredTimezone,
        },
      },
    };
  }

  if (key === 'logic.compare_number' && op === 'compare_number_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const leftFromAttr = normalizeNumber(attributesObj.left_value);
    const rightFromAttr = normalizeNumber(attributesObj.right_value);
    const operator = String(attributesObj.operator ?? 'greater_than');
    const left = leftFromAttr ?? findLatestNumericInHistory(history);

    if (left === null || rightFromAttr === null) {
      throw new Error('compare_number requires valid left and right numeric values');
    }

    const result = evaluateNumberComparison(left, operator, rightFromAttr);
    return {
      handled: true,
      output: {
        result,
        left,
        right: rightFromAttr,
        operator,
      },
    };
  }

  return { handled: false };
}

export function resolveAttributeReferences(fields: EditorNodeField[] | undefined, history: StateHistoryItem[]): EditorNodeField[] | undefined {
  if (!Array.isArray(fields) || fields.length === 0) return fields;
  const historyByNodeId = new Map<string, unknown>();
  for (const entry of history) {
    historyByNodeId.set(entry.nodeId, entry.data);
  }

  return fields.map((field) => {
    const reference = parseNodeReferenceToken(field.value);
    if (!reference) return field;
    if (!historyByNodeId.has(reference.nodeId)) {
      throw new Error(`Reference not found for node ${reference.nodeId}`);
    }
    return {
      ...field,
      resolved: historyByNodeId.get(reference.nodeId),
    } as EditorNodeField & { resolved: unknown };
  });
}

export async function loadReferenceSourcesForNode(params: {
  targetNodeId: string;
  strategyId: string;
  nodes: RFNode[];
  edges: RFEdge[];
  selectedExecutionTicker: string;
  selectedExecutionSymbol: SelectedExecutionSymbol;
}): Promise<ReferenceSourceItem[]> {
  const { targetNodeId, strategyId, nodes, edges, selectedExecutionTicker, selectedExecutionSymbol } = params;
  if (!selectedExecutionTicker.trim()) {
    throw new Error('Select a strategy symbol before connecting references.');
  }

  const nodeById = new Map<string, RFNode>();
  const indegree = new Map<string, number>();
  const outgoingByNodeId = new Map<string, string[]>();
  const incomingByNodeId = new Map<string, string[]>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
    indegree.set(node.id, 0);
    outgoingByNodeId.set(node.id, []);
    incomingByNodeId.set(node.id, []);
  }
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoingByNodeId.set(edge.source, [...(outgoingByNodeId.get(edge.source) ?? []), edge.target]);
    incomingByNodeId.set(edge.target, [...(incomingByNodeId.get(edge.target) ?? []), edge.source]);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const upstreamSet = new Set<string>();
  const walk = (nodeId: string) => {
    for (const parentId of incomingByNodeId.get(nodeId) ?? []) {
      if (upstreamSet.has(parentId)) continue;
      upstreamSet.add(parentId);
      walk(parentId);
    }
  };
  walk(targetNodeId);

  const queue: string[] = [];
  for (const node of nodes) {
    if ((indegree.get(node.id) ?? 0) === 0) queue.push(node.id);
  }
  const orderedNodeIds: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    orderedNodeIds.push(current);
    for (const next of outgoingByNodeId.get(current) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  const stateHistory: StateHistoryItem[] = [];
  const executionTime = new Date().toISOString();

  for (const nodeId of orderedNodeIds) {
    if (!upstreamSet.has(nodeId)) continue;
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const nodeData = (node.data ?? {}) as EditorNodeData;
    const frozenHistory = [...stateHistory].reverse();
    const resolvedAttributes = resolveAttributeReferences(nodeData.attributes, frozenHistory);

    const execution = await strategiesService.executeStrategyNode({
      strategy_id: strategyId,
      node_type_key: nodeData.nodeTypeKey ?? 'custom-node',
      node_type_version: typeof nodeData.nodeTypeVersion === 'number' ? nodeData.nodeTypeVersion : null,
      attributes: resolvedAttributes,
      input_context: {
        execution_symbol: selectedExecutionSymbol
          ? {
            ticker: selectedExecutionSymbol.ticker,
            name: selectedExecutionSymbol.name,
            market: selectedExecutionSymbol.market,
          }
          : { ticker: selectedExecutionTicker },
        state_history: frozenHistory,
      },
      mode: 'preview',
      execution_time: executionTime,
    });

    stateHistory.push({ nodeId, data: execution.output });
  }

  return [...stateHistory]
    .reverse()
    .map((entry) => {
      const sourceNode = nodeById.get(entry.nodeId);
      const sourceData = (sourceNode?.data ?? {}) as EditorNodeData;
      return {
        nodeId: entry.nodeId,
        label: sourceData.label ?? entry.nodeId,
        nodeTypeKey: sourceData.nodeTypeKey ?? 'custom-node',
        data: entry.data,
        dataType: getValueType(entry.data),
        refToken: makeNodeReferenceToken(entry.nodeId),
      } satisfies ReferenceSourceItem;
    });
}

export async function runLocalExecution(params: {
  strategyId: string;
  nodes: RFNode[];
  edges: RFEdge[];
  nodeTypesCatalog?: StrategyNodeTypeRecord[];
  localExecutionStatus: 'idle' | 'running' | 'completed' | 'failed';
  selectedExecutionTicker: string;
  selectedExecutionSymbol: SelectedExecutionSymbol;
  onStatusChange: (status: 'running' | 'failed' | 'completed') => void;
  onErrorChange: (error: string | null) => void;
  onTracesChange: (traces: LocalExecutionNodeTrace[]) => void;
  onExecutionStatusByNodeChange: (byNode: Record<string, LocalExecutionNodeStatus>) => void;
}): Promise<void> {
  const {
    strategyId,
    nodes,
    edges,
    nodeTypesCatalog,
    localExecutionStatus,
    selectedExecutionTicker,
    selectedExecutionSymbol,
    onStatusChange,
    onErrorChange,
    onTracesChange,
    onExecutionStatusByNodeChange,
  } = params;

  if (localExecutionStatus === 'running') return;

  if (nodes.length === 0) {
    onStatusChange('failed');
    onErrorChange('Add at least one node before running local execution.');
    onTracesChange([]);
    onExecutionStatusByNodeChange({});
    return;
  }

  if (!selectedExecutionTicker.trim()) {
    onStatusChange('failed');
    onErrorChange('Select a strategy symbol before running local execution.');
    onTracesChange([]);
    onExecutionStatusByNodeChange({});
    return;
  }

  onStatusChange('running');
  onErrorChange(null);

  const nodeById = new Map<string, RFNode>();
  const outgoingByNodeId = new Map<string, RFEdge[]>();
  const indegree = new Map<string, number>();

  for (const node of nodes) {
    nodeById.set(node.id, node);
    outgoingByNodeId.set(node.id, []);
    indegree.set(node.id, 0);
  }
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoingByNodeId.set(edge.source, [...(outgoingByNodeId.get(edge.source) ?? []), edge]);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((indegree.get(node.id) ?? 0) === 0) queue.push(node.id);
  }
  const rootNodeIds = [...queue];
  queue.sort((a, b) => {
    const nodeA = nodeById.get(a);
    const nodeB = nodeById.get(b);
    const categoryA = normalizeNodeCategory((nodeA?.data as EditorNodeData | undefined)?.category);
    const categoryB = normalizeNodeCategory((nodeB?.data as EditorNodeData | undefined)?.category);
    if (categoryA === categoryB) return a.localeCompare(b);
    if (categoryA === 'trigger') return -1;
    if (categoryB === 'trigger') return 1;
    return categoryA.localeCompare(categoryB);
  });

  const orderedNodeIds: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    orderedNodeIds.push(current);
    for (const edge of outgoingByNodeId.get(current) ?? []) {
      const remaining = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, remaining);
      if (remaining === 0) queue.push(edge.target);
    }
  }
  for (const node of nodes) {
    if (!orderedNodeIds.includes(node.id)) orderedNodeIds.push(node.id);
  }

  const tracesById = new Map<string, LocalExecutionNodeTrace>();
  const executionStatusByNodeId: Record<string, LocalExecutionNodeStatus> = {};
  const nodeTypeLookup = buildNodeTypeLookup(nodeTypesCatalog);
  for (const nodeId of orderedNodeIds) {
    const node = nodeById.get(nodeId)!;
    const nodeData = (node.data ?? {}) as EditorNodeData;
    tracesById.set(nodeId, {
      nodeId,
      label: nodeData.label ?? nodeId,
      nodeTypeKey: nodeData.nodeTypeKey ?? 'custom-node',
      nodeTypeVersion: typeof nodeData.nodeTypeVersion === 'number' ? nodeData.nodeTypeVersion : null,
      status: 'pending',
      inputSnapshot: null,
      outputSnapshot: null,
      error: null,
    });
    executionStatusByNodeId[nodeId] = 'pending';
  }

  const sync = () => {
    onExecutionStatusByNodeChange({ ...executionStatusByNodeId });
    onTracesChange(orderedNodeIds.map((nodeId) => tracesById.get(nodeId)!));
  };
  sync();

  const stateHistory: StateHistoryItem[] = [];
  const executionTime = new Date().toISOString();
  const activeNodeIds = new Set<string>(rootNodeIds);

  for (let i = 0; i < orderedNodeIds.length; i += 1) {
    const nodeId = orderedNodeIds[i];
    if (!activeNodeIds.has(nodeId)) continue;
    const trace = tracesById.get(nodeId);
    const node = nodeById.get(nodeId);
    if (!trace || !node) continue;

    trace.status = 'running';
    executionStatusByNodeId[nodeId] = 'running';
    sync();
    await new Promise((resolve) => window.setTimeout(resolve, 120));

    const nodeData = (node.data ?? {}) as EditorNodeData;
    const frozenHistory = [...stateHistory].reverse();
    const resolvedAttributes = resolveAttributeReferences(nodeData.attributes, frozenHistory);
    trace.inputSnapshot = frozenHistory;

    try {
      const localResult = executeLocalNodeIfSupported({
        nodeData,
        resolvedAttributes,
        history: frozenHistory,
        nodeTypeLookup,
        executionTimeISO: executionTime,
      });

      if (localResult.handled) {
        trace.outputSnapshot = localResult.output;
      } else {
        const execution = await strategiesService.executeStrategyNode({
          strategy_id: strategyId,
          node_type_key: nodeData.nodeTypeKey ?? 'custom-node',
          node_type_version: typeof nodeData.nodeTypeVersion === 'number' ? nodeData.nodeTypeVersion : null,
          attributes: resolvedAttributes,
          input_context: {
            execution_symbol: selectedExecutionSymbol
              ? {
                ticker: selectedExecutionSymbol.ticker,
                name: selectedExecutionSymbol.name,
                market: selectedExecutionSymbol.market,
              }
              : { ticker: selectedExecutionTicker },
            state_history: frozenHistory,
          },
          mode: 'preview',
          execution_time: executionTime,
        });
        trace.outputSnapshot = execution.output;
      }

      trace.status = 'success';
      executionStatusByNodeId[nodeId] = 'success';
      trace.error = null;
      stateHistory.push({ nodeId, data: trace.outputSnapshot });

      const routeHandles = getRouteHandlesFromOutput(trace.outputSnapshot);
      const siblingEdges = outgoingByNodeId.get(nodeId) ?? [];
      for (const edge of siblingEdges) {
        if (!shouldFollowEdge(edge, routeHandles, siblingEdges)) continue;
        activeNodeIds.add(edge.target);
      }
    } catch (error) {
      trace.status = 'error';
      executionStatusByNodeId[nodeId] = 'error';
      trace.error = error instanceof Error ? error.message : 'Execution error';
      onStatusChange('failed');
      onErrorChange(`Node failed: ${trace.label}${selectedExecutionTicker ? ` · ${selectedExecutionTicker}` : ''}`);
      sync();
      return;
    }

    sync();
  }

  onStatusChange('completed');
  onErrorChange(null);
}
