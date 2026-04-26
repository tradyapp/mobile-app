import { clientCacheService } from "@/services/cache/ClientCacheService";
import type { UserProfileResponse } from "@/types/UserType";

class ProfileCacheService {
  private profileKey(uid: string): string {
    return `profile:${uid}`;
  }

  async getProfile(uid: string): Promise<UserProfileResponse | null> {
    return clientCacheService.getPayload<UserProfileResponse>(this.profileKey(uid));
  }

  async setProfile(uid: string, profile: UserProfileResponse, version: string | null): Promise<void> {
    await clientCacheService.setPayload(this.profileKey(uid), profile);
    clientCacheService.writeMeta(this.profileKey(uid), version);
  }

  getProfileVersion(uid: string): string | null {
    return clientCacheService.readMeta(this.profileKey(uid))?.version ?? null;
  }
}

export const profileCacheService = new ProfileCacheService();
