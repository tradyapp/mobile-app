import { type Edge as RFEdge, type Node as RFNode } from '@xyflow/react';
import { type EditorNodeData, type EditorNodeField, normalizeNodeCategory } from '@/modules/tabs/orion/nodesEditorTypes';
import { getValueType } from '@/modules/tabs/orion/OrionValueView';
import { type LocalExecutionNodeStatus, type LocalExecutionNodeTrace, parseNodeReferenceToken, makeNodeReferenceToken } from '@/modules/tabs/orion/nodesEditorUtils';
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
  const outgoingByNodeId = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const node of nodes) {
    nodeById.set(node.id, node);
    outgoingByNodeId.set(node.id, []);
    indegree.set(node.id, 0);
  }
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoingByNodeId.set(edge.source, [...(outgoingByNodeId.get(edge.source) ?? []), edge.target]);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((indegree.get(node.id) ?? 0) === 0) queue.push(node.id);
  }
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
    for (const next of outgoingByNodeId.get(current) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  for (const node of nodes) {
    if (!orderedNodeIds.includes(node.id)) orderedNodeIds.push(node.id);
  }

  const tracesById = new Map<string, LocalExecutionNodeTrace>();
  const executionStatusByNodeId: Record<string, LocalExecutionNodeStatus> = {};
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

  for (let i = 0; i < orderedNodeIds.length; i += 1) {
    const nodeId = orderedNodeIds[i];
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
      trace.status = 'success';
      executionStatusByNodeId[nodeId] = 'success';
      trace.error = null;
      stateHistory.push({ nodeId, data: trace.outputSnapshot });
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
