/* eslint-disable @next/next/no-img-element */
"use client";
import { List, ListItem, ListButton, Dialog, DialogButton } from "konsta/react";
import AppDrawer, { type DrawerScreen } from "../components/uiux/AppDrawer";
import { useDrawerNav } from "../components/uiux/drawer-nav";
import { authService } from "@/services/AuthService";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services/UserService";
import { useUserPrefsStore } from "@/stores/userPrefsStore";

// ── Shared context for profile state ──

interface ProfileData {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  uid: string;
}

interface ProfileCtxValue {
  locale: "en" | "es";
  isUpdatingLocale: boolean;
  handleLanguageChange: (nextLocale: "en" | "es") => void;
  setIsLogoutDialogOpen: (open: boolean) => void;
  profile: ProfileData;
  updateAvatar: (file: File) => Promise<void>;
}

const ProfileCtx = createContext<ProfileCtxValue>(null!);

// ── Screen: Account (root) ──

function AccountScreen() {
  const { navigateTo } = useDrawerNav();
  const { locale, isUpdatingLocale, setIsLogoutDialogOpen, profile } = useContext(ProfileCtx);

  return (
    <div>
      <List strong className="mb-6 rounded-xl overflow-hidden">
        <ListItem
          link
          onClick={() => navigateTo("profile")}
          title={
            <div className="flex flex-col">
              <span className="text-base text-zinc-200 font-medium">
                {profile.displayName || "Usuario"}
              </span>
              <span className="text-sm text-zinc-500">
                {profile.email}
              </span>
            </div>
          }
          media={
            <img
              src={profile.avatarUrl || "/img/default-user.webp"}
              alt="Profile"
              className="w-14 h-14 rounded-full object-cover"
            />
          }
        />
        <ListButton>
          <span className="text-zinc-400 w-full flex justify-between">
            <span> Subscription status: </span>
            <span className="text-brand-primary font-medium">Active</span>
          </span>
        </ListButton>
      </List>

      <List strong className="mb-6 rounded-xl overflow-hidden">
        <ListItem link title="Trading Accounts" />
        <ListItem link title="Subscriptions" />
        <ListItem
          link
          title="Language"
          after={isUpdatingLocale ? "Saving..." : locale === "es" ? "Español" : "English"}
          onClick={() => navigateTo("language")}
        />
        <ListItem link title="Contact" />
      </List>

      <List strong className="rounded-xl overflow-hidden">
        <ListButton
          className="k-color-brand-red text-rose-500"
          onClick={() => setIsLogoutDialogOpen(true)}
        >
          Sign Out
        </ListButton>
      </List>
    </div>
  );
}

// ── Screen: Profile ──

function ProfileScreen() {
  const { profile, updateAvatar } = useContext(ProfileCtx);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      await updateAvatar(file);
    } catch {
      // silent fail
    } finally {
      setUploading(false);
    }
  };

  const fields: { label: string; value: string }[] = [
    { label: "Display Name", value: profile.displayName || "—" },
    { label: "Email", value: profile.email || "—" },
  ];

  return (
    <div>
      {/* Avatar + upload */}
      <div className="flex flex-col items-center py-6">
        <div className="relative mb-3">
          {uploading ? (
            <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-zinc-600 border-t-[#00ff99] rounded-full animate-spin" />
            </div>
          ) : (
            <img
              src={profile.avatarUrl || "/img/default-user.webp"}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover"
            />
          )}
        </div>
        <h2 className="text-white text-lg font-semibold">
          {profile.displayName || "Usuario"}
        </h2>
        <p className="text-zinc-500 text-sm mb-3">{profile.email}</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 rounded-full text-sm font-medium text-black disabled:opacity-40 active:opacity-80 transition-opacity"
          style={{ background: "#00ff99" }}
        >
          {uploading ? "Subiendo..." : profile.avatarUrl ? "Cambiar foto" : "Subir foto"}
        </button>
      </div>

      {/* Profile fields */}
      <List strong className="rounded-xl overflow-hidden">
        {fields.map((f) => (
          <ListItem
            key={f.label}
            title={
              <span className="text-zinc-500 text-sm">{f.label}</span>
            }
            after={
              <span className="text-zinc-200 text-sm truncate max-w-[200px]">
                {f.value}
              </span>
            }
          />
        ))}
      </List>
    </div>
  );
}

// ── Screen: Language ──

const LANGUAGES: { code: "en" | "es"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

function LanguageScreen() {
  const { goBack } = useDrawerNav();
  const { locale, handleLanguageChange } = useContext(ProfileCtx);

  const onSelect = (code: "en" | "es") => {
    handleLanguageChange(code);
    goBack();
  };

  return (
    <List strong className="rounded-xl overflow-hidden">
      {LANGUAGES.map((lang) => (
        <ListItem
          key={lang.code}
          link
          title={lang.label}
          after={locale === lang.code ? "✓" : ""}
          onClick={() => onSelect(lang.code)}
        />
      ))}
    </List>
  );
}

// ── Screen definitions ──

const SCREENS: DrawerScreen[] = [
  { name: "account", title: "Account", component: AccountScreen, isRoot: true },
  { name: "profile", title: "Profile", component: ProfileScreen },
  { name: "language", title: "Language", component: LanguageScreen },
];

// ── Main component ──

interface ProfileDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileDrawer({
  isOpen,
  onOpenChange,
}: ProfileDrawerProps) {
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [locale, setLocale] = useState<"en" | "es">("en");
  const [isUpdatingLocale, setIsUpdatingLocale] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setStoreLocale = useUserPrefsStore((state) => state.setLocale);
  const [profile, setProfile] = useState<ProfileData>({
    displayName: "",
    email: user?.email ?? "",
    avatarUrl: null,
    locale: "es",
    timezone: "America/Bogota",
    uid: user?.uid ?? "",
  });

  useEffect(() => {
    let active = true;

    if (!isOpen || !user?.uid) return;

    const run = async () => {
      try {
        const result = await userService.getUserProfile(user.uid);
        if (!active) return;
        const nextLocale = result.userData.locale === "es" ? "es" : "en";
        setLocale(nextLocale);
        setStoreLocale(nextLocale);
        setProfile({
          displayName: (result.userData.displayName as string) ?? "",
          email: user.email ?? "",
          avatarUrl: (result.userData.avatarUrl as string) ?? null,
          locale: (result.userData.locale as string) ?? "es",
          timezone: (result.userData.timezone as string) ?? "America/Bogota",
          uid: user.uid,
        });
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [isOpen, user?.uid, user?.email, setStoreLocale]);

  const handleLanguageChange = async (nextLocale: "en" | "es") => {
    if (!user?.uid || nextLocale === locale || isUpdatingLocale) return;

    setLocale(nextLocale);
    setStoreLocale(nextLocale);
    setProfile((p) => ({ ...p, locale: nextLocale }));
    setIsUpdatingLocale(true);
    try {
      await userService.updateUserProfile(user.uid, { locale: nextLocale });
    } catch (error) {
      console.error("Error updating language:", error);
    } finally {
      setIsUpdatingLocale(false);
    }
  };

  const updateAvatar = async (file: File) => {
    if (!user?.uid) return;
    const newUrl = await userService.uploadAvatar(user.uid, file);
    setProfile((p) => ({ ...p, avatarUrl: newUrl }));
  };

  const ctxValue: ProfileCtxValue = {
    locale,
    isUpdatingLocale,
    handleLanguageChange,
    setIsLogoutDialogOpen,
    profile,
    updateAvatar,
  };

  return (
    <ProfileCtx.Provider value={ctxValue}>
      <AppDrawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Account"
        height="full"
        description="User profile, language, and account settings."
        screens={SCREENS}
      />

      {typeof window !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-9999 pointer-events-none">
            <div className="pointer-events-auto">
              <Dialog
                backdrop
                opened={isLogoutDialogOpen}
                onBackdropClick={(e) => {
                  e?.stopPropagation?.();
                  setIsLogoutDialogOpen(false);
                }}
                title="Sign Out"
                content="Are you sure you want to sign out?"
                buttons={
                  <>
                    <DialogButton
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        setIsLogoutDialogOpen(false);
                      }}
                    >
                      Cancel
                    </DialogButton>
                    <DialogButton
                      strong
                      className="text-black"
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        authService.logout();
                        setIsLogoutDialogOpen(false);
                        onOpenChange(false);
                      }}
                    >
                      Sign Out
                    </DialogButton>
                  </>
                }
              />
            </div>
          </div>,
          document.body
        )}
    </ProfileCtx.Provider>
  );
}
