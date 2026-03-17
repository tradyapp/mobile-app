import type { Drawing } from '@/stores/drawingStore';
import type { ScreenPoint } from './coordinateUtils';

const HIT_TOLERANCE = 10; // pixels
const VERTEX_TOLERANCE = 16; // pixels — larger for mobile-friendly touch targets

export type HitTestResult =
  | { type: 'vertex'; index: number }
  | { type: 'body' }
  | null;

function distanceToSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function hitTestDrawing(
  x: number,
  y: number,
  drawing: Drawing,
  screenPoints: ScreenPoint[],
  pixelsPerBar: number = 8
): boolean {
  switch (drawing.type) {
    case 'line':
      return distanceToSegment(x, y, screenPoints[0].x, screenPoints[0].y, screenPoints[1].x, screenPoints[1].y) < HIT_TOLERANCE;

    case 'horizontal_line':
      return Math.abs(y - screenPoints[0].y) < HIT_TOLERANCE;

    case 'vertical_line':
      return Math.abs(x - screenPoints[0].x) < HIT_TOLERANCE;

    case 'rectangle': {
      const [p1, p2] = screenPoints;
      const left = Math.min(p1.x, p2.x);
      const right = Math.max(p1.x, p2.x);
      const top = Math.min(p1.y, p2.y);
      const bottom = Math.max(p1.y, p2.y);
      const nearHorz = x >= left - HIT_TOLERANCE && x <= right + HIT_TOLERANCE;
      const nearVert = y >= top - HIT_TOLERANCE && y <= bottom + HIT_TOLERANCE;
      return (
        (Math.abs(y - top) < HIT_TOLERANCE && nearHorz) ||
        (Math.abs(y - bottom) < HIT_TOLERANCE && nearHorz) ||
        (Math.abs(x - left) < HIT_TOLERANCE && nearVert) ||
        (Math.abs(x - right) < HIT_TOLERANCE && nearVert)
      );
    }

    case 'ellipse': {
      const [p1, p2] = screenPoints;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;
      if (rx < 1 || ry < 1) return false;
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const dist = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      return Math.abs(dist - 1) < HIT_TOLERANCE / Math.min(rx, ry);
    }

    case 'freehand': {
      for (let i = 0; i < screenPoints.length - 1; i++) {
        if (distanceToSegment(x, y, screenPoints[i].x, screenPoints[i].y, screenPoints[i + 1].x, screenPoints[i + 1].y) < HIT_TOLERANCE) {
          return true;
        }
      }
      return false;
    }

    case 'triangle': {
      const [p1, p2] = screenPoints;
      const left = Math.min(p1.x, p2.x);
      const right = Math.max(p1.x, p2.x);
      const top = Math.min(p1.y, p2.y);
      const bottom = Math.max(p1.y, p2.y);
      const midX = (left + right) / 2;
      return (
        distanceToSegment(x, y, midX, top, right, bottom) < HIT_TOLERANCE ||
        distanceToSegment(x, y, right, bottom, left, bottom) < HIT_TOLERANCE ||
        distanceToSegment(x, y, left, bottom, midX, top) < HIT_TOLERANCE
      );
    }

    case 'inverted_triangle': {
      const [p1, p2] = screenPoints;
      const left = Math.min(p1.x, p2.x);
      const right = Math.max(p1.x, p2.x);
      const top = Math.min(p1.y, p2.y);
      const bottom = Math.max(p1.y, p2.y);
      const midX = (left + right) / 2;
      return (
        distanceToSegment(x, y, left, top, right, top) < HIT_TOLERANCE ||
        distanceToSegment(x, y, right, top, midX, bottom) < HIT_TOLERANCE ||
        distanceToSegment(x, y, midX, bottom, left, top) < HIT_TOLERANCE
      );
    }

    case 'polygon': {
      for (let i = 0; i < screenPoints.length; i++) {
        const a = screenPoints[i];
        const b = screenPoints[(i + 1) % screenPoints.length];
        if (distanceToSegment(x, y, a.x, a.y, b.x, b.y) < HIT_TOLERANCE) {
          return true;
        }
      }
      return false;
    }

    case 'text': {
      const p = screenPoints[0];
      if (!p) return false;
      const fontSize = (drawing.fontSize || 2) * pixelsPerBar;
      const lineH = fontSize * 1.3;
      const lines = (drawing.textContent || 'Text').split('\n');
      const offscreen = new OffscreenCanvas(1, 1);
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return false;
      offCtx.font = `${fontSize}px Arial`;
      let maxWidth = 0;
      for (const line of lines) {
        const w = offCtx.measureText(line).width;
        if (w > maxWidth) maxWidth = w;
      }
      const totalHeight = lines.length * lineH;
      const hAlign = drawing.textHAlign || 'left';
      const vAlign = drawing.textVAlign || 'middle';
      let boxLeft = p.x;
      if (hAlign === 'center') boxLeft = p.x - maxWidth / 2;
      else if (hAlign === 'right') boxLeft = p.x - maxWidth;
      let boxTop: number;
      if (vAlign === 'top') boxTop = p.y;
      else if (vAlign === 'bottom') boxTop = p.y - totalHeight;
      else /* middle */ boxTop = p.y - totalHeight / 2;
      return (
        x >= boxLeft - HIT_TOLERANCE &&
        x <= boxLeft + maxWidth + HIT_TOLERANCE &&
        y >= boxTop - HIT_TOLERANCE &&
        y <= boxTop + totalHeight + HIT_TOLERANCE
      );
    }

    default:
      return false;
  }
}

/**
 * Returns the draggable vertex positions for a drawing.
 * Rectangle & ellipse get 4 corner vertices derived from 2 stored points.
 * All other shapes return the raw screen points.
 */
export function getVirtualVertices(
  type: Drawing['type'],
  screenPoints: ScreenPoint[]
): ScreenPoint[] {
  if ((type === 'rectangle' || type === 'ellipse') && screenPoints.length === 2) {
    const [p1, p2] = screenPoints;
    return [
      { x: p1.x, y: p1.y }, // v0: point[0] corner
      { x: p2.x, y: p1.y }, // v1: top-right
      { x: p2.x, y: p2.y }, // v2: point[1] corner
      { x: p1.x, y: p2.y }, // v3: bottom-left
    ];
  }
  return screenPoints;
}

export function hitTestDrawingDetail(
  x: number,
  y: number,
  drawing: Drawing,
  screenPoints: ScreenPoint[],
  pixelsPerBar: number = 8
): HitTestResult {
  // Freehand & text: body-only drag, no vertex handles
  if (drawing.type === 'freehand' || drawing.type === 'text') {
    return hitTestDrawing(x, y, drawing, screenPoints, pixelsPerBar) ? { type: 'body' } : null;
  }

  // Check virtual vertices first (larger tolerance for mobile touch targets)
  const vertices = getVirtualVertices(drawing.type, screenPoints);
  for (let i = 0; i < vertices.length; i++) {
    const dx = x - vertices[i].x;
    const dy = y - vertices[i].y;
    if (dx * dx + dy * dy < VERTEX_TOLERANCE * VERTEX_TOLERANCE) {
      return { type: 'vertex', index: i };
    }
  }

  // Fall back to body hit test
  if (hitTestDrawing(x, y, drawing, screenPoints)) {
    return { type: 'body' };
  }

  return null;
}
