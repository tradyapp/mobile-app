import { supabase } from "@/lib/supabase";
import type { ChartTemplate, ChartPreferences } from "@/stores/chartSettingsStore";

export type Unsubscribe = () => void;

interface ChartTemplateRow {
  id: string;
  template: ChartTemplate;
}

interface ChartPreferencesRow {
  active_template_id: string | null;
  preferences: ChartPreferences | null;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

export class ChartTemplateStorageService {
  static subscribeTemplates(onTemplates: (templates: ChartTemplate[]) => void): Unsubscribe {
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
          .from("user_chart_templates")
          .select("id, template")
          .eq("user_id", userId)
          .order("updated_at", { ascending: true });

        if (!active) return;

        if (error) {
          console.error("ChartTemplateStorageService.subscribeTemplates error:", error);
          onTemplates([]);
          return;
        }

        const templates = (data ?? []).map((row) => (row as ChartTemplateRow).template);
        onTemplates(templates);
      };

      await load();

      channel = supabase
        .channel(`user-chart-templates-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_chart_templates", filter: `user_id=eq.${userId}` },
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

  static subscribeActiveTemplate(onActiveId: (id: string | null) => void): Unsubscribe {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const userId = await getCurrentUserId();
      if (!userId || !active) {
        onActiveId(null);
        return;
      }

      const load = async () => {
        const { data, error } = await supabase
          .from("user_chart_preferences")
          .select("active_template_id, preferences")
          .eq("user_id", userId)
          .single();

        if (!active) return;

        if (error && error.code !== "PGRST116") {
          console.error("ChartTemplateStorageService.subscribeActiveTemplate error:", error);
          onActiveId(null);
          return;
        }

        onActiveId((data as ChartPreferencesRow | null)?.active_template_id ?? null);
      };

      await load();

      channel = supabase
        .channel(`user-chart-preferences-active-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_chart_preferences", filter: `user_id=eq.${userId}` },
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

  static async save(template: ChartTemplate): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("user_chart_templates")
      .upsert(
        {
          user_id: userId,
          id: template.id,
          template,
        },
        { onConflict: "user_id,id" }
      );

    if (error) {
      console.error("ChartTemplateStorageService.save error:", error);
    }
  }

  static async remove(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("user_chart_templates")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      console.error("ChartTemplateStorageService.remove error:", error);
    }
  }

  static async setActiveTemplate(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("user_chart_preferences")
      .upsert(
        {
          user_id: userId,
          active_template_id: id,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("ChartTemplateStorageService.setActiveTemplate error:", error);
    }
  }

  static subscribePreferences(onPrefs: (prefs: ChartPreferences | null) => void): Unsubscribe {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const userId = await getCurrentUserId();
      if (!userId || !active) {
        onPrefs(null);
        return;
      }

      const load = async () => {
        const { data, error } = await supabase
          .from("user_chart_preferences")
          .select("active_template_id, preferences")
          .eq("user_id", userId)
          .single();

        if (!active) return;

        if (error && error.code !== "PGRST116") {
          console.error("ChartTemplateStorageService.subscribePreferences error:", error);
          onPrefs(null);
          return;
        }

        onPrefs((data as ChartPreferencesRow | null)?.preferences ?? null);
      };

      await load();

      channel = supabase
        .channel(`user-chart-preferences-prefs-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_chart_preferences", filter: `user_id=eq.${userId}` },
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

  static async setPreferences(prefs: ChartPreferences): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("user_chart_preferences")
      .upsert(
        {
          user_id: userId,
          preferences: prefs,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("ChartTemplateStorageService.setPreferences error:", error);
    }
  }
}
