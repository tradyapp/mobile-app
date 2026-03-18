/* eslint-disable @next/next/no-img-element */
"use client";
import { List, ListItem, ListButton, Dialog, DialogButton } from "konsta/react";
import AppDrawer, { type DrawerScreen } from "../components/uiux/AppDrawer";
import { useDrawerNav } from "../components/uiux/drawer-nav";
import { authService } from "@/services/AuthService";
import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services/UserService";
import { useUserPrefsStore } from "@/stores/userPrefsStore";

// ── Shared context for profile state ──

interface ProfileCtxValue {
  locale: "en" | "es";
  isUpdatingLocale: boolean;
  handleLanguageChange: (nextLocale: "en" | "es") => void;
  setIsLogoutDialogOpen: (open: boolean) => void;
}

const ProfileCtx = createContext<ProfileCtxValue>(null!);

// ── Screen: Account (root) ──

function AccountScreen() {
  const { navigateTo } = useDrawerNav();
  const { locale, isUpdatingLocale, setIsLogoutDialogOpen } = useContext(ProfileCtx);

  return (
    <div>
      <List strong className="mb-6 rounded-xl overflow-hidden">
        <ListItem
          link
          title={
            <div className="flex flex-col">
              <span className="text-base text-zinc-200 font-medium">
                John Doe
              </span>
              <span className="text-sm text-zinc-500">
                john.doe@email.com
              </span>
            </div>
          }
          media={
            <img
              src="/img/default-user.jpg"
              alt="Profile"
              className="w-14 h-14 rounded-full"
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

  useEffect(() => {
    let active = true;

    if (!isOpen || !user?.uid) return;

    const run = async () => {
      try {
        const profile = await userService.getUserProfile(user.uid);
        if (!active) return;
        const nextLocale = profile.userData.locale === "es" ? "es" : "en";
        setLocale(nextLocale);
        setStoreLocale(nextLocale);
      } catch (error) {
        console.error("Error loading language:", error);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [isOpen, user?.uid, setStoreLocale]);

  const handleLanguageChange = async (nextLocale: "en" | "es") => {
    if (!user?.uid || nextLocale === locale || isUpdatingLocale) return;

    setLocale(nextLocale);
    setStoreLocale(nextLocale);
    setIsUpdatingLocale(true);
    try {
      await userService.updateUserProfile(user.uid, { locale: nextLocale });
    } catch (error) {
      console.error("Error updating language:", error);
    } finally {
      setIsUpdatingLocale(false);
    }
  };

  const ctxValue: ProfileCtxValue = {
    locale,
    isUpdatingLocale,
    handleLanguageChange,
    setIsLogoutDialogOpen,
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
