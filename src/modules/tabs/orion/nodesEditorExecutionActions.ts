import { type Edge as RFEdge, type Node as RFNode } from '@xyflow/react';
import { type EditorNodeData, type EditorNodeField, normalizeNodeCategory } from '@/modules/tabs/orion/nodesEditorTypes';
import { getValueType } from '@/modules/tabs/orion/OrionValueView';
import { type LocalExecutionNodeStatus, type LocalExecutionNodeTrace, parseNodeReferenceToken, makeNodeReferenceToken } from '@/modules/tabs/orion/nodesEditorUtils';
import { type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { strategiesService, type StrategyCompilePlan } from '@/services/StrategiesService';

type StateHistoryItem = { nodeId: string; data: unknown };
type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};
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
type CompiledEdge = { target: string; source_handle: string | null };
type BacktestCandleInput = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

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

function shouldFollowCompiledEdge(edge: CompiledEdge, routeHandles: Set<string> | null, siblingEdges: CompiledEdge[]): boolean {
  if (!routeHandles) return true;
  const hasNamedHandles = siblingEdges.some((item) => Boolean(item.source_handle && item.source_handle.trim().length > 0));
  if (!hasNamedHandles) return true;
  if (!edge.source_handle) return false;
  return routeHandles.has(normalizeHandleId(edge.source_handle));
}

function toBacktestCandle(value: BacktestCandleInput): Candle {
  const volumeRaw = value.volume;
  const volume = volumeRaw === null || volumeRaw === undefined
    ? null
    : Number.isFinite(Number(volumeRaw))
      ? Number(volumeRaw)
      : null;
  return {
    datetime: String(value.datetime),
    open: Number(value.open),
    high: Number(value.high),
    low: Number(value.low),
    close: Number(value.close),
    volume,
  };
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
    const numericKeys = ['value', 'result', 'percentage', 'rating', 'change', 'close', 'open', 'high', 'low'];
    for (const key of numericKeys) {
      const nested = normalizeNumber(value[key]);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
    return null;
  }
  return null;
}

function normalizeCandle(value: unknown): Candle | null {
  if (!isPlainObject(value)) return null;
  const datetime = String(value.datetime ?? '');
  const open = Number(value.open);
  const high = Number(value.high);
  const low = Number(value.low);
  const close = Number(value.close);
  if (!datetime || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return null;
  }
  const volumeRaw = value.volume;
  const volume = volumeRaw === null || volumeRaw === undefined
    ? null
    : Number.isFinite(Number(volumeRaw))
      ? Number(volumeRaw)
      : null;
  return { datetime, open, high, low, close, volume };
}

function normalizeCandleArray(value: unknown): Candle[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeCandle(item))
    .filter((item): item is Candle => item !== null);
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

function findLatestValueInHistory(history: StateHistoryItem[]): unknown {
  for (const entry of history) {
    if (entry.data !== undefined) return entry.data;
  }
  return null;
}

function findLatestCandleInHistory(history: StateHistoryItem[]): Candle | null {
  for (const entry of history) {
    const candle = normalizeCandle(entry.data);
    if (candle) return candle;
  }
  return null;
}

function findLatestCandleArrayInHistory(history: StateHistoryItem[]): Candle[] {
  for (const entry of history) {
    const candles = normalizeCandleArray(entry.data);
    if (candles.length > 0) return candles;
  }
  return [];
}

function findLatestObjectInHistory(history: StateHistoryItem[]): Record<string, unknown> | null {
  for (const entry of history) {
    if (isPlainObject(entry.data)) return entry.data;
  }
  return null;
}

function getCandleChange(candle: Candle): number {
  return Math.abs(candle.close - candle.open);
}

function getCandleBodySize(candle: Candle): number {
  return Math.abs(candle.close - candle.open);
}

function getCandleTopWickSize(candle: Candle): number {
  return Math.max(0, candle.high - Math.max(candle.open, candle.close));
}

function getCandleBottomWickSize(candle: Candle): number {
  return Math.max(0, Math.min(candle.open, candle.close) - candle.low);
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

function evaluateGenericComparison(left: unknown, operator: string, right: unknown): boolean {
  const op = operator.trim().toLowerCase();
  const leftNum = normalizeNumber(left);
  const rightNum = normalizeNumber(right);

  if (leftNum !== null && rightNum !== null) {
    return evaluateNumberComparison(leftNum, op, rightNum);
  }

  const leftBool = normalizeBoolean(left);
  const rightBool = normalizeBoolean(right);
  if (leftBool !== null && rightBool !== null) {
    if (op === 'equals' || op === 'eq') return leftBool === rightBool;
    if (op === 'not_equals' || op === 'neq') return leftBool !== rightBool;
    return false;
  }

  const leftStr = String(left ?? '');
  const rightStr = String(right ?? '');
  if (op === 'equals' || op === 'eq') return leftStr === rightStr;
  if (op === 'not_equals' || op === 'neq') return leftStr !== rightStr;
  if (op === 'includes') return leftStr.includes(rightStr);
  if (op === 'starts_with') return leftStr.startsWith(rightStr);
  if (op === 'ends_with') return leftStr.endsWith(rightStr);
  return false;
}

function evaluateCandleFilter(candle: Candle, attribute: string, operator: string, compareValue: string): boolean {
  const normalizedAttribute = attribute.trim().toLowerCase();
  const normalizedOperator = operator.trim().toLowerCase();

  const valueByAttr: Record<string, string | number | null> = {
    datetime: candle.datetime,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };

  const left = normalizedAttribute in valueByAttr ? valueByAttr[normalizedAttribute] : null;
  if (left === null || left === undefined) return false;

  if (typeof left === 'string') {
    const right = compareValue ?? '';
    if (normalizedOperator === 'includes') return left.includes(right);
    if (normalizedOperator === 'starts_with') return left.startsWith(right);
    if (normalizedOperator === 'ends_with') return left.endsWith(right);
    if (normalizedOperator === 'equals' || normalizedOperator === 'eq') return left === right;
    if (normalizedOperator === 'not_equals' || normalizedOperator === 'neq') return left !== right;
    return false;
  }

  const rightNum = Number(compareValue);
  if (!Number.isFinite(rightNum)) return false;
  if (normalizedOperator === 'equals' || normalizedOperator === 'eq') return left === rightNum;
  if (normalizedOperator === 'not_equals' || normalizedOperator === 'neq') return left !== rightNum;
  if (normalizedOperator === 'greater_than' || normalizedOperator === 'gt') return left > rightNum;
  if (normalizedOperator === 'greater_or_equal' || normalizedOperator === 'gte') return left >= rightNum;
  if (normalizedOperator === 'less_than' || normalizedOperator === 'lt') return left < rightNum;
  if (normalizedOperator === 'less_or_equal' || normalizedOperator === 'lte') return left <= rightNum;
  return false;
}

function getPathValue(source: unknown, path: string): unknown {
  if (!path.trim()) return source ?? null;
  if (source === null || source === undefined) return null;

  const trimmed = path.trim();
  const parts = trimmed
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  let current: unknown = source;
  for (const segment of parts) {
    if (Array.isArray(current)) {
      const idx = Number(segment);
      if (!Number.isFinite(idx)) return null;
      current = current[Math.floor(idx)];
      continue;
    }
    if (isPlainObject(current)) {
      current = current[segment];
      continue;
    }
    return null;
  }
  return current;
}

function pickValueFromNodeOutput(data: unknown): unknown {
  if (!isPlainObject(data)) return data;
  if ('value' in data) return data.value;
  if ('result' in data) return data.result;
  return data;
}

function pickPreferredValueFromNodeOutput(data: unknown): unknown {
  if (!isPlainObject(data)) return data;
  if ('value' in data) return data.value;
  if ('rating' in data) return data.rating;
  if ('percentage' in data) return data.percentage;
  if ('change' in data) return data.change;
  if ('result' in data) {
    const result = data.result;
    if (typeof result !== 'boolean') return result;
    return null;
  }
  return null;
}

function hasArrivedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function findFirstArrivedValueInHistory(history: StateHistoryItem[]): unknown {
  for (const entry of history) {
    const candidate = pickPreferredValueFromNodeOutput(entry.data);
    if (hasArrivedValue(candidate)) return candidate;
  }

  for (const entry of history) {
    const candidate = pickValueFromNodeOutput(entry.data);
    if (hasArrivedValue(candidate)) return candidate;
  }

  return null;
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

type JavascriptExecutionContext = {
  attributes: Record<string, unknown>;
  input: {
    state_history: StateHistoryItem[];
  };
  history: StateHistoryItem[];
  ctx: {
    latest: () => unknown;
    get: (nodeId: string) => unknown;
  };
};

function validateJavascriptScript(script: string): void {
  if (script.trim().length === 0) throw new Error('javascript script is required');
  if (script.length > 10000) throw new Error('javascript script is too long');
  const forbidden = /\b(?:import|export|Function|eval|globalThis|window|document|fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval)\b/;
  if (forbidden.test(script)) {
    throw new Error('javascript script contains forbidden tokens');
  }
}

function executeJavascriptNodeScript(params: {
  script: string;
  attributes: Record<string, unknown>;
  history: StateHistoryItem[];
}): unknown {
  const { script, attributes, history } = params;
  validateJavascriptScript(script);

  const context = {
    attributes,
    input: {
      state_history: history,
    },
    history,
    ctx: {
      latest: () => findLatestValueInHistory(history),
      get: (nodeId: string) => findNodeDataByIdInHistory(history, String(nodeId ?? '')),
    },
  } satisfies JavascriptExecutionContext;

  try {
    const executor = new Function(
      'context',
      '"use strict";\nconst { attributes, input, history, ctx } = context;\n' + script,
    ) as (context: JavascriptExecutionContext) => unknown;
    const result = executor(context);
    return result === undefined ? null : result;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Execution error';
    throw new Error(`javascript execution error: ${detail}`);
  }
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
  strategyId: string;
}): { handled: boolean; output?: unknown } {
  const { nodeData, resolvedAttributes, history, nodeTypeLookup, executionTimeISO, strategyId } = params;
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

  if (key === 'logic.javascript' && op === 'javascript_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const script = String(attributesObj.script ?? '').trim();
    const output = executeJavascriptNodeScript({
      script,
      attributes: attributesObj,
      history,
    });

    return {
      handled: true,
      output: {
        result: output,
        value: output,
        script,
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

  if (key === 'logic.compare' && op === 'compare_generic_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const left = attributesObj.left_value ?? findLatestValueInHistory(history);
    const right = attributesObj.right_value ?? '';
    const operator = String(attributesObj.operator ?? 'equals');
    const result = evaluateGenericComparison(left, operator, right);

    return {
      handled: true,
      output: {
        result,
        left,
        right,
        operator,
      },
    };
  }

  if (key === 'logic.clamp' && op === 'clamp_number_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const value = normalizeNumber(attributesObj.value) ?? findLatestNumericInHistory(history);
    const min = normalizeNumber(attributesObj.min) ?? 0;
    const max = normalizeNumber(attributesObj.max) ?? 1;
    if (value === null) {
      throw new Error('clamp requires a valid numeric value');
    }
    if (min > max) {
      throw new Error('clamp requires min <= max');
    }
    const clamped = Math.max(min, Math.min(max, value));

    return {
      handled: true,
      output: {
        result: clamped,
        value: clamped,
        original: value,
        min,
        max,
      },
    };
  }

  if (key === 'logic.candle_change_compare' && op === 'candle_change_compare_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const sourceCandle = normalizeCandle(attributesObj.source_candle);
    const candle = sourceCandle ?? findLatestCandleInHistory(history);
    const operator = String(attributesObj.operator ?? 'greater_than');
    const threshold = normalizeNumber(attributesObj.value);

    if (!candle) {
      throw new Error('candle_change_compare requires a candle input');
    }
    if (threshold === null) {
      throw new Error('candle_change_compare requires a valid numeric value');
    }

    const change = getCandleChange(candle);
    const result = evaluateNumberComparison(change, operator, threshold);
    return {
      handled: true,
      output: {
        result,
        change,
        threshold,
        operator,
        candle,
      },
    };
  }

  if (key === 'logic.get_change_percentage' && op === 'get_change_percentage_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const sourceCandle = normalizeCandle(attributesObj.source_candle);
    const candle = sourceCandle ?? findLatestCandleInHistory(history);

    if (!candle) {
      throw new Error('get_change_percentage requires a candle input');
    }
    if (candle.open === 0) {
      throw new Error('get_change_percentage cannot divide by zero open price');
    }

    const percentage = ((candle.close - candle.open) / candle.open) * 100;
    return {
      handled: true,
      output: {
        result: percentage,
        percentage,
        open: candle.open,
        close: candle.close,
      },
    };
  }

  if (key === 'logic.first_arrived_value' && op === 'first_arrived_value_v1') {
    const selected = findFirstArrivedValueInHistory(history);
    const hasValue = hasArrivedValue(selected);
    return {
      handled: true,
      output: {
        value: selected,
        has_value: hasValue,
      },
    };
  }

  if (key === 'logic.if_else' && op === 'if_else_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const latest = findLatestValueInHistory(history);
    const inferredCondition = isPlainObject(latest) && typeof latest.result === 'boolean'
      ? latest.result
      : normalizeBoolean(latest);
    const condition = normalizeBoolean(attributesObj.condition) ?? inferredCondition ?? false;
    const trueValue = attributesObj.true_value;
    const falseValue = attributesObj.false_value;
    const selected = condition ? trueValue : falseValue;

    return {
      handled: true,
      output: {
        result: condition,
        value: selected,
        selected_branch: condition ? 'true' : 'false',
        true_value: trueValue,
        false_value: falseValue,
      },
    };
  }

  if (key === 'logic.math' && op === 'math_generic_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const left = normalizeNumber(attributesObj.left_value) ?? findLatestNumericInHistory(history);
    const right = normalizeNumber(attributesObj.right_value);
    const operator = String(attributesObj.operator ?? 'add').trim().toLowerCase();

    if (left === null) throw new Error('math requires a valid left numeric value');

    let value: number;
    if (operator === 'abs') {
      value = Math.abs(left);
    } else {
      if (right === null) throw new Error('math requires a valid right numeric value');
      if (operator === 'add') value = left + right;
      else if (operator === 'subtract') value = left - right;
      else if (operator === 'multiply') value = left * right;
      else if (operator === 'divide') {
        if (right === 0) throw new Error('math divide by zero');
        value = left / right;
      } else if (operator === 'mod') {
        if (right === 0) throw new Error('math mod by zero');
        value = left % right;
      } else if (operator === 'pow') {
        value = left ** right;
      } else if (operator === 'min') {
        value = Math.min(left, right);
      } else if (operator === 'max') {
        value = Math.max(left, right);
      } else {
        throw new Error(`Unsupported math operator: ${operator}`);
      }
    }

    return {
      handled: true,
      output: {
        result: value,
        value,
        operator,
        left,
        right,
      },
    };
  }

  if (key === 'logic.get_field' && op === 'get_field_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const sourceObject = isPlainObject(attributesObj.source_object) || Array.isArray(attributesObj.source_object)
      ? attributesObj.source_object
      : findLatestObjectInHistory(history);
    const fieldPath = String(attributesObj.field_path ?? '').trim();
    const value = getPathValue(sourceObject, fieldPath);

    return {
      handled: true,
      output: {
        result: value,
        value,
        field_path: fieldPath,
      },
    };
  }

  if (key === 'logic.select_candle' && op === 'select_candle_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const sourceCandles = normalizeCandleArray(attributesObj.source_candles);
    const candles = sourceCandles.length > 0 ? sourceCandles : findLatestCandleArrayInHistory(history);
    const attribute = String(attributesObj.candle_attribute ?? 'datetime');
    const operator = String(attributesObj.operator ?? 'includes');
    const compareValue = String(attributesObj.value ?? '');
    const selected = candles.find((candle) => evaluateCandleFilter(candle, attribute, operator, compareValue)) ?? null;

    return {
      handled: true,
      output: selected,
    };
  }

  if (key === 'logic.pick_candle' && op === 'pick_candle_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const sourceCandles = normalizeCandleArray(attributesObj.source_candles);
    const candles = sourceCandles.length > 0 ? sourceCandles : findLatestCandleArrayInHistory(history);
    const mode = String(attributesObj.mode ?? 'last').trim().toLowerCase();
    const indexRaw = Number(attributesObj.index ?? 0);
    const index = Number.isFinite(indexRaw) ? Math.max(0, Math.floor(indexRaw)) : 0;

    let selected: Candle | null = null;
    if (candles.length > 0) {
      if (mode === 'first') selected = candles[candles.length - 1] ?? null;
      else if (mode === 'index') selected = candles[index] ?? null;
      else selected = candles[0] ?? null;
    }

    return {
      handled: true,
      output: selected,
    };
  }

  if (key === 'logic.candle_color' && op === 'candle_color_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const sourceCandle = normalizeCandle(attributesObj.source_candle);
    const candle = sourceCandle ?? findLatestCandleInHistory(history);

    if (!candle) {
      return {
        handled: true,
        output: {
          result: 'none',
          is_green: false,
          is_red: false,
          candle: null,
        },
      };
    }

    const isGreen = candle.close >= candle.open;
    return {
      handled: true,
      output: {
        result: isGreen ? 'green' : 'red',
        is_green: isGreen,
        is_red: !isGreen,
        candle,
      },
    };
  }

  if (key === 'logic.check_candle_datetime' && op === 'check_candle_datetime_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const sourceCandle = normalizeCandle(attributesObj.source_candle);
    const candle = sourceCandle ?? findLatestCandleInHistory(history);

    if (!candle) throw new Error('check_candle_datetime requires a candle input');

    const datetimePart = String(attributesObj.datetime_part ?? 'full').trim().toLowerCase();
    const operator = String(attributesObj.operator ?? 'equals').trim().toLowerCase();
    const compareValue = String(attributesObj.value ?? '');

    const dt = new Date(candle.datetime);
    const isValidDate = !isNaN(dt.getTime());
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const pad2 = (n: number) => String(n).padStart(2, '0');

    let extracted: string;
    switch (datetimePart) {
      case 'date':
        extracted = isValidDate
          ? `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
          : candle.datetime.slice(0, 10);
        break;
      case 'time':
        extracted = isValidDate
          ? `${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}:${pad2(dt.getUTCSeconds())}`
          : candle.datetime.slice(11, 19);
        break;
      case 'year':
        extracted = isValidDate ? String(dt.getUTCFullYear()) : candle.datetime.slice(0, 4);
        break;
      case 'month':
        extracted = isValidDate ? pad2(dt.getUTCMonth() + 1) : candle.datetime.slice(5, 7);
        break;
      case 'day':
        extracted = isValidDate ? pad2(dt.getUTCDate()) : candle.datetime.slice(8, 10);
        break;
      case 'hour':
        extracted = isValidDate ? pad2(dt.getUTCHours()) : candle.datetime.slice(11, 13);
        break;
      case 'minute':
        extracted = isValidDate ? pad2(dt.getUTCMinutes()) : candle.datetime.slice(14, 16);
        break;
      case 'day_of_week':
        extracted = isValidDate ? dayNames[dt.getUTCDay()] : '';
        break;
      default:
        extracted = candle.datetime;
        break;
    }

    const leftNum = Number(extracted);
    const rightNum = Number(compareValue);
    const canCompareNumeric = Number.isFinite(leftNum) && Number.isFinite(rightNum);

    let result = false;
    if (operator === 'equals' || operator === 'eq') {
      result = canCompareNumeric ? leftNum === rightNum : extracted === compareValue;
    } else if (operator === 'not_equals' || operator === 'neq') {
      result = canCompareNumeric ? leftNum !== rightNum : extracted !== compareValue;
    } else if (operator === 'includes') {
      result = extracted.includes(compareValue);
    } else if (operator === 'starts_with') {
      result = extracted.startsWith(compareValue);
    } else if (operator === 'ends_with') {
      result = extracted.endsWith(compareValue);
    } else if (canCompareNumeric) {
      if (operator === 'greater_than' || operator === 'gt') result = leftNum > rightNum;
      else if (operator === 'greater_or_equal' || operator === 'gte') result = leftNum >= rightNum;
      else if (operator === 'less_than' || operator === 'lt') result = leftNum < rightNum;
      else if (operator === 'less_or_equal' || operator === 'lte') result = leftNum <= rightNum;
    } else {
      if (operator === 'greater_than' || operator === 'gt') result = extracted > compareValue;
      else if (operator === 'greater_or_equal' || operator === 'gte') result = extracted >= compareValue;
      else if (operator === 'less_than' || operator === 'lt') result = extracted < compareValue;
      else if (operator === 'less_or_equal' || operator === 'lte') result = extracted <= compareValue;
    }

    return {
      handled: true,
      output: {
        result,
        datetime: candle.datetime,
        datetime_part: datetimePart,
        extracted,
        operator,
        compare_value: compareValue,
        candle,
      },
    };
  }

  if (key === 'logic.greater_wick' && op === 'greater_wick_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const sourceCandle = normalizeCandle(attributesObj.source_candle);
    const candle = sourceCandle ?? findLatestCandleInHistory(history);

    if (!candle) throw new Error('greater_wick requires a candle input');

    const topWick = getCandleTopWickSize(candle);
    const bottomWick = getCandleBottomWickSize(candle);
    let result: 'top' | 'bottom' | 'equal';
    if (topWick > bottomWick) result = 'top';
    else if (bottomWick > topWick) result = 'bottom';
    else result = 'equal';

    return {
      handled: true,
      output: {
        result,
        top: result === 'top',
        bottom: result === 'bottom',
        top_wick: topWick,
        bottom_wick: bottomWick,
      },
    };
  }

  if (key === 'logic.has_wick' && op === 'has_wick_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const sourceCandle = normalizeCandle(attributesObj.source_candle);
    const candle = sourceCandle ?? findLatestCandleInHistory(history);
    const wickSelection = String(attributesObj.wick ?? 'both').trim().toLowerCase();
    const rawRatioPercent = normalizeNumber(attributesObj.min_wick_body_ratio_percent);
    const ratioPercent = rawRatioPercent === null
      ? 100
      : rawRatioPercent <= 1
        ? rawRatioPercent * 100
        : rawRatioPercent;
    const minRatio = Math.max(0, ratioPercent) / 100;

    if (!candle) throw new Error('has_wick requires a candle input');

    const body = getCandleBodySize(candle);
    const topWick = getCandleTopWickSize(candle);
    const bottomWick = getCandleBottomWickSize(candle);
    const bodyBaseline = Math.max(body, Number.EPSILON);

    let hasWick = false;
    if (wickSelection === 'top') hasWick = topWick >= bodyBaseline * minRatio;
    else if (wickSelection === 'bottom') hasWick = bottomWick >= bodyBaseline * minRatio;
    else hasWick = topWick >= bodyBaseline * minRatio && bottomWick >= bodyBaseline * minRatio;

    return {
      handled: true,
      output: {
        result: hasWick,
        has_wick: hasWick,
        wick: wickSelection,
        body,
        top_wick: topWick,
        bottom_wick: bottomWick,
        min_wick_body_ratio_percent: ratioPercent,
      },
    };
  }

  if (key === 'output.true' && op === 'output_true_v1') {
    return {
      handled: true,
      output: {
        result: true,
        delivery: {
          notify_owner: true,
          notify_subscribers: false,
          publish_pubsub: false,
          reason: 'preview_mode',
        },
        strategy_id: strategyId,
        owner_user_id: null,
      },
    };
  }

  if (key === 'output.false' && op === 'output_false_v1') {
    return {
      handled: true,
      output: {
        result: false,
        delivery: {
          notify_owner: false,
          notify_subscribers: false,
          publish_pubsub: false,
          reason: 'false_result',
        },
        strategy_id: strategyId,
        owner_user_id: null,
      },
    };
  }

  if (key === 'output.percentage' && op === 'output_percentage_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const value = normalizeNumber(attributesObj.percentage);
    if (value === null) throw new Error('percentage must be a valid number');
    if (value < 0 || value > 5) throw new Error('percentage must be between 0 and 5');

    return {
      handled: true,
      output: {
        result: 'rating',
        rating: value,
        delivery: {
          notify_owner: true,
          notify_subscribers: false,
          publish_pubsub: false,
          reason: 'preview_mode',
        },
        strategy_id: strategyId,
        owner_user_id: null,
      },
    };
  }

  if (key === 'output.rating' && op === 'output_rating_v1') {
    const attributesObj = fieldsToObject(resolvedAttributes);
    const value = normalizeNumber(attributesObj.rating);
    if (value === null) throw new Error('rating must be a valid number');
    if (value < 0 || value > 5) throw new Error('rating must be between 0 and 5');

    return {
      handled: true,
      output: {
        result: 'rating',
        rating: value,
        delivery: {
          notify_owner: true,
          notify_subscribers: false,
          publish_pubsub: false,
          reason: 'preview_mode',
        },
        strategy_id: strategyId,
        owner_user_id: null,
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
        strategyId,
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

export async function runCompiledPlanSingleExecution(params: {
  strategyId: string;
  plan: StrategyCompilePlan;
  nodeTypesCatalog?: StrategyNodeTypeRecord[];
  selectedExecutionTicker: string;
  selectedExecutionSymbol: SelectedExecutionSymbol;
}): Promise<{ durationMs: number; status: 'completed' | 'failed'; error: string | null }> {
  const {
    strategyId,
    plan,
    nodeTypesCatalog,
    selectedExecutionTicker,
    selectedExecutionSymbol,
  } = params;

  if (!selectedExecutionTicker.trim()) {
    return { durationMs: 0, status: 'failed', error: 'Select a strategy symbol before running benchmark.' };
  }

  const startedAt = performance.now();
  const executionTime = new Date().toISOString();
  const nodeTypeLookup = buildNodeTypeLookup(nodeTypesCatalog);
  const compiledNodeById = new Map(plan.compiled_nodes.map((node) => [node.id, node]));
  const stateHistory: StateHistoryItem[] = [];
  const stateById = new Map<string, unknown>();
  const activeNodeIds = new Set<string>(plan.entry_nodes);

  for (const nodeId of plan.topological_order) {
    if (!activeNodeIds.has(nodeId)) continue;
    const compiledNode = compiledNodeById.get(nodeId);
    if (!compiledNode) continue;

    const resolvedAttributes: EditorNodeField[] = compiledNode.attributes.map((attr, index) => {
      const resolved = attr.kind === 'ref'
        ? stateById.get(attr.ref_node_id ?? '') ?? null
        : attr.value ?? null;

      return {
        id: `${compiledNode.id}-${index}`,
        key: attr.key,
        name: attr.key,
        type: 'text',
        value: typeof resolved === 'string' ? resolved : '',
        resolved,
      } as EditorNodeField & { resolved: unknown };
    });

    const nodeData = {
      nodeTypeKey: compiledNode.node_type_key,
      nodeTypeVersion: compiledNode.node_type_version ?? undefined,
      attributes: resolvedAttributes,
    } as EditorNodeData;

    const frozenHistory = [...stateHistory].reverse();

    let output: unknown;
    try {
      const localResult = executeLocalNodeIfSupported({
        nodeData,
        resolvedAttributes,
        history: frozenHistory,
        nodeTypeLookup,
        executionTimeISO: executionTime,
        strategyId,
      });

      if (localResult.handled) {
        output = localResult.output;
      } else {
        const execution = await strategiesService.executeStrategyNode({
          strategy_id: strategyId,
          node_type_key: compiledNode.node_type_key,
          node_type_version: compiledNode.node_type_version,
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
        output = execution.output;
      }
    } catch (error) {
      return {
        durationMs: Number((performance.now() - startedAt).toFixed(3)),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Execution error',
      };
    }

    stateById.set(nodeId, output);
    stateHistory.push({ nodeId, data: output });

    const routeHandles = getRouteHandlesFromOutput(output);
    for (const edge of compiledNode.edges ?? []) {
      if (!shouldFollowCompiledEdge(edge, routeHandles, compiledNode.edges ?? [])) continue;
      activeNodeIds.add(edge.target);
    }
  }

  return {
    durationMs: Number((performance.now() - startedAt).toFixed(3)),
    status: 'completed',
    error: null,
  };
}

export type BacktestIterationHit = {
  nodeId: string;
  nodeType: string;
  kind: 'true' | 'percentage' | 'rating';
  rating: number | null;
  percentage: number | null;
};

export async function runBacktestSingleIteration(params: {
  strategyId: string;
  nodes: RFNode[];
  edges: RFEdge[];
  nodeTypesCatalog?: StrategyNodeTypeRecord[];
  selectedExecutionTicker: string;
  selectedExecutionSymbol: SelectedExecutionSymbol;
  executionTimeISO: string;
  candlesWindow: BacktestCandleInput[];
}): Promise<{ hit: BacktestIterationHit | null; error: string | null }> {
  const {
    strategyId,
    nodes,
    edges,
    nodeTypesCatalog,
    selectedExecutionTicker,
    selectedExecutionSymbol,
    executionTimeISO,
    candlesWindow,
  } = params;

  if (!selectedExecutionTicker.trim()) {
    return { hit: null, error: 'Select a strategy symbol before running backtest.' };
  }

  if (nodes.length === 0) {
    return { hit: null, error: 'Add at least one node before running backtest.' };
  }

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

  const nodeTypeLookup = buildNodeTypeLookup(nodeTypesCatalog);
  const stateHistory: StateHistoryItem[] = [];
  const stateByNodeId = new Map<string, unknown>();
  const activeNodeIds = new Set<string>(rootNodeIds);
  const backtestCandles = candlesWindow.map((item) => toBacktestCandle(item));

  for (const nodeId of orderedNodeIds) {
    if (!activeNodeIds.has(nodeId)) continue;
    const node = nodeById.get(nodeId);
    if (!node) continue;

    const nodeData = (node.data ?? {}) as EditorNodeData;
    const nodeTypeKey = nodeData.nodeTypeKey ?? 'custom-node';
    const frozenHistory = [...stateHistory].reverse();
    let output: unknown;

    try {
      if (nodeTypeKey === 'logic.candles') {
        const candleAttrs = fieldsToObject(nodeData.attributes);
        const quantity = normalizeNumber(candleAttrs.quantity) ?? 100;
        const count = Math.max(1, Math.min(backtestCandles.length, Math.floor(quantity)));
        output = backtestCandles.slice(Math.max(0, backtestCandles.length - count));
      } else {
        const resolvedAttributes = resolveAttributeReferences(nodeData.attributes, frozenHistory);
        const localResult = executeLocalNodeIfSupported({
          nodeData,
          resolvedAttributes,
          history: frozenHistory,
          nodeTypeLookup,
          executionTimeISO,
          strategyId,
        });

        if (localResult.handled) {
          output = localResult.output;
        } else {
          const execution = await strategiesService.executeStrategyNode({
            strategy_id: strategyId,
            node_type_key: nodeTypeKey,
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
            execution_time: executionTimeISO,
          });
          output = execution.output;
        }
      }
    } catch (error) {
      return {
        hit: null,
        error: error instanceof Error ? error.message : 'Execution error',
      };
    }

    stateByNodeId.set(nodeId, output);
    stateHistory.push({ nodeId, data: output });
    const routeHandles = getRouteHandlesFromOutput(output);
    const siblingEdges = outgoingByNodeId.get(nodeId) ?? [];
    for (const edge of siblingEdges) {
      if (!shouldFollowEdge(edge, routeHandles, siblingEdges)) continue;
      activeNodeIds.add(edge.target);
    }
  }

  for (let i = orderedNodeIds.length - 1; i >= 0; i -= 1) {
    const nodeId = orderedNodeIds[i];
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const nodeData = (node.data ?? {}) as EditorNodeData;
    const nodeTypeKey = nodeData.nodeTypeKey ?? 'custom-node';
    if (nodeTypeKey !== 'output.true' && nodeTypeKey !== 'output.percentage' && nodeTypeKey !== 'output.rating') continue;
    if (!stateByNodeId.has(nodeId)) continue;

    const output = stateByNodeId.get(nodeId);
    if (nodeTypeKey === 'output.true') {
      const isTrue = output === true || (isPlainObject(output) && output.result === true);
      if (!isTrue) continue;
      return {
        hit: {
          nodeId,
          nodeType: nodeTypeKey,
          kind: 'true',
          rating: null,
          percentage: null,
        },
        error: null,
      };
    }

    if (nodeTypeKey === 'output.percentage') {
      const percentage = isPlainObject(output) ? normalizeNumber(output.percentage) : null;
      if (percentage === null) continue;
      return {
        hit: {
          nodeId,
          nodeType: nodeTypeKey,
          kind: 'percentage',
          rating: null,
          percentage,
        },
        error: null,
      };
    }

    const rating = isPlainObject(output) ? normalizeNumber(output.rating) : null;
    if (rating === null) continue;
    return {
      hit: {
        nodeId,
        nodeType: nodeTypeKey,
        kind: 'rating',
        rating,
        percentage: null,
      },
      error: null,
    };
  }

  return { hit: null, error: null };
}
