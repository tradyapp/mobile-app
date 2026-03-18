import { supabase } from "@/lib/supabase";
import type { DrawingTemplate, DefaultDrawingTemplateIds } from "@/stores/drawingTemplateStore";

export type Unsubscribe = () => void;

interface DrawingTemplateRow {
  template: DrawingTemplate;
}

interface DrawingDefaultsRow {
  defaults: DefaultDrawingTemplateIds | null;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

async function upsertDefaultsPatch(userId: string, patch: Partial<DefaultDrawingTemplateIds>): Promise<void> {
  const { data, error } = await supabase
    .from("user_drawing_defaults")
    .select("defaults")
    .eq("user_id", userId)
    .single();

  const current = (!error && data?.defaults ? (data.defaults as DefaultDrawingTemplateIds) : {} as DefaultDrawingTemplateIds);
  const next = { ...current, ...patch };

  const { error: upsertError } = await supabase
    .from("user_drawing_defaults")
    .upsert(
      {
        user_id: userId,
        defaults: next,
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("DrawingTemplateStorageService.setDefaultTemplate error:", upsertError);
  }
}

export class DrawingTemplateStorageService {
  static subscribeTemplates(onTemplates: (templates: DrawingTemplate[]) => void): Unsubscribe {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const userId = await getCurrentUserId();
      if (!userId || !active) {
        onTemplates([]);
        return;
      }

      const load = async () => {
        const { data, error } = await supabase
          .from("user_drawing_templates")
          .select("template")
          .eq("user_id", userId)
          .order("updated_at", { ascending: true });

        if (!active) return;

        if (error) {
          console.error("DrawingTemplateStorageService.subscribeTemplates error:", error);
          onTemplates([]);
          return;
        }

        const templates = (data ?? []).map((row) => (row as DrawingTemplateRow).template);
        onTemplates(templates);
      };

      await load();

      channel = supabase
        .channel(`user-drawing-templates-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_drawing_templates", filter: `user_id=eq.${userId}` },
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

  static subscribeDefaultTemplates(onDefaults: (defaults: DefaultDrawingTemplateIds | null) => void): Unsubscribe {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const userId = await getCurrentUserId();
      if (!userId || !active) {
        onDefaults(null);
        return;
      }

      const load = async () => {
        const { data, error } = await supabase
          .from("user_drawing_defaults")
          .select("defaults")
          .eq("user_id", userId)
          .single();

        if (!active) return;

        if (error && error.code !== "PGRST116") {
          console.error("DrawingTemplateStorageService.subscribeDefaultTemplates error:", error);
          onDefaults(null);
          return;
        }

        onDefaults((data as DrawingDefaultsRow | null)?.defaults ?? null);
      };

      await load();

      channel = supabase
        .channel(`user-drawing-defaults-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_drawing_defaults", filter: `user_id=eq.${userId}` },
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

  static async save(template: DrawingTemplate): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("user_drawing_templates")
      .upsert(
        {
          user_id: userId,
          id: template.id,
          category: template.category,
          template,
        },
        { onConflict: "user_id,id" }
      );

    if (error) {
      console.error("DrawingTemplateStorageService.save error:", error);
    }
  }

  static async remove(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("user_drawing_templates")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      console.error("DrawingTemplateStorageService.remove error:", error);
    }
  }

  static async setDefaultTemplate(category: string, id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    if (category !== "line" && category !== "shape" && category !== "text") {
      return;
    }

    await upsertDefaultsPatch(userId, { [category]: id } as Partial<DefaultDrawingTemplateIds>);
  }
}
