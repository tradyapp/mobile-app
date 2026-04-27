import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserPrefsStore {
  locale: "en" | "es" | "pt";
  setLocale: (locale: "en" | "es" | "pt") => void;
}

export const useUserPrefsStore = create<UserPrefsStore>()(
  persist(
    (set) => ({
      locale: "es",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "user-prefs-store-v1",
      partialize: (state) => ({
        locale: state.locale,
      }),
    }
  )
);
