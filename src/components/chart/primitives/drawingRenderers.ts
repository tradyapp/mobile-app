import type { Drawing, DrawingFill } from '@/stores/drawingStore';
import type { ScreenPoint } from './coordinateUtils';

function applyDrawingStyle(ctx: CanvasRenderingContext2D, drawing: Drawing): void {
  ctx.globalAlpha = drawing.opacity ?? 1;
  const dash = drawing.strokeDash ?? 'solid';
  ctx.setLineDash(
    dash === 'dashed' ? [10, 6] :
    dash === 'dotted' ? [3, 4] : []
  );
}

function resetDrawingStyle(ctx: CanvasRenderingContext2D): void {
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function createFillGradient(
  ctx: CanvasRenderingContext2D,
  fill: DrawingFill,
  left: number, top: number, width: number, height: number
): CanvasGradient {
  const dir = fill.gradientDirection || 'down';
  let x0: number, y0: number, x1: number, y1: number;
  switch (dir) {
    case 'down':  x0=left+width/2; y0=top; x1=left+width/2; y1=top+height; break;
    case 'up':    x0=left+width/2; y0=top+height; x1=left+width/2; y1=top; break;
    case 'right': x0=left; y0=top+height/2; x1=left+width; y1=top+height/2; break;
    case 'left':  x0=left+width; y0=top+height/2; x1=left; y1=top+height/2; break;
  }
  const gradient = ctx.createLinearGradient(x0!, y0!, x1!, y1!);
  gradient.addColorStop(0, hexToRgba(fill.gradientColor1 || '#ffffff', fill.gradientOpacity1 ?? 0.2));
  gradient.addColorStop(1, hexToRgba(fill.gradientColor2 || '#3b82f6', fill.gradientOpacity2 ?? 0));
  return gradient;
}

export function renderLine(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[]
): void {
  const [p1, p2] = screenPoints;
  applyDrawingStyle(ctx, drawing);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.stroke();
  resetDrawingStyle(ctx);
}

export function renderHorizontalLine(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[],
  mediaWidth: number
): void {
  const py = screenPoints[0].y;
  applyDrawingStyle(ctx, drawing);
  ctx.beginPath();
  ctx.moveTo(0, py);
  ctx.lineTo(mediaWidth, py);
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.stroke();
  resetDrawingStyle(ctx);
}

export function renderVerticalLine(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[],
  _mediaWidth: number,
  mediaHeight: number
): void {
  const px = screenPoints[0].x;
  applyDrawingStyle(ctx, drawing);
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, mediaHeight);
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.stroke();
  resetDrawingStyle(ctx);
}

export function renderRectangle(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[]
): void {
  const [p1, p2] = screenPoints;
  const left = Math.min(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const width = Math.abs(p2.x - p1.x);
  const height = Math.abs(p2.y - p1.y);
  applyDrawingStyle(ctx, drawing);
  if (drawing.fill && drawing.fill.type !== 'none') {
    const savedAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 1;
    if (drawing.fill.type === 'solid') {
      ctx.fillStyle = hexToRgba(drawing.fill.color || drawing.color, drawing.fill.opacity ?? 0.2);
      ctx.fillRect(left, top, width, height);
    } else if (drawing.fill.type === 'gradient') {
      ctx.fillStyle = createFillGradient(ctx, drawing.fill, left, top, width, height);
      ctx.fillRect(left, top, width, height);
    }
    ctx.globalAlpha = savedAlpha;
  }
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.strokeRect(left, top, width, height);
  resetDrawingStyle(ctx);
}

export function renderEllipse(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[]
): void {
  const [p1, p2] = screenPoints;
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;
  const rx = Math.abs(p2.x - p1.x) / 2;
  const ry = Math.abs(p2.y - p1.y) / 2;
  applyDrawingStyle(ctx, drawing);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  if (drawing.fill && drawing.fill.type !== 'none') {
    const savedAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 1;
    const left = cx - rx;
    const top = cy - ry;
    const width = rx * 2;
    const height = ry * 2;
    if (drawing.fill.type === 'solid') {
      ctx.fillStyle = hexToRgba(drawing.fill.color || drawing.color, drawing.fill.opacity ?? 0.2);
    } else if (drawing.fill.type === 'gradient') {
      ctx.fillStyle = createFillGradient(ctx, drawing.fill, left, top, width, height);
    }
    ctx.fill();
    ctx.globalAlpha = savedAlpha;
  }
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.stroke();
  resetDrawingStyle(ctx);
}

function fillClosedPath(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  left: number, top: number, width: number, height: number
): void {
  if (drawing.fill && drawing.fill.type !== 'none') {
    const savedAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 1;
    if (drawing.fill.type === 'solid') {
      ctx.fillStyle = hexToRgba(drawing.fill.color || drawing.color, drawing.fill.opacity ?? 0.2);
    } else if (drawing.fill.type === 'gradient') {
      ctx.fillStyle = createFillGradient(ctx, drawing.fill, left, top, width, height);
    }
    ctx.fill();
    ctx.globalAlpha = savedAlpha;
  }
}

export function renderTriangle(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[]
): void {
  const [p1, p2] = screenPoints;
  const left = Math.min(p1.x, p2.x);
  const right = Math.max(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const bottom = Math.max(p1.y, p2.y);
  const midX = (left + right) / 2;

  applyDrawingStyle(ctx, drawing);

  ctx.beginPath();
  ctx.moveTo(midX, top);
  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();

  fillClosedPath(ctx, drawing, left, top, right - left, bottom - top);
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.stroke();
  resetDrawingStyle(ctx);
}

export function renderInvertedTriangle(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[]
): void {
  const [p1, p2] = screenPoints;
  const left = Math.min(p1.x, p2.x);
  const right = Math.max(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const bottom = Math.max(p1.y, p2.y);
  const midX = (left + right) / 2;

  applyDrawingStyle(ctx, drawing);

  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(midX, bottom);
  ctx.closePath();

  fillClosedPath(ctx, drawing, left, top, right - left, bottom - top);
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.stroke();
  resetDrawingStyle(ctx);
}

export function renderPolygon(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[]
): void {
  if (screenPoints.length < 3) return;
  applyDrawingStyle(ctx, drawing);

  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  ctx.closePath();

  // Compute bounding box for fill gradient
  let left = screenPoints[0].x, right = screenPoints[0].x;
  let top = screenPoints[0].y, bottom = screenPoints[0].y;
  for (let i = 1; i < screenPoints.length; i++) {
    if (screenPoints[i].x < left) left = screenPoints[i].x;
    if (screenPoints[i].x > right) right = screenPoints[i].x;
    if (screenPoints[i].y < top) top = screenPoints[i].y;
    if (screenPoints[i].y > bottom) bottom = screenPoints[i].y;
  }
  fillClosedPath(ctx, drawing, left, top, right - left, bottom - top);

  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.stroke();
  resetDrawingStyle(ctx);
}

export function renderFreehand(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[]
): void {
  if (screenPoints.length < 2) return;
  applyDrawingStyle(ctx, drawing);
  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  resetDrawingStyle(ctx);
}

const TEXT_LINE_HEIGHT = 1.3;

export function renderText(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[],
  _mediaWidth: number,
  _mediaHeight: number,
  pixelsPerBar: number = 8
): void {
  if (screenPoints.length < 1) return;
  const p = screenPoints[0];
  const fontSize = (drawing.fontSize || 2) * pixelsPerBar;
  const lineH = fontSize * TEXT_LINE_HEIGHT;
  const lines = (drawing.textContent || 'Text').split('\n');
  const vAlign = drawing.textVAlign || 'middle';

  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = drawing.textHAlign || 'left';
  ctx.textBaseline = 'middle'; // we offset each line manually
  ctx.globalAlpha = drawing.opacity ?? 1;
  ctx.fillStyle = drawing.color;

  // Calculate the y offset for the first line based on vertical alignment
  const totalHeight = lines.length * lineH;
  let startY: number;
  if (vAlign === 'top') startY = p.y + lineH / 2;
  else if (vAlign === 'bottom') startY = p.y - totalHeight + lineH / 2;
  else /* middle */ startY = p.y - totalHeight / 2 + lineH / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], p.x, startY + i * lineH);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

type CanvasRenderer = (
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  screenPoints: ScreenPoint[],
  mediaWidth: number,
  mediaHeight: number,
  pixelsPerBar: number
) => void;

export const canvasRenderers: Record<string, CanvasRenderer> = {
  line: renderLine,
  horizontal_line: renderHorizontalLine,
  vertical_line: renderVerticalLine,
  rectangle: renderRectangle,
  ellipse: renderEllipse,
  triangle: renderTriangle,
  inverted_triangle: renderInvertedTriangle,
  polygon: renderPolygon,
  freehand: renderFreehand,
  text: renderText,
};
