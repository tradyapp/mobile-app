import type { Drawing } from "@/stores/drawingStore";

export type Unsubscribe = () => void;

const listeners = new Map<string, Set<(drawings: Drawing[]) => void>>();

function keyFor(symbol: string): string {
  return `trady:drawings:${symbol.toUpperCase()}`;
}

function readSymbol(symbol: string): Record<string, Record<string, Drawing>> {
  try {
    const raw = localStorage.getItem(keyFor(symbol));
    return raw ? (JSON.parse(raw) as Record<string, Record<string, Drawing>>) : {};
  } catch {
    return {};
  }
}

function writeSymbol(symbol: string, value: Record<string, Record<string, Drawing>>) {
  localStorage.setItem(keyFor(symbol), JSON.stringify(value));
}

function emit(symbol: string) {
  const set = listeners.get(symbol.toUpperCase());
  if (!set) return;
  const all = readSymbol(symbol);
  const flattened: Drawing[] = Object.values(all).flatMap((tf) => Object.values(tf));
  set.forEach((fn) => fn(flattened));
}

export class DrawingStorageService {
  static subscribe(symbol: string, timeframe: string, onDrawings: (drawings: Drawing[]) => void): Unsubscribe {
    return this.subscribeAll(symbol, (drawings) => {
      onDrawings(drawings.filter((drawing) => drawing.timeframe === timeframe));
    });
  }

  static subscribeAll(symbol: string, onDrawings: (drawings: Drawing[]) => void): Unsubscribe {
    const normalized = symbol.toUpperCase();
    const current = listeners.get(normalized) ?? new Set();
    current.add(onDrawings);
    listeners.set(normalized, current);

    const initial = readSymbol(symbol);
    const flattened: Drawing[] = Object.values(initial).flatMap((tf) => Object.values(tf));
    onDrawings(flattened);

    return () => {
      const set = listeners.get(normalized);
      if (!set) return;
      set.delete(onDrawings);
      if (set.size === 0) listeners.delete(normalized);
    };
  }

  static async save(drawing: Drawing): Promise<void> {
    const data = readSymbol(drawing.symbol);
    const timeframeMap = data[drawing.timeframe] ?? {};
    timeframeMap[drawing.id] = drawing;
    data[drawing.timeframe] = timeframeMap;
    writeSymbol(drawing.symbol, data);
    emit(drawing.symbol);
  }

  static async update(drawing: Drawing): Promise<void> {
    await this.save(drawing);
  }

  static async remove(id: string, symbol: string, timeframe: string): Promise<void> {
    const data = readSymbol(symbol);
    const timeframeMap = data[timeframe] ?? {};
    delete timeframeMap[id];
    data[timeframe] = timeframeMap;
    writeSymbol(symbol, data);
    emit(symbol);
  }

  static async clear(symbol: string): Promise<void> {
    localStorage.removeItem(keyFor(symbol));
    emit(symbol);
  }
}
