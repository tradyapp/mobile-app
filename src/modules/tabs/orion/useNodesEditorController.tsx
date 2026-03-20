/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dagre from '@dagrejs/dagre';
import {
  addEdge,
  Handle,
  NodeResizer,
  Position,
  type Connection,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeProps as RFNodeProps,
  type NodeTypes,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { toast } from 'sonner';
import '@xyflow/react/dist/style.css';
import { type OrionReferenceSourceItem } from '@/modules/tabs/orion/OrionReferenceDrawer';
import { type StrategySymbolCatalogItem } from '@/modules/tabs/orion/NodeSettingsDrawer';
import { compareNodeCategory, EditorNodeData, EditorNodeField, formatNodeCategoryLabel, NodeTypeCategoryGroup, normalizeNodeCategory } from '@/modules/tabs/orion/nodesEditorTypes';
import {
  buildTimezoneOptions,
  createNodeDefaults,
  type LocalExecutionNodeStatus,
  type LocalExecutionNodeTrace,
  type LocalExecutionStatus,
  type NodeDetailsPanel,
  type NodeDetailsPanelItem,
  type NodeSymbolFilter,
} from '@/modules/tabs/orion/nodesEditorUtils';
import { loadReferenceSourcesForNode as loadReferenceSourcesForNodeAction, runLocalExecution as runLocalExecutionAction } from '@/modules/tabs/orion/nodesEditorExecutionActions';
import {
  activatePreviewVersionAction,
  deleteStrategyAction,
  editPreviewAsDraftAction,
  loadAvailableSymbolsAction,
  loadNodeTypesAction,
  loadNodeVersionsAction,
  loadStrategySymbolsAction,
  publishVersionAction,
  saveStrategySymbolsAction,
} from '@/modules/tabs/orion/nodesEditorDataActions';
import { type StrategyNodeTypeRecord } from '@/services/StrategyNodeTypesService';
import { strategiesService, type StrategyNodeMap, type StrategyNodeVersionRecord, type StrategyTrackedSymbol } from '@/services/StrategiesService';
import { useOrionExecutionStore } from '@/stores/orionExecutionStore';

type ReferenceSourceItem = OrionReferenceSourceItem;

interface UseNodesEditorControllerProps {
  strategyId: string;
  strategyName: string;
  strategyPhotoUrl?: string | null;
  isOwner: boolean;
  onDeleted?: (strategyId: string) => void;
  onClose: () => void;
}

function normalizePortHandleId(raw: string, fallback: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function getPortHandleId(port: EditorNodeField | undefined, side: 'target' | 'source', index: number, total: number): string {
  if (total <= 1) return side === 'source' ? 'right' : 'left';
  const raw = `${port?.key || port?.name || port?.type || ''}`;
  return normalizePortHandleId(raw, `${side}-${index}`);
}

function getPortHandleTop(index: number, total: number): string {
  if (total <= 1) return '50%';
  const step = 100 / (total + 1);
  return `${Math.round((index + 1) * step)}%`;
}

function getSourceHandleClass(port: EditorNodeField | undefined): string {
  const identity = `${port?.key || ''} ${port?.name || ''}`.toLowerCase();
  if (identity.includes('green')) return '!border-emerald-400 !bg-emerald-400';
  if (identity.includes('red')) return '!border-red-400 !bg-red-400';
  if (identity.includes('false')) return '!border-zinc-100 !bg-zinc-950';
  if (identity.includes('true')) return '!border-zinc-100 !bg-zinc-100';
  return '!border-zinc-100 !bg-zinc-100';
}

const AUTO_LAYOUT_NODE_WIDTH = 126;
const AUTO_LAYOUT_NODE_HEIGHT = 98;
const SECTION_NODE_DEFAULT_WIDTH = 420;
const SECTION_NODE_DEFAULT_HEIGHT = 240;
const AUTO_LAYOUT_VERTICAL_GAP = 28;
const AUTO_LAYOUT_HORIZONTAL_GAP = 20;
const AUTO_LAYOUT_COLUMN_CLUSTER_TOLERANCE = 90;
const AUTO_LAYOUT_EDGE_OVERLAP_PADDING = 10;
const AUTO_LAYOUT_EDGE_AVOIDANCE_ITERATIONS = 4;
const AUTO_LAYOUT_SIBLING_ORDER_ITERATIONS = 3;
const AUTO_LAYOUT_CROSSING_SWEEPS = 3;

type LayoutBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

type LayoutColumn = {
  centerX: number;
  nodeIds: string[];
};

function makeNodeBox(
  node: RFNode,
  sizeById: Map<string, { width: number; height: number }>,
  yOverride: number | undefined,
): LayoutBox | null {
  const dims = sizeById.get(node.id);
  if (!dims) return null;
  const top = typeof yOverride === 'number' ? yOverride : node.position.y;
  const left = node.position.x;
  return {
    left,
    right: left + dims.width,
    top,
    bottom: top + dims.height,
    centerX: left + dims.width / 2,
    centerY: top + dims.height / 2,
  };
}

function pointInBox(x: number, y: number, box: LayoutBox): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
}

function onSegment(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return bx <= Math.max(ax, cx) && bx >= Math.min(ax, cx) && by <= Math.max(ay, cy) && by >= Math.min(ay, cy);
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);

  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (o1 === 0 && onSegment(ax, ay, cx, cy, bx, by)) return true;
  if (o2 === 0 && onSegment(ax, ay, dx, dy, bx, by)) return true;
  if (o3 === 0 && onSegment(cx, cy, ax, ay, dx, dy)) return true;
  if (o4 === 0 && onSegment(cx, cy, bx, by, dx, dy)) return true;
  return false;
}

function segmentIntersectsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  box: LayoutBox,
  padding: number,
): boolean {
  const expanded: LayoutBox = {
    left: box.left - padding,
    right: box.right + padding,
    top: box.top - padding,
    bottom: box.bottom + padding,
    centerX: box.centerX,
    centerY: box.centerY,
  };
  if (pointInBox(x1, y1, expanded) || pointInBox(x2, y2, expanded)) return true;

  return (
    segmentsIntersect(x1, y1, x2, y2, expanded.left, expanded.top, expanded.right, expanded.top)
    || segmentsIntersect(x1, y1, x2, y2, expanded.right, expanded.top, expanded.right, expanded.bottom)
    || segmentsIntersect(x1, y1, x2, y2, expanded.right, expanded.bottom, expanded.left, expanded.bottom)
    || segmentsIntersect(x1, y1, x2, y2, expanded.left, expanded.bottom, expanded.left, expanded.top)
  );
}

function buildLayoutColumns(
  nodes: RFNode[],
  sizeById: Map<string, { width: number; height: number }>,
): LayoutColumn[] {
  const centerXById = new Map<string, number>();
  for (const node of nodes) {
    const dims = sizeById.get(node.id);
    if (!dims) continue;
    centerXById.set(node.id, node.position.x + dims.width / 2);
  }

  const ranked = nodes
    .filter((node) => centerXById.has(node.id))
    .sort((a, b) => (centerXById.get(a.id) ?? 0) - (centerXById.get(b.id) ?? 0));

  const columns: LayoutColumn[] = [];
  for (const node of ranked) {
    const centerX = centerXById.get(node.id) ?? 0;
    const last = columns[columns.length - 1];
    if (!last || Math.abs(centerX - last.centerX) > AUTO_LAYOUT_COLUMN_CLUSTER_TOLERANCE) {
      columns.push({ centerX, nodeIds: [node.id] });
      continue;
    }
    const count = last.nodeIds.length;
    last.centerX = (last.centerX * count + centerX) / (count + 1);
    last.nodeIds.push(node.id);
  }
  return columns;
}

function countInversions(values: number[]): number {
  if (values.length < 2) return 0;
  const work = [...values];
  const buffer = new Array<number>(work.length);

  const sortAndCount = (left: number, right: number): number => {
    if (right - left <= 1) return 0;
    const mid = Math.floor((left + right) / 2);
    let count = sortAndCount(left, mid) + sortAndCount(mid, right);

    let i = left;
    let j = mid;
    let k = left;
    while (i < mid && j < right) {
      if (work[i] <= work[j]) {
        buffer[k] = work[i];
        i += 1;
      } else {
        buffer[k] = work[j];
        j += 1;
        count += mid - i;
      }
      k += 1;
    }
    while (i < mid) {
      buffer[k] = work[i];
      i += 1;
      k += 1;
    }
    while (j < right) {
      buffer[k] = work[j];
      j += 1;
      k += 1;
    }
    for (let idx = left; idx < right; idx += 1) {
      work[idx] = buffer[idx];
    }
    return count;
  };

  return sortAndCount(0, work.length);
}

function countCrossingsBetweenColumns(
  leftIds: string[],
  rightIds: string[],
  edges: RFEdge[],
  columnIndexById: Map<string, number>,
  yById: Map<string, number>,
): number {
  if (leftIds.length < 2 || rightIds.length < 2) return 0;

  const leftOrder = [...leftIds].sort((a, b) => (yById.get(a) ?? 0) - (yById.get(b) ?? 0));
  const rightOrder = [...rightIds].sort((a, b) => (yById.get(a) ?? 0) - (yById.get(b) ?? 0));
  const leftRankById = new Map(leftOrder.map((id, index) => [id, index]));
  const rightRankById = new Map(rightOrder.map((id, index) => [id, index]));

  const pairs: Array<{ sourceRank: number; targetRank: number }> = [];
  for (const edge of edges) {
    const sourceId = edge.source;
    const targetId = edge.target;
    if (!sourceId || !targetId) continue;
    const sourceCol = columnIndexById.get(sourceId);
    const targetCol = columnIndexById.get(targetId);
    if (typeof sourceCol !== 'number' || typeof targetCol !== 'number') continue;
    if (Math.abs(sourceCol - targetCol) !== 1) continue;

    let sourceRank: number | undefined;
    let targetRank: number | undefined;
    if (sourceCol < targetCol) {
      sourceRank = leftRankById.get(sourceId);
      targetRank = rightRankById.get(targetId);
    } else {
      sourceRank = leftRankById.get(targetId);
      targetRank = rightRankById.get(sourceId);
    }
    if (typeof sourceRank !== 'number' || typeof targetRank !== 'number') continue;
    pairs.push({ sourceRank, targetRank });
  }

  if (pairs.length < 2) return 0;
  pairs.sort((a, b) => {
    if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank;
    return a.targetRank - b.targetRank;
  });
  return countInversions(pairs.map((item) => item.targetRank));
}

function resolveNodeRectCollisions(
  nodes: RFNode[],
  sizeById: Map<string, { width: number; height: number }>,
): Map<string, number> {
  const layoutable = nodes
    .filter((node) => sizeById.has(node.id))
    .sort((a, b) => {
      if (a.position.y !== b.position.y) return a.position.y - b.position.y;
      return a.position.x - b.position.x;
    });

  const resolvedYById = new Map<string, number>();
  const placed: Array<{ x: number; y: number; width: number; height: number }> = [];

  for (const node of layoutable) {
    const dims = sizeById.get(node.id) ?? { width: AUTO_LAYOUT_NODE_WIDTH, height: AUTO_LAYOUT_NODE_HEIGHT };
    const left = node.position.x;
    const right = left + dims.width;
    let top = node.position.y;

    // Keep pushing down while this node intersects any previously placed node.
    let changed = true;
    let attempts = 0;
    while (changed && attempts < layoutable.length + 4) {
      changed = false;
      attempts += 1;
      let minTop = top;
      for (const entry of placed) {
        const entryRight = entry.x + entry.width;
        const xOverlaps = left < entryRight + AUTO_LAYOUT_HORIZONTAL_GAP && right > entry.x - AUTO_LAYOUT_HORIZONTAL_GAP;
        if (!xOverlaps) continue;
        const bottom = top + dims.height;
        const entryBottom = entry.y + entry.height;
        const yOverlaps = top < entryBottom + AUTO_LAYOUT_VERTICAL_GAP && bottom > entry.y - AUTO_LAYOUT_VERTICAL_GAP;
        if (!yOverlaps) continue;
        minTop = Math.max(minTop, entryBottom + AUTO_LAYOUT_VERTICAL_GAP);
      }
      if (minTop !== top) {
        top = minTop;
        changed = true;
      }
    }

    resolvedYById.set(node.id, Math.round(top));
    placed.push({ x: left, y: top, width: dims.width, height: dims.height });
  }

  return resolvedYById;
}

function compactYByColumns(
  nodes: RFNode[],
  sizeById: Map<string, { width: number; height: number }>,
): Map<string, number> {
  const columns = buildLayoutColumns(nodes, sizeById);

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const resolvedYById = new Map<string, number>();

  for (const column of columns) {
    const items = column.nodeIds
      .map((id) => {
        const node = nodeById.get(id);
        const dims = sizeById.get(id);
        if (!node || !dims) return null;
        return {
          id,
          targetY: node.position.y,
          height: dims.height,
        };
      })
      .filter((item): item is { id: string; targetY: number; height: number } => item !== null)
      .sort((a, b) => {
        if (a.targetY !== b.targetY) return a.targetY - b.targetY;
        return a.id.localeCompare(b.id);
      });

    if (items.length === 0) continue;
    const ys = items.map((item) => item.targetY);

    // Forward pass: enforce minimum spacing top-to-bottom.
    for (let i = 1; i < items.length; i += 1) {
      const prevBottom = ys[i - 1] + items[i - 1].height;
      ys[i] = Math.max(ys[i], prevBottom + AUTO_LAYOUT_VERTICAL_GAP);
    }

    // Backward pass: pull upward to reduce excessive whitespace while preserving spacing.
    for (let i = items.length - 2; i >= 0; i -= 1) {
      const nextTop = ys[i + 1];
      const maxTop = nextTop - items[i].height - AUTO_LAYOUT_VERTICAL_GAP;
      ys[i] = Math.min(ys[i], maxTop);
    }

    for (let i = 0; i < items.length; i += 1) {
      resolvedYById.set(items[i].id, Math.round(ys[i]));
    }
  }

  return resolvedYById;
}

function minimizeEdgeCrossingsByColumns(
  nodes: RFNode[],
  edges: RFEdge[],
  sizeById: Map<string, { width: number; height: number }>,
): Map<string, number> {
  const columns = buildLayoutColumns(nodes, sizeById);
  if (columns.length < 2) return new Map(nodes.map((node) => [node.id, node.position.y]));

  const columnIndexById = new Map<string, number>();
  for (let i = 0; i < columns.length; i += 1) {
    for (const id of columns[i].nodeIds) columnIndexById.set(id, i);
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const yById = new Map(nodes.map((node) => [node.id, node.position.y]));

  const compactColumn = (column: LayoutColumn) => {
    const ordered = [...column.nodeIds].sort((a, b) => (yById.get(a) ?? 0) - (yById.get(b) ?? 0));
    const items = ordered
      .map((id) => {
        const node = nodeById.get(id);
        const dims = sizeById.get(id);
        if (!node || !dims) return null;
        return { id, desiredY: yById.get(id) ?? node.position.y, height: dims.height };
      })
      .filter((item): item is { id: string; desiredY: number; height: number } => item !== null);
    if (items.length < 2) return;

    const ys = items.map((item) => item.desiredY);
    for (let i = 1; i < items.length; i += 1) {
      const prevBottom = ys[i - 1] + items[i - 1].height;
      ys[i] = Math.max(ys[i], prevBottom + AUTO_LAYOUT_VERTICAL_GAP);
    }
    for (let i = items.length - 2; i >= 0; i -= 1) {
      const nextTop = ys[i + 1];
      const maxTop = nextTop - items[i].height - AUTO_LAYOUT_VERTICAL_GAP;
      ys[i] = Math.min(ys[i], maxTop);
    }
    for (let i = 0; i < items.length; i += 1) yById.set(items[i].id, Math.round(ys[i]));
    column.nodeIds = items.map((item) => item.id);
  };

  const scoreAroundColumn = (index: number): number => {
    let score = 0;
    if (index > 0) {
      score += countCrossingsBetweenColumns(columns[index - 1].nodeIds, columns[index].nodeIds, edges, columnIndexById, yById);
    }
    if (index + 1 < columns.length) {
      score += countCrossingsBetweenColumns(columns[index].nodeIds, columns[index + 1].nodeIds, edges, columnIndexById, yById);
    }
    return score;
  };

  for (let sweep = 0; sweep < AUTO_LAYOUT_CROSSING_SWEEPS; sweep += 1) {
    const leftToRight = sweep % 2 === 0;
    const start = leftToRight ? 1 : columns.length - 2;
    const end = leftToRight ? columns.length : -1;
    const step = leftToRight ? 1 : -1;

    for (let colIndex = start; colIndex !== end; colIndex += step) {
      const neighborIndex = leftToRight ? colIndex - 1 : colIndex + 1;
      if (neighborIndex < 0 || neighborIndex >= columns.length) continue;
      const neighbor = columns[neighborIndex];
      const column = columns[colIndex];

      const neighborOrder = [...neighbor.nodeIds].sort((a, b) => (yById.get(a) ?? 0) - (yById.get(b) ?? 0));
      const neighborRankById = new Map(neighborOrder.map((id, index) => [id, index]));

      const scored = column.nodeIds.map((id) => {
        const ranks: number[] = [];
        for (const edge of edges) {
          if (edge.source === id && edge.target && neighborRankById.has(edge.target)) {
            ranks.push(neighborRankById.get(edge.target) as number);
          } else if (edge.target === id && edge.source && neighborRankById.has(edge.source)) {
            ranks.push(neighborRankById.get(edge.source) as number);
          }
        }
        ranks.sort((a, b) => a - b);
        const barycenter = ranks.length === 0
          ? Number.POSITIVE_INFINITY
          : ranks.reduce((sum, value) => sum + value, 0) / ranks.length;
        return { id, barycenter, currentY: yById.get(id) ?? 0 };
      });

      scored.sort((a, b) => {
        if (a.barycenter !== b.barycenter) return a.barycenter - b.barycenter;
        if (a.currentY !== b.currentY) return a.currentY - b.currentY;
        return a.id.localeCompare(b.id);
      });

      column.nodeIds = scored.map((item) => item.id);
      compactColumn(column);

      // Adjacent swaps for local minima on crossing count.
      for (let i = 0; i < column.nodeIds.length - 1; i += 1) {
        const beforeScore = scoreAroundColumn(colIndex);
        const a = column.nodeIds[i];
        const b = column.nodeIds[i + 1];
        column.nodeIds[i] = b;
        column.nodeIds[i + 1] = a;
        compactColumn(column);
        const afterScore = scoreAroundColumn(colIndex);
        if (afterScore > beforeScore) {
          column.nodeIds[i] = a;
          column.nodeIds[i + 1] = b;
          compactColumn(column);
        }
      }
    }
  }

  return yById;
}

function optimizeEdgeNodeOverlaps(
  nodes: RFNode[],
  edges: RFEdge[],
  sizeById: Map<string, { width: number; height: number }>,
): Map<string, number> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const yById = new Map(nodes.map((node) => [node.id, node.position.y]));
  const layoutableIds = nodes.filter((node) => sizeById.has(node.id)).map((node) => node.id);

  const getBoxById = (id: string): LayoutBox | null => {
    const node = nodeById.get(id);
    if (!node) return null;
    return makeNodeBox(node, sizeById, yById.get(id));
  };

  const countEdgePassesThroughNode = (targetNodeId: string): number => {
    const targetBox = getBoxById(targetNodeId);
    if (!targetBox) return 0;
    let count = 0;
    for (const edge of edges) {
      const sourceId = edge.source;
      const targetId = edge.target;
      if (!sourceId || !targetId) continue;
      if (sourceId === targetNodeId || targetId === targetNodeId) continue;
      const sourceBox = getBoxById(sourceId);
      const targetEdgeBox = getBoxById(targetId);
      if (!sourceBox || !targetEdgeBox) continue;
      if (segmentIntersectsBox(
        sourceBox.centerX,
        sourceBox.centerY,
        targetEdgeBox.centerX,
        targetEdgeBox.centerY,
        targetBox,
        AUTO_LAYOUT_EDGE_OVERLAP_PADDING,
      )) {
        count += 1;
      }
    }
    return count;
  };

  const countNodeOverlapPenalty = (targetNodeId: string): number => {
    const targetBox = getBoxById(targetNodeId);
    if (!targetBox) return 0;
    let overlaps = 0;
    for (const otherId of layoutableIds) {
      if (otherId === targetNodeId) continue;
      const otherBox = getBoxById(otherId);
      if (!otherBox) continue;
      const xOverlaps = targetBox.left < otherBox.right + AUTO_LAYOUT_HORIZONTAL_GAP && targetBox.right > otherBox.left - AUTO_LAYOUT_HORIZONTAL_GAP;
      if (!xOverlaps) continue;
      const yOverlaps = targetBox.top < otherBox.bottom + AUTO_LAYOUT_VERTICAL_GAP && targetBox.bottom > otherBox.top - AUTO_LAYOUT_VERTICAL_GAP;
      if (!yOverlaps) continue;
      overlaps += 1;
    }
    return overlaps;
  };

  for (let iteration = 0; iteration < AUTO_LAYOUT_EDGE_AVOIDANCE_ITERATIONS; iteration += 1) {
    let movedInIteration = false;
    const ordered = [...layoutableIds].sort((a, b) => (yById.get(a) ?? 0) - (yById.get(b) ?? 0));
    for (const nodeId of ordered) {
      const node = nodeById.get(nodeId);
      const dims = sizeById.get(nodeId);
      if (!node || !dims) continue;
      const currentY = yById.get(nodeId) ?? node.position.y;
      const currentEdgePenalty = countEdgePassesThroughNode(nodeId);
      if (currentEdgePenalty === 0) continue;

      const step = Math.max(Math.round(dims.height * 0.6), AUTO_LAYOUT_VERTICAL_GAP + 12);
      const candidateYs = [
        currentY - step,
        currentY + step,
        currentY - step * 2,
        currentY + step * 2,
      ];

      let bestY = currentY;
      let bestScore = currentEdgePenalty * 10 + countNodeOverlapPenalty(nodeId) * 3;

      for (const candidateY of candidateYs) {
        yById.set(nodeId, candidateY);
        const candidateEdgePenalty = countEdgePassesThroughNode(nodeId);
        const candidateOverlapPenalty = countNodeOverlapPenalty(nodeId);
        const score = candidateEdgePenalty * 10 + candidateOverlapPenalty * 3;
        if (score < bestScore) {
          bestScore = score;
          bestY = candidateY;
        }
      }

      yById.set(nodeId, bestY);
      if (bestY !== currentY) movedInIteration = true;
    }
    if (!movedInIteration) break;
  }

  return yById;
}

function enforceSiblingOutputOrder(
  nodes: RFNode[],
  edges: RFEdge[],
  sizeById: Map<string, { width: number; height: number }>,
  parentOutputOrderByNode: Map<string, Map<string, number>>,
  incomingCountByTarget: Map<string, number>,
): Map<string, number> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const yById = new Map(nodes.map((node) => [node.id, node.position.y]));

  for (let iteration = 0; iteration < AUTO_LAYOUT_SIBLING_ORDER_ITERATIONS; iteration += 1) {
    let moved = false;
    for (const parent of nodes) {
      if (!sizeById.has(parent.id)) continue;

      const entries = new Map<string, { targetId: string; order: number }>();
      for (const edge of edges) {
        if (edge.source !== parent.id || !edge.target) continue;
        if (!sizeById.has(edge.target) || edge.target === parent.id) continue;
        const child = nodeById.get(edge.target);
        if (!child) continue;
        // Maintain order only for forward edges in LR.
        if (child.position.x <= parent.position.x) continue;
        const handleOrder = parentOutputOrderByNode.get(parent.id);
        const order = handleOrder?.get(edge.sourceHandle || 'right') ?? 0;
        const existing = entries.get(edge.target);
        if (!existing || order < existing.order) {
          entries.set(edge.target, { targetId: edge.target, order });
        }
      }

      const children = [...entries.values()]
        .map((entry) => {
          const node = nodeById.get(entry.targetId);
          const dims = sizeById.get(entry.targetId);
          if (!node || !dims) return null;
          return {
            targetId: entry.targetId,
            order: entry.order,
            height: dims.height,
            incoming: incomingCountByTarget.get(entry.targetId) ?? 1,
          };
        })
        .filter((item): item is { targetId: string; order: number; height: number; incoming: number } => item !== null)
        .sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          const ay = yById.get(a.targetId) ?? 0;
          const by = yById.get(b.targetId) ?? 0;
          if (ay !== by) return ay - by;
          return a.targetId.localeCompare(b.targetId);
        });

      if (children.length < 2) continue;

      // Forward pass: enforce strict top-to-bottom order with gap.
      for (let i = 1; i < children.length; i += 1) {
        const prev = children[i - 1];
        const current = children[i];
        const prevY = yById.get(prev.targetId) ?? 0;
        const currentY = yById.get(current.targetId) ?? 0;
        const minY = prevY + prev.height + AUTO_LAYOUT_VERTICAL_GAP;
        if (currentY < minY) {
          const blend = current.incoming > 1 ? 0.45 : 1;
          const nextY = Math.round(currentY * (1 - blend) + minY * blend);
          if (nextY !== currentY) {
            yById.set(current.targetId, nextY);
            moved = true;
          }
        }
      }

      // Backward pass: compact without breaking order.
      for (let i = children.length - 2; i >= 0; i -= 1) {
        const current = children[i];
        const next = children[i + 1];
        const currentY = yById.get(current.targetId) ?? 0;
        const nextY = yById.get(next.targetId) ?? 0;
        const maxY = nextY - current.height - AUTO_LAYOUT_VERTICAL_GAP;
        if (currentY > maxY) {
          const blend = current.incoming > 1 ? 0.45 : 1;
          const nextYValue = Math.round(currentY * (1 - blend) + maxY * blend);
          if (nextYValue !== currentY) {
            yById.set(current.targetId, nextYValue);
            moved = true;
          }
        }
      }
    }
    if (!moved) break;
  }

  return yById;
}

function useNodesEditorController({ strategyId, strategyName, strategyPhotoUrl = null, isOwner, onDeleted, onClose }: UseNodesEditorControllerProps) {
  const areSameIds = (prev: string[], next: string[]) => {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i += 1) {
      if (prev[i] !== next[i]) return false;
    }
    return true;
  };

  const safeHorizontalInsetStyle = {
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
  } as const;

  const safeCanvasInsetStyle = {
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
  } as const;
  const executionStatusByNodeIdRef = useRef<Record<string, LocalExecutionNodeStatus>>({});

  const nodeTypes = useMemo<NodeTypes>(() => ({
    editorNode: ({ id, data }: RFNodeProps<RFNode<EditorNodeData>>) => {
      const category = normalizeNodeCategory(data?.category);
      const isTrigger = category === 'trigger';
      const isOutput = category === 'output';
      const isSection = category === 'section';
      const inputPorts = Array.isArray(data?.inputs) ? data.inputs : [];
      const outputPorts = Array.isArray(data?.outputs) ? data.outputs : [];
      const leftPorts = isTrigger || isSection ? [] : (inputPorts.length > 0 ? inputPorts : [{ id: 'left', name: 'Input' } as EditorNodeField]);
      const rightPorts = isOutput || isSection ? [] : (outputPorts.length > 0 ? outputPorts : [{ id: 'right', name: 'Output' } as EditorNodeField]);
      const executionStatus = executionStatusByNodeIdRef.current[id];
      const sectionTitle = isSection
        ? (
          (data?.attributes ?? []).find((field) => field.key === 'title')?.value?.trim()
          || data?.label
          || 'Section'
        )
        : null;

      if (isSection) {
        return (
          <div className="h-full w-full rounded-2xl border border-dashed border-zinc-600/90 bg-zinc-900/25 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(63,63,70,0.15)]">
            <NodeResizer
              minWidth={220}
              minHeight={140}
              handleClassName="!h-3 !w-3 !rounded-full !border !border-zinc-500 !bg-zinc-800"
              lineClassName="!border-zinc-600/60"
              color="#52525b"
            />
            <p className="pointer-events-none select-none truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
              {sectionTitle}
            </p>
          </div>
        );
      }

      const executionClassName = executionStatus === 'running'
        ? 'border-blue-400 bg-blue-950/35 shadow-[0_0_0_2px_rgba(59,130,246,0.35)]'
        : executionStatus === 'success'
          ? 'border-emerald-400 bg-emerald-950/30 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]'
          : executionStatus === 'error'
            ? 'border-red-400 bg-red-950/30 shadow-[0_0_0_2px_rgba(239,68,68,0.35)]'
            : 'border-zinc-700 bg-zinc-950';

      return (
        <div
          className={`relative flex min-h-[98px] min-w-[126px] flex-col items-center justify-center gap-2 border px-3 py-3 text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${executionClassName} ${isTrigger ? 'rounded-[24px] rounded-l-[34px]' : isOutput ? 'rounded-[24px] rounded-r-[34px]' : 'rounded-[24px]'}`}
        >
          {leftPorts.map((port, index) => (
            <Handle
              key={`${id}-left-${getPortHandleId(port, 'target', index, leftPorts.length)}`}
              id={getPortHandleId(port, 'target', index, leftPorts.length)}
              type="target"
              position={Position.Left}
              className="!h-4 !w-4 !border !border-zinc-100 !bg-zinc-100"
              style={{ left: -8, top: getPortHandleTop(index, leftPorts.length), transform: 'translateY(-50%)' }}
            />
          ))}
          <div className="h-8 w-8 overflow-hidden rounded-lg border border-zinc-600 bg-zinc-800">
            {data?.iconUrl ? (
              <img src={data.iconUrl} alt={data.label ?? 'Node icon'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-300">
                {(data?.label ?? 'N').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 text-center">
            <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-zinc-100">{data?.label ?? 'Node'}</p>
            {data?.category && (
              <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.08em] text-zinc-500">{data.category}</p>
            )}
          </div>
          {rightPorts.map((port, index) => (
            <Handle
              key={`${id}-right-${getPortHandleId(port, 'source', index, rightPorts.length)}`}
              id={getPortHandleId(port, 'source', index, rightPorts.length)}
              type="source"
              position={Position.Right}
              className={`!h-4 !w-4 !border ${getSourceHandleClass(port)}`}
              style={{ right: -8, top: getPortHandleTop(index, rightPorts.length), transform: 'translateY(-50%)' }}
            />
          ))}
        </div>
      );
    },
  }), []);

  const nodeCounterRef = useRef(1);
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const [availableNodeTypes, setAvailableNodeTypes] = useState<StrategyNodeTypeRecord[]>([]);
  const [isNodeTypesLoading, setIsNodeTypesLoading] = useState(false);
  const [nodeTypesError, setNodeTypesError] = useState<string | null>(null);
  const [isNodeTypesDrawerOpen, setIsNodeTypesDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [nodeEditorNodeId, setNodeEditorNodeId] = useState<string | null>(null);
  const [nodeDetailsPanel, setNodeDetailsPanel] = useState<NodeDetailsPanel>('inputs');
  const [isNodeMapLoading, setIsNodeMapLoading] = useState(true);
  const [nodeMapError, setNodeMapError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nodeVersions, setNodeVersions] = useState<StrategyNodeVersionRecord[]>([]);
  const [isNodeVersionsLoading, setIsNodeVersionsLoading] = useState(false);
  const [nodeVersionsError, setNodeVersionsError] = useState<string | null>(null);
  const [isPublishingVersion, setIsPublishingVersion] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<'menu' | 'versions' | 'symbols' | 'symbols-library' | 'danger'>('menu');
  const [isVersionNameDialogOpen, setIsVersionNameDialogOpen] = useState(false);
  const [isDeleteSelectionDialogOpen, setIsDeleteSelectionDialogOpen] = useState(false);
  const [isDeleteStrategyDialogOpen, setIsDeleteStrategyDialogOpen] = useState(false);
  const [deleteStrategyConfirmInput, setDeleteStrategyConfirmInput] = useState('');
  const [isDeletingStrategy, setIsDeletingStrategy] = useState(false);
  const [deleteStrategyError, setDeleteStrategyError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [trackedSymbols, setTrackedSymbols] = useState<StrategyTrackedSymbol[]>([]);
  const [hasLoadedTrackedSymbols, setHasLoadedTrackedSymbols] = useState(false);
  const [availableSymbols, setAvailableSymbols] = useState<StrategySymbolCatalogItem[]>([]);
  const [isSymbolsLoading, setIsSymbolsLoading] = useState(false);
  const [isSymbolsSaving, setIsSymbolsSaving] = useState(false);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const [versionNameInput, setVersionNameInput] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [previewVersion, setPreviewVersion] = useState<StrategyNodeVersionRecord | null>(null);
  const [localExecutionStatus, setLocalExecutionStatus] = useState<LocalExecutionStatus>('idle');
  const [localExecutionTraces, setLocalExecutionTraces] = useState<LocalExecutionNodeTrace[]>([]);
  const [localExecutionError, setLocalExecutionError] = useState<string | null>(null);
  const [isExecutionSymbolDrawerOpen, setIsExecutionSymbolDrawerOpen] = useState(false);
  const [executionSymbolSearch, setExecutionSymbolSearch] = useState('');
  const [executionSymbolFilter, setExecutionSymbolFilter] = useState<NodeSymbolFilter>('ALL');
  const [isReferenceDrawerOpen, setIsReferenceDrawerOpen] = useState(false);
  const [referenceFieldIndex, setReferenceFieldIndex] = useState<number | null>(null);
  const [referenceSearch, setReferenceSearch] = useState('');
  const [isReferenceSourcesLoading, setIsReferenceSourcesLoading] = useState(false);
  const [referenceSourcesError, setReferenceSourcesError] = useState<string | null>(null);
  const [referenceSourcesByNodeId, setReferenceSourcesByNodeId] = useState<Record<string, ReferenceSourceItem[]>>({});
  const [isUpstreamExecutingForNode, setIsUpstreamExecutingForNode] = useState(false);
  const hasHydratedNodeMapRef = useRef(false);
  const lastSavedNodeMapRef = useRef('');
  const [lastSavedNodeMapSnapshot, setLastSavedNodeMapSnapshot] = useState('');
  const saveRequestIdRef = useRef(0);
  const draftBeforePreviewRef = useRef<StrategyNodeMap | null>(null);
  const lastNodeTapRef = useRef<{ id: string; at: number } | null>(null);
  const executionRunIdRef = useRef(0);
  const lastToastedRunIdRef = useRef(0);

  const isPlainObject = useCallback((value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  ), []);

  const getExecutionToastMessage = useCallback((value: unknown): string => {
    if (isPlainObject(value)) {
      const rating = value.rating;
      if (typeof rating === 'number') return `Rating: ${rating}`;
      if (typeof rating === 'string' && rating.trim().length > 0) return `Rating: ${rating}`;

      const percentage = value.percentage;
      if (typeof percentage === 'number') return `Percentage: ${percentage}`;
      if (typeof percentage === 'string' && percentage.trim().length > 0) return `Percentage: ${percentage}`;

      const result = value.result;
      if (typeof result === 'boolean') return `Result: ${result ? 'True' : 'False'}`;
      if (typeof result === 'number') return `Result: ${result}`;
      if (typeof result === 'string' && result.trim().length > 0) return `Result: ${result}`;
    }

    if (typeof value === 'boolean') return `Result: ${value ? 'True' : 'False'}`;
    if (typeof value === 'number') return `Result: ${value}`;
    if (typeof value === 'string' && value.trim().length > 0) return `Result: ${value}`;

    if (value === null || value === undefined) return 'Result: no value';
    try {
      return `Result: ${JSON.stringify(value)}`;
    } catch {
      return 'Result: value available';
    }
  }, [isPlainObject]);

  const nodeTypeGroups = useMemo<NodeTypeCategoryGroup[]>(() => {
    const grouped = new Map<string, StrategyNodeTypeRecord[]>();

    for (const item of availableNodeTypes) {
      const categoryKey = normalizeNodeCategory(item.category);
      const existing = grouped.get(categoryKey) ?? [];
      existing.push(item);
      grouped.set(categoryKey, existing);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => compareNodeCategory(a, b))
      .map(([key, items]) => ({
        key,
        label: formatNodeCategoryLabel(key),
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [availableNodeTypes]);

  const activeNodeVersion = useMemo(
    () => nodeVersions.find((version) => version.is_active) ?? null,
    [nodeVersions]
  );
  const strategyInitials = useMemo(
    () =>
      strategyName
        .split(' ')
        .map((word) => word[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [strategyName]
  );
  const selectedExecutionTicker = useOrionExecutionStore((state) => state.selectedSymbolByStrategyId[strategyId] ?? '');
  const setSymbolForStrategy = useOrionExecutionStore((state) => state.setSymbolForStrategy);
  const clearSymbolForStrategy = useOrionExecutionStore((state) => state.clearSymbolForStrategy);
  const selectedExecutionSymbol = useMemo(
    () => trackedSymbols.find((item) => item.ticker.toUpperCase() === selectedExecutionTicker.toUpperCase()) ?? null,
    [trackedSymbols, selectedExecutionTicker]
  );
  const filteredExecutionSymbols = useMemo(() => {
    const query = executionSymbolSearch.trim().toLowerCase();
    return trackedSymbols.filter((item) => {
      if (executionSymbolFilter !== 'ALL' && item.market !== executionSymbolFilter) return false;
      if (!query) return true;
      return item.ticker.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    });
  }, [executionSymbolFilter, executionSymbolSearch, trackedSymbols]);
  const isPreviewMode = previewVersion !== null;
  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;
  const selectedNodeForEditor = useMemo(
    () => (nodeEditorNodeId ? nodes.find((node) => node.id === nodeEditorNodeId) ?? null : null),
    [nodeEditorNodeId, nodes]
  );

  const getCurrentNodeMap = useCallback((): StrategyNodeMap => ({
    version: 1,
    nodes: nodes as unknown[],
    edges: edges as unknown[],
  }), [nodes, edges]);

  const applyNodeMapToCanvas = useCallback((nodeMap: StrategyNodeMap) => {
    const nextNodes = (nodeMap.nodes ?? []) as RFNode[];
    const nextEdges = (nodeMap.edges ?? []) as RFEdge[];

    setNodes(nextNodes);
    setEdges(nextEdges);

    const maxNodeIndex = nextNodes.reduce((max, node) => {
      const match = /^node-(\d+)$/.exec(node.id);
      if (!match) return max;
      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    nodeCounterRef.current = maxNodeIndex + 1;
  }, [setEdges, setNodes]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((prev) => addEdge(connection, prev));
  }, [setEdges]);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: RFNode[]; edges: RFEdge[] }) => {
      const nextNodeIds = selectedNodes.map((node) => node.id);
      const nextEdgeIds = selectedEdges.map((edge) => edge.id);

      setSelectedNodeIds((prev) => (areSameIds(prev, nextNodeIds) ? prev : nextNodeIds));
      setSelectedEdgeIds((prev) => (areSameIds(prev, nextEdgeIds) ? prev : nextEdgeIds));
    },
    []
  );

  const loadNodeTypes = useCallback(async () => {
    setIsNodeTypesLoading(true);
    setNodeTypesError(null);
    try {
      const items = await loadNodeTypesAction();
      setAvailableNodeTypes(items);
    } catch (error) {
      setNodeTypesError(error instanceof Error ? error.message : 'Failed to load node types');
    } finally {
      setIsNodeTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNodeTypes();
  }, [loadNodeTypes]);

  const loadStrategySymbols = useCallback(async () => {
    setSymbolsError(null);
    try {
      const hydrated = await loadStrategySymbolsAction(strategyId);
      setTrackedSymbols(hydrated as StrategyTrackedSymbol[]);
    } catch (error) {
      setSymbolsError(error instanceof Error ? error.message : 'Failed to load strategy symbols');
      setTrackedSymbols([]);
    } finally {
      setHasLoadedTrackedSymbols(true);
    }
  }, [strategyId]);

  const loadAvailableSymbols = useCallback(async () => {
    setIsSymbolsLoading(true);
    setSymbolsError(null);
    try {
      const mapped = await loadAvailableSymbolsAction();
      setAvailableSymbols(mapped);
    } catch (error) {
      setSymbolsError(error instanceof Error ? error.message : 'Failed to load symbols catalog');
    } finally {
      setIsSymbolsLoading(false);
    }
  }, []);

  useEffect(() => {
    setHasLoadedTrackedSymbols(false);
    setTrackedSymbols([]);
    void loadStrategySymbols();
  }, [loadStrategySymbols]);

  useEffect(() => {
    if (!hasLoadedTrackedSymbols) return;
    if (trackedSymbols.length === 0) {
      clearSymbolForStrategy(strategyId);
      return;
    }

    const hasPersisted = trackedSymbols.some((item) => item.ticker.toUpperCase() === selectedExecutionTicker.toUpperCase());
    if (!hasPersisted) {
      setSymbolForStrategy(strategyId, trackedSymbols[0]?.ticker ?? '');
    }
  }, [clearSymbolForStrategy, hasLoadedTrackedSymbols, selectedExecutionTicker, setSymbolForStrategy, strategyId, trackedSymbols]);

  useEffect(() => {
    let active = true;

    const loadNodeMap = async () => {
      setIsNodeMapLoading(true);
      setNodeMapError(null);
      setSaveError(null);
      setSaveStatus('idle');
      setPreviewVersion(null);
      draftBeforePreviewRef.current = null;

      try {
        const payload = await strategiesService.getStrategyNodeMap(strategyId);
        if (!active) return;

        const normalized = payload ?? { version: 1, nodes: [], edges: [] };
        applyNodeMapToCanvas(normalized);

        const serialized = JSON.stringify({
          version: normalized.version,
          nodes: normalized.nodes,
          edges: normalized.edges,
        } satisfies StrategyNodeMap);
        lastSavedNodeMapRef.current = serialized;
        setLastSavedNodeMapSnapshot(serialized);
        hasHydratedNodeMapRef.current = true;
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
      } catch (error) {
        if (!active) return;
        setNodeMapError(error instanceof Error ? error.message : 'Failed to load strategy node map');
        hasHydratedNodeMapRef.current = true;
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
      } finally {
        if (active) setIsNodeMapLoading(false);
      }
    };

    void loadNodeMap();

    return () => {
      active = false;
    };
  }, [strategyId, applyNodeMapToCanvas]);

  useEffect(() => {
    if (!nodeEditorNodeId) return;
    const exists = nodes.some((node) => node.id === nodeEditorNodeId);
    if (!exists) {
      setNodeEditorNodeId(null);
    }
  }, [nodeEditorNodeId, nodes]);

  useEffect(() => {
    if (!selectedNodeForEditor) {
      setIsReferenceDrawerOpen(false);
      setReferenceFieldIndex(null);
      setReferenceSearch('');
      setReferenceSourcesError(null);
    }
  }, [selectedNodeForEditor]);

  useEffect(() => {
    const validIds = new Set(nodes.map((node) => node.id));
    const next: Record<string, LocalExecutionNodeStatus> = {};
    for (const [nodeId, status] of Object.entries(executionStatusByNodeIdRef.current)) {
      if (validIds.has(nodeId)) next[nodeId] = status;
    }
    executionStatusByNodeIdRef.current = next;
  }, [nodes]);

  useEffect(() => {
    if (availableNodeTypes.length === 0) return;

    const byKey = new Map<string, StrategyNodeTypeRecord>();
    for (const nodeType of availableNodeTypes) {
      byKey.set(nodeType.key, nodeType);
    }

    setNodes((prev) => {
      let changed = false;
      const next = prev.map((node) => {
        const data = (node.data ?? {}) as EditorNodeData;
        if (!data.nodeTypeKey) return node;

        const nodeType = byKey.get(data.nodeTypeKey);
        if (!nodeType) return node;

        const defaults = createNodeDefaults(nodeType);
        const currentInputs = Array.isArray(data.inputs) ? data.inputs : [];
        const currentAttributes = Array.isArray(data.attributes) ? data.attributes : [];
        const currentOutputs = Array.isArray(data.outputs) ? data.outputs : [];

        const shouldHydrateInputs = currentInputs.length === 0 && defaults.inputs.length > 0;
        const shouldHydrateAttributes = currentAttributes.length === 0 && defaults.attributes.length > 0;
        const shouldHydrateOutputs = currentOutputs.length === 0 && defaults.outputs.length > 0;

        if (!shouldHydrateInputs && !shouldHydrateAttributes && !shouldHydrateOutputs) {
          return node;
        }

        changed = true;
        return {
          ...node,
          data: {
            ...data,
            ...(shouldHydrateInputs ? { inputs: defaults.inputs } : {}),
            ...(shouldHydrateAttributes ? { attributes: defaults.attributes } : {}),
            ...(shouldHydrateOutputs ? { outputs: defaults.outputs } : {}),
          } satisfies EditorNodeData,
        };
      });

      return changed ? next : prev;
    });
  }, [availableNodeTypes, setNodes]);

  useEffect(() => {
    if (!hasHydratedNodeMapRef.current) return;
    if (isPreviewMode) return;

    const payload = getCurrentNodeMap();
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedNodeMapRef.current) return;

    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setSaveStatus('saving');
    setSaveError(null);

    const timeoutId = window.setTimeout(() => {
      void strategiesService.saveStrategyNodeMap(strategyId, payload)
        .then(() => {
          if (saveRequestIdRef.current !== requestId) return;
          lastSavedNodeMapRef.current = serialized;
          setLastSavedNodeMapSnapshot(serialized);
          setSaveStatus('saved');
        })
        .catch((error) => {
          if (saveRequestIdRef.current !== requestId) return;
          setSaveStatus('error');
          setSaveError(error instanceof Error ? error.message : 'Failed to save node map');
        });
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [strategyId, nodes, edges, isPreviewMode, getCurrentNodeMap]);

  const handleAddNodeFromType = useCallback((nodeType: StrategyNodeTypeRecord) => {
    setNodes((prev) => {
      const index = prev.length;
      const nextLabel = nodeCounterRef.current;
      nodeCounterRef.current += 1;

      const nextNode: RFNode = {
        id: `node-${nextLabel}`,
        type: 'editorNode',
        position: {
          x: 80 + (index % 4) * 180,
          y: 80 + Math.floor(index / 4) * 120,
        },
        data: {
          label: nodeType.name,
          nodeTypeKey: nodeType.key,
          nodeTypeVersion: nodeType.version,
          category: nodeType.category,
          iconUrl: nodeType.icon_url,
          ...createNodeDefaults(nodeType),
        } satisfies EditorNodeData,
      };

      return [...prev, nextNode];
    });
    setIsNodeTypesDrawerOpen(false);
  }, [setNodes]);

  const handleAddSection = useCallback(() => {
    setNodes((prev) => {
      const nextLabel = nodeCounterRef.current;
      nodeCounterRef.current += 1;

      const nextNode: RFNode = {
        id: `node-${nextLabel}`,
        type: 'editorNode',
        position: {
          x: 120 + (prev.length % 3) * 80,
          y: 120 + Math.floor(prev.length / 3) * 60,
        },
        style: {
          width: SECTION_NODE_DEFAULT_WIDTH,
          height: SECTION_NODE_DEFAULT_HEIGHT,
        },
        zIndex: -1,
        data: {
          label: 'Section',
          category: 'section',
          inputs: [],
          outputs: [],
          attributes: [
            {
              id: 'section-title',
              key: 'title',
              name: 'Title',
              type: 'text',
              value: 'Section',
            },
          ],
        } satisfies EditorNodeData,
      };

      return [...prev, nextNode];
    });
  }, [setNodes]);

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;

    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: 'LR',
      acyclicer: 'greedy',
      ranker: 'network-simplex',
      ranksep: 110,
      nodesep: 60,
      marginx: 30,
      marginy: 30,
    });

    const layoutableNodes = nodes.filter((node) => {
      const data = (node.data ?? {}) as EditorNodeData;
      return normalizeNodeCategory(data.category) !== 'section';
    });
    if (layoutableNodes.length === 0) return;

    const sizeById = new Map<string, { width: number; height: number }>();
    for (const node of layoutableNodes) {
      const measured = node.measured;
      const width = typeof node.width === 'number'
        ? node.width
        : (typeof measured?.width === 'number' ? measured.width : AUTO_LAYOUT_NODE_WIDTH);
      const height = typeof node.height === 'number'
        ? node.height
        : (typeof measured?.height === 'number' ? measured.height : AUTO_LAYOUT_NODE_HEIGHT);
      sizeById.set(node.id, { width, height });
      graph.setNode(node.id, { width, height });
    }

    for (const edge of edges) {
      if (!edge.source || !edge.target) continue;
      if (!sizeById.has(edge.source) || !sizeById.has(edge.target)) continue;
      graph.setEdge(edge.source, edge.target);
    }

    dagre.layout(graph);

    const nextNodes = nodes.map((node, index) => {
      if (!sizeById.has(node.id)) return node;
      const dims = sizeById.get(node.id) ?? { width: AUTO_LAYOUT_NODE_WIDTH, height: AUTO_LAYOUT_NODE_HEIGHT };
      const positioned = graph.node(node.id) as { x?: number; y?: number } | undefined;
      if (!positioned || typeof positioned.x !== 'number' || typeof positioned.y !== 'number') {
        return {
          ...node,
          position: {
            x: 80 + (index % 4) * 220,
            y: 80 + Math.floor(index / 4) * 150,
          },
        };
      }

      return {
        ...node,
        position: {
          x: Math.round(positioned.x - dims.width / 2),
          y: Math.round(positioned.y - dims.height / 2),
        },
      };
    });

    const parentOutputOrderByNode = new Map<string, Map<string, number>>();
    for (const node of nextNodes) {
      const data = (node.data ?? {}) as EditorNodeData;
      const outputs = Array.isArray(data.outputs) ? data.outputs : [];
      if (outputs.length === 0) continue;
      const handleOrder = new Map<string, number>();
      for (let i = 0; i < outputs.length; i += 1) {
        const handleId = getPortHandleId(outputs[i], 'source', i, outputs.length);
        handleOrder.set(handleId, i);
      }
      parentOutputOrderByNode.set(node.id, handleOrder);
    }

    const incomingCountByTarget = new Map<string, number>();
    for (const edge of edges) {
      if (!sizeById.has(edge.target)) continue;
      incomingCountByTarget.set(edge.target, (incomingCountByTarget.get(edge.target) ?? 0) + 1);
    }

    const nodeById = new Map(nextNodes.map((node) => [node.id, node]));
    const branchGroups = new Map<string, Array<{ targetId: string; order: number }>>();
    for (const edge of edges) {
      if (!sizeById.has(edge.source) || !sizeById.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      const parent = nodeById.get(edge.source);
      const child = nodeById.get(edge.target);
      if (!parent || !child) continue;

      // Only enforce on forward links for LR layout.
      if (child.position.x <= parent.position.x) continue;

      const handleOrder = parentOutputOrderByNode.get(edge.source);
      const order = handleOrder?.get(edge.sourceHandle || 'right') ?? 0;
      const current = branchGroups.get(edge.source) ?? [];
      // Keep one entry per target (if duplicated edges exist, keep the lower order index).
      const existingIndex = current.findIndex((item) => item.targetId === edge.target);
      if (existingIndex >= 0) {
        current[existingIndex] = {
          ...current[existingIndex],
          order: Math.min(current[existingIndex].order, order),
        };
      } else {
        current.push({ targetId: edge.target, order });
      }
      branchGroups.set(edge.source, current);
    }

    const targetYContributions = new Map<string, { sum: number; count: number }>();
    const branchGap = 150;
    for (const [parentId, branches] of branchGroups.entries()) {
      if (branches.length < 2) continue;
      const parent = nodeById.get(parentId);
      if (!parent) continue;
      const sorted = [...branches].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.targetId.localeCompare(b.targetId);
      });

      const startY = parent.position.y - ((sorted.length - 1) * branchGap) / 2;
      for (let i = 0; i < sorted.length; i += 1) {
        const targetId = sorted[i].targetId;
        const desiredY = startY + i * branchGap;
        const prev = targetYContributions.get(targetId) ?? { sum: 0, count: 0 };
        targetYContributions.set(targetId, { sum: prev.sum + desiredY, count: prev.count + 1 });
      }
    }

    const adjustedNodes = nextNodes.map((node) => {
      const contribution = targetYContributions.get(node.id);
      if (!contribution || contribution.count === 0) return node;
      const avgDesiredY = contribution.sum / contribution.count;
      const incomingCount = incomingCountByTarget.get(node.id) ?? 1;
      // Multi-parent nodes should move less aggressively to avoid destabilizing layout.
      const blend = incomingCount > 1 ? 0.45 : 0.75;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: Math.round(node.position.y * (1 - blend) + avgDesiredY * blend),
        },
      };
    });

    const compactedYById = compactYByColumns(adjustedNodes, sizeById);
    const compactedNodes = adjustedNodes.map((node) => {
      const compactedY = compactedYById.get(node.id);
      if (typeof compactedY !== 'number' || compactedY === node.position.y) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: compactedY,
        },
      };
    });

    const crossingMinimizedYById = minimizeEdgeCrossingsByColumns(compactedNodes, edges, sizeById);
    const crossingMinimizedNodes = compactedNodes.map((node) => {
      const minimizedY = crossingMinimizedYById.get(node.id);
      if (typeof minimizedY !== 'number' || minimizedY === node.position.y) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: Math.round(minimizedY),
        },
      };
    });

    const postCrossingCompactedYById = compactYByColumns(crossingMinimizedNodes, sizeById);
    const postCrossingCompactedNodes = crossingMinimizedNodes.map((node) => {
      const compactedY = postCrossingCompactedYById.get(node.id);
      if (typeof compactedY !== 'number' || compactedY === node.position.y) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: compactedY,
        },
      };
    });

    const overlapOptimizedYById = optimizeEdgeNodeOverlaps(postCrossingCompactedNodes, edges, sizeById);
    const overlapOptimizedNodes = postCrossingCompactedNodes.map((node) => {
      const optimizedY = overlapOptimizedYById.get(node.id);
      if (typeof optimizedY !== 'number' || optimizedY === node.position.y) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: Math.round(optimizedY),
        },
      };
    });

    const siblingOrderedYById = enforceSiblingOutputOrder(
      overlapOptimizedNodes,
      edges,
      sizeById,
      parentOutputOrderByNode,
      incomingCountByTarget,
    );
    const siblingOrderedNodes = overlapOptimizedNodes.map((node) => {
      const orderedY = siblingOrderedYById.get(node.id);
      if (typeof orderedY !== 'number' || orderedY === node.position.y) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: orderedY,
        },
      };
    });

    const firstResolvedYById = resolveNodeRectCollisions(siblingOrderedNodes, sizeById);
    const firstCollisionResolvedNodes = siblingOrderedNodes.map((node) => {
      const resolvedY = firstResolvedYById.get(node.id);
      if (typeof resolvedY !== 'number' || resolvedY === node.position.y) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: resolvedY,
        },
      };
    });

    const finalOrderedYById = enforceSiblingOutputOrder(
      firstCollisionResolvedNodes,
      edges,
      sizeById,
      parentOutputOrderByNode,
      incomingCountByTarget,
    );
    const finalOrderedNodes = firstCollisionResolvedNodes.map((node) => {
      const orderedY = finalOrderedYById.get(node.id);
      if (typeof orderedY !== 'number' || orderedY === node.position.y) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: orderedY,
        },
      };
    });

    const resolvedYById = resolveNodeRectCollisions(finalOrderedNodes, sizeById);
    const finalNodes = finalOrderedNodes.map((node) => {
      const resolvedY = resolvedYById.get(node.id);
      if (typeof resolvedY !== 'number') return node;
      if (resolvedY === node.position.y) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: resolvedY,
        },
      };
    });

    setNodes(finalNodes);
    toast.success('Nodes organized');
  }, [edges, nodes, setNodes]);

  const handleNodeTypesDrawerOpenChange = useCallback((open: boolean) => {
    setIsNodeTypesDrawerOpen(open);
  }, []);

  const openNodeEditor = useCallback((nodeId: string) => {
    setNodeEditorNodeId(nodeId);
    setNodeDetailsPanel('attributes');
  }, []);

  const handleNodeClick = useCallback((_event: unknown, node: RFNode) => {
    const now = Date.now();
    const prev = lastNodeTapRef.current;
    if (prev && prev.id === node.id && now - prev.at < 300) {
      openNodeEditor(node.id);
      lastNodeTapRef.current = null;
      return;
    }
    lastNodeTapRef.current = { id: node.id, at: now };
  }, [openNodeEditor]);

  const updateNodePanelFields = useCallback((nodeId: string, panel: NodeDetailsPanel, updater: (prev: EditorNodeField[]) => EditorNodeField[]) => {
    setNodes((prev) => prev.map((node) => {
      if (node.id !== nodeId) return node;
      const data = (node.data ?? {}) as EditorNodeData;
      const current = Array.isArray(data[panel]) ? (data[panel] as EditorNodeField[]) : [];
      return {
        ...node,
        data: {
          ...data,
          [panel]: updater(current),
        } satisfies EditorNodeData,
      };
    }));
  }, [setNodes]);

  const loadReferenceSourcesForNode = useCallback(async (targetNodeId: string): Promise<ReferenceSourceItem[]> => {
    return loadReferenceSourcesForNodeAction({
      targetNodeId,
      strategyId,
      nodes,
      edges,
      selectedExecutionTicker,
      selectedExecutionSymbol: selectedExecutionSymbol
        ? {
          ticker: selectedExecutionSymbol.ticker,
          name: selectedExecutionSymbol.name,
          market: selectedExecutionSymbol.market,
        }
        : null,
    }) as Promise<ReferenceSourceItem[]>;
  }, [edges, nodes, selectedExecutionSymbol, selectedExecutionTicker, strategyId]);

  const runUpstreamExecutionForEditor = useCallback(async () => {
    if (!selectedNodeForEditor) return;
    setIsUpstreamExecutingForNode(true);
    setIsReferenceSourcesLoading(true);
    setReferenceSourcesError(null);
    try {
      const items = await loadReferenceSourcesForNode(selectedNodeForEditor.id);
      setReferenceSourcesByNodeId((prev) => ({ ...prev, [selectedNodeForEditor.id]: items }));
      if (items.length === 0) {
        setReferenceSourcesError('No previous node outputs available for this node.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run upstream nodes';
      setReferenceSourcesError(message);
    } finally {
      setIsUpstreamExecutingForNode(false);
      setIsReferenceSourcesLoading(false);
    }
  }, [loadReferenceSourcesForNode, selectedNodeForEditor]);

  const openReferenceDrawer = useCallback((fieldIndex: number) => {
    if (!selectedNodeForEditor) return;
    setReferenceFieldIndex(fieldIndex);
    setReferenceSearch('');
    setReferenceSourcesError(null);
    setIsReferenceDrawerOpen(true);
  }, [selectedNodeForEditor]);

  const runLocalExecution = useCallback(async () => {
    await runLocalExecutionAction({
      strategyId,
      nodes,
      edges,
      nodeTypesCatalog: availableNodeTypes,
      localExecutionStatus,
      selectedExecutionTicker,
      selectedExecutionSymbol: selectedExecutionSymbol
        ? {
          ticker: selectedExecutionSymbol.ticker,
          name: selectedExecutionSymbol.name,
          market: selectedExecutionSymbol.market,
        }
        : null,
      onStatusChange: (status) => {
        if (status === 'running') {
          executionRunIdRef.current += 1;
        }
        setLocalExecutionStatus(status);
      },
      onErrorChange: setLocalExecutionError,
      onTracesChange: setLocalExecutionTraces,
      onExecutionStatusByNodeChange: (byNode) => {
        executionStatusByNodeIdRef.current = byNode;
      },
    });
  }, [availableNodeTypes, edges, localExecutionStatus, nodes, selectedExecutionSymbol, selectedExecutionTicker, strategyId]);

  useEffect(() => {
    if (localExecutionStatus !== 'completed') return;
    if (executionRunIdRef.current === 0) return;
    if (lastToastedRunIdRef.current === executionRunIdRef.current) return;

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const outputTrace = [...localExecutionTraces].reverse().find((trace) => {
      if (trace.status !== 'success') return false;
      const node = nodeById.get(trace.nodeId);
      const category = normalizeNodeCategory((node?.data as EditorNodeData | undefined)?.category);
      return category === 'output';
    });

    if (!outputTrace) {
      lastToastedRunIdRef.current = executionRunIdRef.current;
      return;
    }

    const sourceNode = nodeById.get(outputTrace.nodeId);
    const sourceData = (sourceNode?.data ?? {}) as EditorNodeData;
    const nodeLabel = sourceData.label ?? outputTrace.label ?? 'Output';
    const nodeIconUrl = sourceData.iconUrl ?? null;
    const message = getExecutionToastMessage(outputTrace.outputSnapshot);
    toast.custom((toastId) => (
      <div className="w-[min(92vw,460px)] rounded-2xl border border-zinc-700/80 bg-zinc-900/95 px-3 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800">
            {nodeIconUrl ? (
              <img
                src={nodeIconUrl}
                alt={nodeLabel}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-zinc-300">
                {nodeLabel.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-zinc-100">{nodeLabel}</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] font-medium text-emerald-300">{message}</p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-300"
            aria-label="Close execution toast"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    ), { duration: 3800 });
    lastToastedRunIdRef.current = executionRunIdRef.current;
  }, [getExecutionToastMessage, localExecutionStatus, localExecutionTraces, nodes]);

  const handleDeleteSelection = useCallback(() => {
    if (!hasSelection) return;

    const nodeIdSet = new Set(selectedNodeIds);
    const edgeIdSet = new Set(selectedEdgeIds);

    setNodes((prev) => prev.filter((node) => !nodeIdSet.has(node.id)));
    setEdges((prev) =>
      prev.filter((edge) =>
        !edgeIdSet.has(edge.id) &&
        !nodeIdSet.has(edge.source) &&
        !nodeIdSet.has(edge.target)
      )
    );

    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setIsDeleteSelectionDialogOpen(false);
  }, [hasSelection, selectedNodeIds, selectedEdgeIds, setEdges, setNodes]);

  const handleSettingsDrawerOpenChange = useCallback((open: boolean) => {
    setIsSettingsDrawerOpen(open);
    if (!open) {
      setSettingsPanel('menu');
      setIsVersionNameDialogOpen(false);
    }
  }, []);

  const handleConfirmDeleteStrategy = useCallback(async () => {
    if (!isOwner || isDeletingStrategy) return;
    if (deleteStrategyConfirmInput.trim() !== strategyName) {
      setDeleteStrategyError('Type the exact strategy name to confirm.');
      return;
    }

    setIsDeletingStrategy(true);
    setDeleteStrategyError(null);
    try {
      await deleteStrategyAction(strategyId);
      onDeleted?.(strategyId);
      setIsDeleteStrategyDialogOpen(false);
      onClose();
    } catch (error) {
      setDeleteStrategyError(error instanceof Error ? error.message : 'Failed to delete strategy');
    } finally {
      setIsDeletingStrategy(false);
    }
  }, [deleteStrategyConfirmInput, isDeletingStrategy, isOwner, onClose, onDeleted, strategyId, strategyName]);

  const handleToggleSymbol = useCallback(async (symbol: StrategySymbolCatalogItem | StrategyTrackedSymbol) => {
    if (!isOwner || isSymbolsSaving) return;

    const ticker = symbol.ticker.toUpperCase();
    const nextCandidate: StrategyTrackedSymbol = {
      ticker,
      name: symbol.name || ticker,
      icon_url: symbol.icon_url ?? null,
      market: symbol.market === 'FOREX' || symbol.market === 'CRYPTO' ? symbol.market : 'STOCKS',
    };

    const previous = trackedSymbols;
    const exists = previous.some((item) => item.ticker.toUpperCase() === ticker);
    const next = exists
      ? previous.filter((item) => item.ticker.toUpperCase() !== ticker)
      : [...previous, nextCandidate];

    setTrackedSymbols(next);
    setIsSymbolsSaving(true);
    setSymbolsError(null);

    try {
      await saveStrategySymbolsAction(strategyId, next);
    } catch (error) {
      setTrackedSymbols(previous);
      setSymbolsError(error instanceof Error ? error.message : 'Failed to save strategy symbols');
    } finally {
      setIsSymbolsSaving(false);
    }
  }, [isOwner, isSymbolsSaving, strategyId, trackedSymbols]);

  const getNextVersionDefaultName = useCallback(() => {
    const maxVersion = nodeVersions.reduce((max, item) => Math.max(max, item.version_number), 0);
    return `v${maxVersion + 1}`;
  }, [nodeVersions]);

  const loadNodeVersions = useCallback(async () => {
    setIsNodeVersionsLoading(true);
    setNodeVersionsError(null);
    try {
      const rows = await loadNodeVersionsAction(strategyId);
      setNodeVersions(rows);
    } catch (error) {
      setNodeVersionsError(error instanceof Error ? error.message : 'Failed to load versions');
    } finally {
      setIsNodeVersionsLoading(false);
    }
  }, [strategyId]);

  useEffect(() => {
    if (!isSettingsDrawerOpen) return;
    void loadNodeVersions();
  }, [isSettingsDrawerOpen, loadNodeVersions]);

  const handlePublishVersion = useCallback(async (versionName?: string) => {
    if (isPublishingVersion || isPreviewMode) return;
    setIsPublishingVersion(true);
    setNodeVersionsError(null);

    try {
      const draftPayload = getCurrentNodeMap();
      const created = await publishVersionAction({ strategyId, draftPayload, versionName });
      const serialized = JSON.stringify(draftPayload);
      lastSavedNodeMapRef.current = serialized;
      setLastSavedNodeMapSnapshot(serialized);
      setNodeVersions((prev) => {
        const next = prev.map((item) => ({ ...item, is_active: false }));
        const withoutSame = next.filter((item) => item.id !== created.id);
        return [created, ...withoutSame].sort((a, b) => b.version_number - a.version_number);
      });
      setSaveStatus('saved');
    } catch (error) {
      setNodeVersionsError(error instanceof Error ? error.message : 'Failed to publish version');
    } finally {
      setIsPublishingVersion(false);
    }
  }, [isPublishingVersion, isPreviewMode, getCurrentNodeMap, strategyId]);

  const handleEnterPreviewVersion = useCallback((version: StrategyNodeVersionRecord) => {
    if (!version.node_map) return;
    if (!isPreviewMode) {
      draftBeforePreviewRef.current = getCurrentNodeMap();
    }
    applyNodeMapToCanvas(version.node_map);
    setPreviewVersion(version);
    setSaveStatus('idle');
    setSaveError(null);
    setIsSettingsDrawerOpen(false);
    setSettingsPanel('menu');
  }, [isPreviewMode, getCurrentNodeMap, applyNodeMapToCanvas]);

  const handleEditPreviewAsDraft = useCallback(async () => {
    if (!previewVersion?.node_map) return;

    const draftPayload = previewVersion.node_map;
    applyNodeMapToCanvas(draftPayload);
    setPreviewVersion(null);
    draftBeforePreviewRef.current = null;
    setSaveStatus('saving');
    setSaveError(null);

    try {
      await editPreviewAsDraftAction(strategyId, draftPayload);
      const serialized = JSON.stringify(draftPayload);
      lastSavedNodeMapRef.current = serialized;
      setLastSavedNodeMapSnapshot(serialized);
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save node map');
    }
  }, [previewVersion, applyNodeMapToCanvas, strategyId]);

  const handleActivatePreviewVersion = useCallback(async () => {
    if (!previewVersion || previewVersion.is_active || isPublishingVersion) return;

    setIsPublishingVersion(true);
    setNodeVersionsError(null);
    try {
      await activatePreviewVersionAction(strategyId, previewVersion.id);
      setNodeVersions((prev) =>
        prev.map((item) => ({ ...item, is_active: item.id === previewVersion.id }))
      );
      setPreviewVersion((prev) => (prev ? { ...prev, is_active: true } : prev));
      setSaveStatus('saved');
    } catch (error) {
      setNodeVersionsError(error instanceof Error ? error.message : 'Failed to activate version');
    } finally {
      setIsPublishingVersion(false);
    }
  }, [previewVersion, isPublishingVersion, strategyId]);

  const nodeEditorData = selectedNodeForEditor?.data as EditorNodeData | undefined;
  const timezoneOptions = useMemo(() => buildTimezoneOptions(), []);
  const selectedNodeExecutionTrace = selectedNodeForEditor
    ? localExecutionTraces.find((item) => item.nodeId === selectedNodeForEditor.id) ?? null
    : null;
  const nodeDetailsPanelItems = useMemo<NodeDetailsPanelItem[]>(() => {
    const category = normalizeNodeCategory(nodeEditorData?.category);
    const baseItems: NodeDetailsPanelItem[] = [];

    if (category === 'section') {
      baseItems.push(
        { key: 'attributes', label: 'Attributes' },
      );
    } else if (category === 'trigger') {
      baseItems.push(
        { key: 'attributes', label: 'Attributes' },
        { key: 'outputs', label: 'Result' },
      );
    } else if (category === 'output') {
      baseItems.push(
        { key: 'inputs', label: 'Inputs' },
        { key: 'attributes', label: 'Attributes' },
        { key: 'outputs', label: 'Result' },
      );
    } else {
      baseItems.push(
        { key: 'inputs', label: 'Inputs' },
        { key: 'attributes', label: 'Attributes' },
        { key: 'outputs', label: 'Result' },
      );
    }

    return baseItems;
  }, [nodeEditorData?.category]);

  useEffect(() => {
    if (nodeDetailsPanelItems.some((item) => item.key === nodeDetailsPanel)) return;
    setNodeDetailsPanel(nodeDetailsPanelItems[0]?.key ?? 'inputs');
  }, [nodeDetailsPanel, nodeDetailsPanelItems]);

  const panelFields = nodeEditorData
    ? (Array.isArray(nodeEditorData[nodeDetailsPanel]) ? nodeEditorData[nodeDetailsPanel] as EditorNodeField[] : [])
    : [];
  const activeReferenceField = useMemo(
    () => (referenceFieldIndex === null ? null : panelFields[referenceFieldIndex] ?? null),
    [panelFields, referenceFieldIndex]
  );
  const currentNodeReferenceSources = useMemo(
    () => (selectedNodeForEditor ? (referenceSourcesByNodeId[selectedNodeForEditor.id] ?? []) : []),
    [referenceSourcesByNodeId, selectedNodeForEditor]
  );
  const filteredReferenceSources = useMemo(() => {
    const query = referenceSearch.trim().toLowerCase();
    if (!query) return currentNodeReferenceSources;
    return currentNodeReferenceSources.filter((item) => (
      item.nodeId.toLowerCase().includes(query) ||
      item.label.toLowerCase().includes(query) ||
      item.nodeTypeKey.toLowerCase().includes(query) ||
      item.dataType.toLowerCase().includes(query)
    ));
  }, [currentNodeReferenceSources, referenceSearch]);

  const setSelectedNodeAttributeValue = useCallback((index: number, value: string) => {
    if (!selectedNodeForEditor) return;
    updateNodePanelFields(selectedNodeForEditor.id, 'attributes', (prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value };
      return next;
    });
  }, [selectedNodeForEditor, updateNodePanelFields]);

  const toggleSelectedNodeAttributeOption = useCallback((index: number, optionValue: string) => {
    if (!selectedNodeForEditor) return;
    updateNodePanelFields(selectedNodeForEditor.id, 'attributes', (prev) => {
      const next = [...prev];
      const currentValues = (next[index]?.value || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      const nextValues = currentValues.includes(optionValue)
        ? currentValues.filter((item) => item !== optionValue)
        : [...currentValues, optionValue];
      next[index] = { ...next[index], value: nextValues.join(',') };
      return next;
    });
  }, [selectedNodeForEditor, updateNodePanelFields]);

  const openAttributeReferenceDrawer = useCallback((index: number) => {
    void openReferenceDrawer(index);
  }, [openReferenceDrawer]);

  const clearSelectedNodeAttributeReference = useCallback((index: number) => {
    if (!selectedNodeForEditor) return;
    updateNodePanelFields(selectedNodeForEditor.id, 'attributes', (prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value: '' };
      return next;
    });
  }, [selectedNodeForEditor, updateNodePanelFields]);

  return {
        strategyName,
        strategyPhotoUrl,
        strategyInitials,
        subtitle: isNodeMapLoading
          ? 'Loading map...'
          : isPreviewMode
            ? `Preview · v${previewVersion.version_number} ${previewVersion.name}`
            : saveStatus === 'saving'
              ? `Draft · Saving...${activeNodeVersion ? ` · Active v${activeNodeVersion.version_number}` : ''}`
              : saveStatus === 'saved'
                ? `Draft · Saved${activeNodeVersion ? ` · Active v${activeNodeVersion.version_number}` : ''}`
                : saveStatus === 'error'
                  ? 'Draft · Save error'
                  : `Draft${activeNodeVersion ? ` · Active v${activeNodeVersion.version_number}` : ''}`,
        executionStatusText: localExecutionStatus === 'idle'
          ? null
          : localExecutionStatus === 'running'
            ? 'Execution · Running'
            : localExecutionStatus === 'completed'
              ? 'Execution · Completed'
              : `Execution · Failed${localExecutionError ? ` · ${localExecutionError}` : ''}`,
        executionStatusTone: localExecutionStatus === 'idle'
          ? null
          : localExecutionStatus === 'running'
            ? 'running'
            : localExecutionStatus === 'completed'
            ? 'completed'
            : 'failed',
        safeHorizontalInsetStyle,
        safeCanvasInsetStyle,
        onClose,
        onOpenSettings: () => {
          setSettingsPanel('menu');
          setIsSettingsDrawerOpen(true);
        },
        onAutoLayout: handleAutoLayout,
        nodeMapError,
        saveError,
        selectedNodeForEditor,
        nodeEditorData,
        isPreviewMode,
        isUpstreamExecutingForNode,
        onBackFromNodeEditor: () => setNodeEditorNodeId(null),
        onRunUpstream: () => { void runUpstreamExecutionForEditor(); },
        nodeDetailsPanel,
        nodeDetailsPanelItems,
        onNodeDetailsPanelChange: setNodeDetailsPanel,
        panelFields,
        timezoneOptions,
        onSetAttributeFieldValue: setSelectedNodeAttributeValue,
        onToggleAttributeMultiOption: toggleSelectedNodeAttributeOption,
        onOpenReference: openAttributeReferenceDrawer,
        onClearReference: clearSelectedNodeAttributeReference,
        selectedNodeExecutionTrace,
        nodes,
        edges,
        nodeTypes,
        hasSelection,
        selectedExecutionSymbol,
        trackedSymbolsCount: trackedSymbols.length,
        onNodesChange: isPreviewMode ? undefined : onNodesChange,
        onEdgesChange: isPreviewMode ? undefined : onEdgesChange,
        onConnect: isPreviewMode ? undefined : onConnect,
        onNodeClick: isPreviewMode ? undefined : handleNodeClick,
        onNodeDoubleClick: isPreviewMode ? undefined : (_event: unknown, node: RFNode) => openNodeEditor(node.id),
        onSelectionChange: isPreviewMode ? undefined : handleSelectionChange,
        onOpenExecutionSymbolDrawer: () => setIsExecutionSymbolDrawerOpen(true),
        onDeleteSelectionRequest: () => setIsDeleteSelectionDialogOpen(true),
        onEditPreviewAsDraft: () => { void handleEditPreviewAsDraft(); },
        onRunLocalExecution: () => { void runLocalExecution(); },
        isLocalExecutionRunning: localExecutionStatus === 'running',
        selectedExecutionTicker,
        onAddSection: handleAddSection,
        onOpenNodeTypesDrawer: () => setIsNodeTypesDrawerOpen(true),
        isExecutionSymbolDrawerOpen,
        onExecutionSymbolDrawerOpenChange: (open: boolean) => {
          setIsExecutionSymbolDrawerOpen(open);
          if (!open) {
            setExecutionSymbolSearch('');
            setExecutionSymbolFilter('ALL');
          }
        },
        executionSymbolSearch,
        onExecutionSymbolSearchChange: setExecutionSymbolSearch,
        executionSymbolFilter,
        onExecutionSymbolFilterChange: (value: NodeSymbolFilter) => setExecutionSymbolFilter(value as NodeSymbolFilter),
        trackedSymbols,
        filteredExecutionSymbols,
        onSelectExecutionSymbol: (ticker: string) => {
          setSymbolForStrategy(strategyId, ticker);
          setIsExecutionSymbolDrawerOpen(false);
        },
        isReferenceDrawerOpen,
        onReferenceDrawerOpenChange: (open: boolean) => {
          setIsReferenceDrawerOpen(open);
          if (!open) {
            setReferenceSearch('');
            setReferenceSourcesError(null);
          }
        },
        activeReferenceFieldName: activeReferenceField?.name || activeReferenceField?.key || 'Attribute',
        referenceSearch,
        onReferenceSearchChange: setReferenceSearch,
        isReferenceSourcesLoading,
        referenceSourcesError,
        currentNodeReferenceSourcesCount: currentNodeReferenceSources.length,
        onRunUpstreamNow: () => { void runUpstreamExecutionForEditor(); },
        filteredReferenceSources,
        onPickReference: (token: string) => {
          if (!selectedNodeForEditor || referenceFieldIndex === null) return;
          updateNodePanelFields(selectedNodeForEditor.id, nodeDetailsPanel, (prev) => {
            const next = [...prev];
            next[referenceFieldIndex] = { ...next[referenceFieldIndex], value: token };
            return next;
          });
          setIsReferenceDrawerOpen(false);
        },
        isNodeTypesDrawerOpen,
        onNodeTypesDrawerOpenChange: handleNodeTypesDrawerOpenChange,
        isNodeTypesLoading,
        nodeTypesError,
        availableNodeTypes,
        nodeTypeGroups,
        onRetryLoadNodeTypes: () => { void loadNodeTypes(); },
        onAddNodeFromType: handleAddNodeFromType,
        isSettingsDrawerOpen,
        onSettingsDrawerOpenChange: handleSettingsDrawerOpenChange,
        settingsPanel,
        onSettingsPanelChange: setSettingsPanel,
        isPublishingVersion,
        previewVersion,
        onActivateButtonClick: async () => {
          if (isPreviewMode) {
            await handleActivatePreviewVersion();
            return;
          }
          if (!isNodeVersionsLoading && nodeVersions.length === 0) {
            await loadNodeVersions();
          }
          setVersionNameInput(getNextVersionDefaultName());
          setIsVersionNameDialogOpen(true);
        },
        onOpenVersions: () => {
          setSettingsPanel('versions');
          void loadNodeVersions();
        },
        isNodeVersionsLoading,
        nodeVersions,
        onEnterPreviewVersion: handleEnterPreviewVersion,
        nodeVersionsError,
        isLive,
        onToggleLive: () => setIsLive((prev) => !prev),
        onOpenBacktesting: () => {
          setIsSettingsDrawerOpen(false);
          void runLocalExecution();
        },
        isOwner,
        availableSymbols,
        isSymbolsLoading,
        isSymbolsSaving,
        symbolsError,
        onOpenSymbols: () => {
          setSettingsPanel('symbols');
        },
        onOpenSymbolsLibrary: () => {
          setSettingsPanel('symbols-library');
          if (availableSymbols.length === 0) {
            void loadAvailableSymbols();
          }
        },
        onRetryLoadSymbols: () => { void loadAvailableSymbols(); },
        onToggleSymbol: (symbol: StrategySymbolCatalogItem | StrategyTrackedSymbol) => {
          void handleToggleSymbol(symbol);
        },
        isDeletingStrategy,
        onDeleteStrategyRequest: () => {
          setDeleteStrategyConfirmInput('');
          setDeleteStrategyError(null);
          setIsDeleteStrategyDialogOpen(true);
        },
        isVersionNameDialogOpen,
        versionNameInput,
        onVersionNameInputChange: setVersionNameInput,
        onCloseVersionNameDialog: () => setIsVersionNameDialogOpen(false),
        onConfirmVersionNameDialog: async () => {
          const fallback = getNextVersionDefaultName();
          const chosen = versionNameInput.trim() || fallback;
          await handlePublishVersion(chosen);
          setIsVersionNameDialogOpen(false);
        },
        isDeleteSelectionDialogOpen,
        onCloseDeleteSelectionDialog: () => setIsDeleteSelectionDialogOpen(false),
        onConfirmDeleteSelection: handleDeleteSelection,
        isDeleteStrategyDialogOpen,
        deleteStrategyConfirmInput,
        deleteStrategyError,
        onDeleteStrategyConfirmInputChange: setDeleteStrategyConfirmInput,
        onCloseDeleteStrategyDialog: () => setIsDeleteStrategyDialogOpen(false),
        onConfirmDeleteStrategy: () => { void handleConfirmDeleteStrategy(); },
  };
}


export default useNodesEditorController;
