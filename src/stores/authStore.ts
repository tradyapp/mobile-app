import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AppUser {
  uid: string;
  email: string | null;
  raw: User;
}

interface AuthStore {
  user: AppUser | null;
  isSessionLoaded: boolean;
  setUser: (user: AppUser | null) => void;
  setSessionLoaded: (loaded: boolean) => void;
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

  setUser: (user) => set({ user }),

  setSessionLoaded: (loaded) => set({ isSessionLoaded: loaded }),

  initializeAuth: () => {
    if (authInitialized) return;
    authInitialized = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ user: session?.user ? toAppUser(session.user) : null, isSessionLoaded: true });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ? toAppUser(session.user) : null, isSessionLoaded: true });
    });
  },
}));
