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
    label: "Idioma",
    placeholder: "es",
  },
  {
    name: "timezone",
    type: "string",
    required: false,
    label: "Zona horaria",
    placeholder: "America/Bogota",
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
    const payload = {
      display_name: typeof data.displayName === "string" ? data.displayName : null,
      locale: typeof data.locale === "string" && data.locale ? data.locale : "es",
      timezone: typeof data.timezone === "string" && data.timezone ? data.timezone : "America/Bogota",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_profiles")
      .update(payload)
      .eq("id", uid);

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
