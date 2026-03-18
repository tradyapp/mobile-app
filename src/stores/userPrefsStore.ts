import { create } from "zustand";

interface UserPrefsStore {
  locale: "en" | "es" | "pt";
  setLocale: (locale: "en" | "es" | "pt") => void;
}

export const useUserPrefsStore = create<UserPrefsStore>((set) => ({
  locale: "es",
  setLocale: (locale) => set({ locale }),
}));
