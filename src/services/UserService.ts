import { supabase } from "@/lib/supabase";
import type { UserType, UserProfileResponse, UserFieldMetadata } from "@/types/UserType";

const PROFILE_SCHEMA: UserFieldMetadata[] = [
  {
    name: "displayName",
    type: "string",
    required: true,
    label: "Display Name",
    placeholder: "Tu nombre",
  },
  {
    name: "locale",
    type: "string",
    required: false,
    label: "Language",
    options: ["en:English", "es:Español"],
  },
  {
    name: "timezone",
    type: "string",
    required: false,
    label: "Timezone",
    options: [
      "America/New_York:New York (EST)",
      "America/Chicago:Chicago (CST)",
      "America/Denver:Denver (MST)",
      "America/Los_Angeles:Los Angeles (PST)",
      "America/Mexico_City:Mexico City",
      "America/Bogota:Bogota",
      "America/Lima:Lima",
      "America/Santiago:Santiago",
      "America/Buenos_Aires:Buenos Aires",
      "America/Sao_Paulo:Sao Paulo",
      "Europe/London:London (GMT)",
      "Europe/Madrid:Madrid (CET)",
      "Europe/Paris:Paris (CET)",
      "Asia/Tokyo:Tokyo (JST)",
      "Asia/Shanghai:Shanghai (CST)",
      "Asia/Dubai:Dubai (GST)",
      "Pacific/Auckland:Auckland (NZST)",
    ],
  },
];

class UserService {
  async listPublicProfiles(ids: string[]): Promise<Array<{ id: string; displayName: string; avatarUrl: string | null }>> {
    const uniqueIds = Array.from(new Set(ids.filter((item) => typeof item === "string" && item.length > 0)));
    if (uniqueIds.length === 0) return [];

    const { data: rpcData, error: rpcError } = await supabase
      .rpc("list_public_user_profiles", { p_ids: uniqueIds });

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData.map((row) => ({
        id: row.id as string,
        displayName: typeof row.display_name === "string" && row.display_name.trim().length > 0 ? row.display_name : "User",
        avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
      }));
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, display_name, avatar_url")
      .in("id", uniqueIds);

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id as string,
      displayName: typeof row.display_name === "string" && row.display_name.trim().length > 0 ? row.display_name : "User",
      avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    }));
  }

  async getUserProfile(uid: string): Promise<UserProfileResponse> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, display_name, locale, timezone")
      .eq("id", uid)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    const userData: Partial<UserType> = {
      uid,
      displayName: data?.display_name ?? "",
      locale: data?.locale ?? "es",
      timezone: data?.timezone ?? "America/Bogota",
    } as Partial<UserType>;

    const missingFields = PROFILE_SCHEMA
      .filter((field) => field.required)
      .map((field) => field.name)
      .filter((name) => {
        const value = userData[name];
        return value === undefined || value === null || value === "";
      });

    return {
      userData,
      missingFields,
      isComplete: missingFields.length === 0,
      schema: PROFILE_SCHEMA,
    };
  }

  async updateUserProfile(uid: string, data: Partial<UserType>): Promise<void> {
    const payload: Record<string, unknown> = {
      display_name: typeof data.displayName === "string" ? data.displayName : "",
      locale: typeof data.locale === "string" && data.locale ? data.locale : "es",
      timezone: typeof data.timezone === "string" && data.timezone ? data.timezone : "America/Bogota",
      updated_at: new Date().toISOString(),
    };

    // Try update first
    const { data: updated, error: updateError } = await supabase
      .from("user_profiles")
      .update(payload)
      .eq("id", uid)
      .select("id");

    if (updateError) {
      throw updateError;
    }

    // If no row was updated, insert a new one
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from("user_profiles")
        .insert({ id: uid, ...payload });

      if (insertError) {
        throw insertError;
      }
    }
  }

  async createInitialProfile(uid: string, email: string, displayName?: string): Promise<void> {
    await this.updateUserProfile(uid, {
      email,
      displayName: displayName || "",
    });
  }
}

export const userService = new UserService();
