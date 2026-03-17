import type { IPrimitivePaneView, IPrimitivePaneRenderer, PrimitivePaneViewZOrder } from 'lightweight-charts';
import { DrawingsPaneRenderer, type DrawingRenderItem } from './DrawingsPaneRenderer';

export class DrawingsPaneView implements IPrimitivePaneView {
  private _renderer = new DrawingsPaneRenderer();

  update(items: DrawingRenderItem[]): void {
    this._renderer.update(items);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}
