import { supabase } from "@/lib/supabase";
import type { Drawing } from "@/stores/drawingStore";

export type Unsubscribe = () => void;

interface UserDrawingRow {
  id: string;
  symbol: string;
  timeframe: string;
  drawing: Drawing;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

export class DrawingStorageService {
  static subscribe(symbol: string, timeframe: string, onDrawings: (drawings: Drawing[]) => void): Unsubscribe {
    return this.subscribeAll(symbol, (drawings) => {
      onDrawings(drawings.filter((drawing) => drawing.timeframe === timeframe));
    });
  }

  static subscribeAll(symbol: string, onDrawings: (drawings: Drawing[]) => void): Unsubscribe {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const userId = await getCurrentUserId();
      const normalizedSymbol = normalizeSymbol(symbol);

      if (!userId || !active) {
        onDrawings([]);
        return;
      }

      const load = async () => {
        const { data, error } = await supabase
          .from("user_drawings")
          .select("id, symbol, timeframe, drawing")
          .eq("user_id", userId)
          .eq("symbol", normalizedSymbol)
          .order("updated_at", { ascending: true });

        if (!active) return;

        if (error) {
          console.error("DrawingStorageService.subscribeAll error:", error);
          onDrawings([]);
          return;
        }

        const drawings = (data ?? []).map((row) => {
          const typed = row as UserDrawingRow;
          return {
            ...typed.drawing,
            id: typed.id,
            symbol: typed.symbol,
            timeframe: typed.timeframe,
          } as Drawing;
        });

        onDrawings(drawings);
      };

      await load();

      channel = supabase
        .channel(`user-drawings-${userId}-${normalizedSymbol}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_drawings", filter: `user_id=eq.${userId}` },
          () => {
            void load();
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }

  static async save(drawing: Drawing): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const normalizedSymbol = normalizeSymbol(drawing.symbol);

    const { error } = await supabase
      .from("user_drawings")
      .upsert(
        {
          user_id: userId,
          id: drawing.id,
          symbol: normalizedSymbol,
          timeframe: drawing.timeframe,
          drawing: {
            ...drawing,
            symbol: normalizedSymbol,
          },
        },
        { onConflict: "user_id,id" }
      );

    if (error) {
      console.error("DrawingStorageService.save error:", error);
    }
  }

  static async update(drawing: Drawing): Promise<void> {
    await this.save(drawing);
  }

  static async remove(id: string, symbol: string, timeframe: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const normalizedSymbol = normalizeSymbol(symbol);

    const { error } = await supabase
      .from("user_drawings")
      .delete()
      .eq("user_id", userId)
      .eq("id", id)
      .eq("symbol", normalizedSymbol)
      .eq("timeframe", timeframe);

    if (error) {
      console.error("DrawingStorageService.remove error:", error);
    }
  }

  static async clear(symbol: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const normalizedSymbol = normalizeSymbol(symbol);

    const { error } = await supabase
      .from("user_drawings")
      .delete()
      .eq("user_id", userId)
      .eq("symbol", normalizedSymbol);

    if (error) {
      console.error("DrawingStorageService.clear error:", error);
    }
  }
}
