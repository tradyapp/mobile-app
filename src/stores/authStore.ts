import { create } from "zustand";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AppUser {
  uid: string;
  email: string | null;
  raw: User;
}

interface AuthStore {
  user: AppUser | null;
  isSessionLoaded: boolean;
  authEvent: AuthChangeEvent | null;
  setUser: (user: AppUser | null) => void;
  setSessionLoaded: (loaded: boolean) => void;
  clearAuthEvent: () => void;
  initializeAuth: () => void;
}

const toAppUser = (user: User): AppUser => ({
  uid: user.id,
  email: user.email ?? null,
  raw: user,
});

let authInitialized = false;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isSessionLoaded: false,
  authEvent: null,

  setUser: (user) => set({ user }),

  setSessionLoaded: (loaded) => set({ isSessionLoaded: loaded }),

  clearAuthEvent: () => set({ authEvent: null }),

  initializeAuth: () => {
    if (authInitialized) return;
    authInitialized = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ user: session?.user ? toAppUser(session.user) : null, isSessionLoaded: true });
    });

    supabase.auth.onAuthStateChange((event, session) => {
      set({ user: session?.user ? toAppUser(session.user) : null, isSessionLoaded: true, authEvent: event });
    });
  },
}));
