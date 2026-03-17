import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer } from 'lightweight-charts';
import type { Drawing } from '@/stores/drawingStore';
import type { ScreenPoint } from './coordinateUtils';
import { canvasRenderers } from './drawingRenderers';
import { getVirtualVertices } from './hitTestUtils';

export interface DrawingRenderItem {
  drawing: Drawing;
  screenPoints: ScreenPoint[];
  isHovered: boolean;
  isSelected: boolean;
  pixelsPerBar: number;
}

export class DrawingsPaneRenderer implements IPrimitivePaneRenderer {
  private _items: DrawingRenderItem[] = [];

  update(items: DrawingRenderItem[]): void {
    this._items = items;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      for (const item of this._items) {
        const renderer = canvasRenderers[item.drawing.type];
        if (!renderer) continue;

        // Render light blue outline behind the drawing when selected/hovered (skip text — uses bounding box instead)
        if ((item.isHovered || item.isSelected) && item.drawing.type !== 'text') {
          const outlineDrawing = {
            ...item.drawing,
            color: '#ffffff',
            strokeWidth: item.drawing.strokeWidth + 4,
            opacity: 0.5,

            strokeDash: 'solid' as const, // outline always solid
          };
          renderer(ctx, outlineDrawing, item.screenPoints, mediaSize.width, mediaSize.height, item.pixelsPerBar);
        }

        renderer(ctx, item.drawing, item.screenPoints, mediaSize.width, mediaSize.height, item.pixelsPerBar);

        // Reset ctx state after drawing + outline so they don't bleed
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);

        // Text selection: bounding box + pivot circle
        if (item.isSelected && item.drawing.type === 'text' && item.screenPoints.length > 0) {
          const p = item.screenPoints[0];
          const fontSize = (item.drawing.fontSize || 2) * item.pixelsPerBar;
          const lineH = fontSize * 1.3;
          const lines = (item.drawing.textContent || 'Text').split('\n');
          ctx.font = `${fontSize}px Arial`;
          let maxWidth = 0;
          for (const line of lines) {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
          }
          const totalHeight = lines.length * lineH;
          const hAlign = item.drawing.textHAlign || 'left';
          const vAlign = item.drawing.textVAlign || 'middle';
          let boxLeft = p.x;
          if (hAlign === 'center') boxLeft = p.x - maxWidth / 2;
          else if (hAlign === 'right') boxLeft = p.x - maxWidth;
          let boxTop: number;
          if (vAlign === 'top') boxTop = p.y;
          else if (vAlign === 'bottom') boxTop = p.y - totalHeight;
          else /* middle */ boxTop = p.y - totalHeight / 2;
          const pad = 4;

          // Bounding box
          ctx.strokeStyle = '#ffffff';
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.strokeRect(boxLeft - pad, boxTop - pad, maxWidth + pad * 2, totalHeight + pad * 2);

          // Pivot circle
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = 1;
        }

        // Render vertex handles when selected (skip freehand & text — body-only drag)
        if (item.isSelected && item.drawing.type !== 'freehand' && item.drawing.type !== 'text') {
          const vertices = getVirtualVertices(item.drawing.type, item.screenPoints);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          for (const v of vertices) {
            ctx.beginPath();
            ctx.arc(v.x, v.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
      }
    });
  }
}
