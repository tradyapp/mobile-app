import { create } from "zustand";

interface AvatarCacheEntry {
  uid: string;
  avatarUrl: string | null;
  avatarUpdatedAt: string | null;
}

interface AvatarState {
  uid: string | null;
  avatarUrl: string | null;
  avatarUpdatedAt: string | null;
  hasHydrated: boolean;
  hasValidated: boolean;
  hydrateFromCache: (uid: string) => void;
  setAvatar: (entry: AvatarCacheEntry) => void;
  markValidated: () => void;
  reset: () => void;
}

const storageKey = (uid: string) => `trady_avatar_cache_${uid}`;

export const useAvatarStore = create<AvatarState>((set) => ({
  uid: null,
  avatarUrl: null,
  avatarUpdatedAt: null,
  hasHydrated: false,
  hasValidated: false,

  hydrateFromCache: (uid) => {
    try {
      const raw = localStorage.getItem(storageKey(uid));
      if (!raw) {
        set({ uid, avatarUrl: null, avatarUpdatedAt: null, hasHydrated: true, hasValidated: false });
        return;
      }

      const parsed = JSON.parse(raw) as Partial<AvatarCacheEntry>;
      set({
        uid,
        avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : null,
        avatarUpdatedAt: typeof parsed.avatarUpdatedAt === "string" ? parsed.avatarUpdatedAt : null,
        hasHydrated: true,
        hasValidated: false,
      });
    } catch {
      set({ uid, avatarUrl: null, avatarUpdatedAt: null, hasHydrated: true, hasValidated: false });
    }
  },

  setAvatar: ({ uid, avatarUrl, avatarUpdatedAt }) => {
    try {
      localStorage.setItem(
        storageKey(uid),
        JSON.stringify({ uid, avatarUrl, avatarUpdatedAt }),
      );
    } catch {
      // Ignore storage write failures.
    }

    set({ uid, avatarUrl, avatarUpdatedAt, hasHydrated: true, hasValidated: true });
  },

  markValidated: () => set({ hasValidated: true }),

  reset: () => set({
    uid: null,
    avatarUrl: null,
    avatarUpdatedAt: null,
    hasHydrated: false,
    hasValidated: false,
  }),
}));
