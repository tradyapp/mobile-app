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
      id: uid,
      updated_at: new Date().toISOString(),
    };

    if (typeof data.displayName === "string") {
      payload.display_name = data.displayName;
    }
    if (typeof data.locale === "string" && data.locale) {
      payload.locale = data.locale;
    }
    if (typeof data.timezone === "string" && data.timezone) {
      payload.timezone = data.timezone;
    }

    const { error } = await supabase
      .from("user_profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      throw error;
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
