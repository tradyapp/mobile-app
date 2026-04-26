import { supabase } from "@/lib/supabase";
import type { UserType, UserProfileResponse, UserFieldMetadata } from "@/types/UserType";
import { profileCacheService } from "@/services/ProfileCacheService";

const PROFILE_SCHEMA: UserFieldMetadata[] = [
  {
    name: "displayName",
    type: "string",
    required: true,
    label: "Nombre",
    placeholder: "Tu nombre",
  },
  {
    name: "displayname",
    type: "string",
    required: true,
    label: "Displayname",
    placeholder: "usuario_publico",
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
  private profilePromiseByUid = new Map<string, Promise<UserProfileResponse>>();
  private profileMemoryCache = new Map<string, { version: string | null; profile: UserProfileResponse }>();

  private buildUserProfileResponse(
    uid: string,
    data: {
      display_name?: string | null;
      displayname?: string | null;
      avatar_url?: string | null;
      locale?: string | null;
      timezone?: string | null;
    } | null | undefined,
  ): UserProfileResponse {
    const userData: Partial<UserType> = {
      uid,
      displayName: data?.display_name ?? "",
      displayname: data?.displayname ?? "",
      avatarUrl: data?.avatar_url ?? null,
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

  async getUserProfileVersion(uid: string): Promise<string> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("updated_at")
      .eq("id", uid)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return (data as { updated_at?: string } | null)?.updated_at ?? "0";
  }

  async getAvatarMeta(uid: string): Promise<{
    avatarUrl: string | null;
    avatarThumbUrl: string | null;
    avatarUpdatedAt: string | null;
  }> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("avatar_thumb_url, avatar_url, updated_at")
      .eq("id", uid)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return {
      avatarUrl: typeof data?.avatar_url === "string" ? data.avatar_url : null,
      avatarThumbUrl: typeof data?.avatar_thumb_url === "string" ? data.avatar_thumb_url : null,
      avatarUpdatedAt: typeof data?.updated_at === "string" ? data.updated_at : null,
    };
  }

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
      .select("id, display_name, displayname, avatar_url")
      .in("id", uniqueIds);

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id as string,
      displayName: typeof row.displayname === "string" && row.displayname.trim().length > 0
        ? row.displayname
        : (typeof row.display_name === "string" && row.display_name.trim().length > 0 ? row.display_name : "User"),
      avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    }));
  }

  async getUserProfile(uid: string): Promise<UserProfileResponse> {
    const inFlight = this.profilePromiseByUid.get(uid);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const [cachedProfile, cachedVersion, remoteVersion] = await Promise.all([
        profileCacheService.getProfile(uid),
        Promise.resolve(profileCacheService.getProfileVersion(uid)),
        this.getUserProfileVersion(uid),
      ]);

      const memory = this.profileMemoryCache.get(uid);
      if (memory && memory.version === remoteVersion) {
        return memory.profile;
      }
      if (cachedProfile && cachedVersion === remoteVersion) {
        this.profileMemoryCache.set(uid, { version: remoteVersion, profile: cachedProfile });
        return cachedProfile;
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, display_name, displayname, avatar_url, locale, timezone")
        .eq("id", uid)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const profile = this.buildUserProfileResponse(uid, data);
      await profileCacheService.setProfile(uid, profile, remoteVersion);
      this.profileMemoryCache.set(uid, { version: remoteVersion, profile });
      return profile;
    })();

    this.profilePromiseByUid.set(uid, promise);
    try {
      return await promise;
    } finally {
      this.profilePromiseByUid.delete(uid);
    }
  }

  async updateUserProfile(uid: string, data: Partial<UserType>): Promise<void> {
    const updatedAt = new Date().toISOString();
    const payload: Record<string, unknown> = {
      display_name: typeof data.displayName === "string" ? data.displayName : "",
      displayname: typeof data.displayname === "string" ? data.displayname : "",
      locale: typeof data.locale === "string" && data.locale ? data.locale : "es",
      timezone: typeof data.timezone === "string" && data.timezone ? data.timezone : "America/Bogota",
      updated_at: updatedAt,
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

    const profile = this.buildUserProfileResponse(uid, {
      display_name: payload.display_name as string,
      displayname: payload.displayname as string,
      avatar_url: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
      locale: payload.locale as string,
      timezone: payload.timezone as string,
    });
    await profileCacheService.setProfile(uid, profile, updatedAt);
    this.profileMemoryCache.set(uid, { version: updatedAt, profile });
  }

  private resizeSquare(file: File, size: number, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to process image"))),
          "image/webp",
          quality,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  }

  async uploadAvatar(uid: string, file: File): Promise<{
    avatarUrl: string;
    avatarThumbUrl: string;
    avatarUpdatedAt: string;
  }> {
    // Generate 400x400 full + 200x200 thumb in parallel
    const [fullBlob, thumbBlob] = await Promise.all([
      this.resizeSquare(file, 400, 0.85),
      this.resizeSquare(file, 200, 0.8),
    ]);

    const fullPath = `${uid}/avatar.webp`;
    const thumbPath = `${uid}/avatar_thumb.webp`;

    const [fullUp, thumbUp] = await Promise.all([
      supabase.storage.from("user-avatars").upload(fullPath, fullBlob, { contentType: "image/webp", upsert: true }),
      supabase.storage.from("user-avatars").upload(thumbPath, thumbBlob, { contentType: "image/webp", upsert: true }),
    ]);

    if (fullUp.error) throw fullUp.error;
    if (thumbUp.error) throw thumbUp.error;

    const cacheBuster = `?v=${Date.now()}`;
    const { data: fullData } = supabase.storage.from("user-avatars").getPublicUrl(fullPath);
    const { data: thumbData } = supabase.storage.from("user-avatars").getPublicUrl(thumbPath);
    const avatarUrl = `${fullData.publicUrl}${cacheBuster}`;
    const avatarThumbUrl = `${thumbData.publicUrl}${cacheBuster}`;

    // Update profile with both URLs
    const avatarUpdatedAt = new Date().toISOString();
    await supabase
      .from("user_profiles")
      .update({ avatar_url: avatarUrl, avatar_thumb_url: avatarThumbUrl, updated_at: avatarUpdatedAt })
      .eq("id", uid);

    const existing = this.profileMemoryCache.get(uid)?.profile ?? await profileCacheService.getProfile(uid);
    if (existing) {
      const profile: UserProfileResponse = {
        ...existing,
        userData: {
          ...existing.userData,
          avatarUrl,
        },
      };
      await profileCacheService.setProfile(uid, profile, avatarUpdatedAt);
      this.profileMemoryCache.set(uid, { version: avatarUpdatedAt, profile });
    }

    return { avatarUrl, avatarThumbUrl, avatarUpdatedAt };
  }

  async createInitialProfile(uid: string, email: string, displayName?: string): Promise<void> {
    await this.updateUserProfile(uid, {
      email,
      displayName: displayName || "",
    });
  }
}

export const userService = new UserService();
