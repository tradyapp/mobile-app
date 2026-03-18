/* eslint-disable @next/next/no-img-element */
"use client";
import { List, ListItem, ListButton, Dialog, DialogButton } from "konsta/react";
import AppDrawer from "../components/uiux/AppDrawer";
import { authService } from "@/services/AuthService";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services/UserService";

interface ProfileDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileDrawer({
  isOpen,
  onOpenChange,
}: ProfileDrawerProps) {
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLanguageDialogOpen, setIsLanguageDialogOpen] = useState(false);
  const [locale, setLocale] = useState<"en" | "es">("en");
  const [isUpdatingLocale, setIsUpdatingLocale] = useState(false);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    let active = true;

    if (!isOpen || !user?.uid) return;

    const run = async () => {
      try {
        const profile = await userService.getUserProfile(user.uid);
        if (!active) return;
        const nextLocale = profile.userData.locale === "es" ? "es" : "en";
        setLocale(nextLocale);
      } catch (error) {
        console.error("Error loading language:", error);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [isOpen, user?.uid]);

  const handleLanguageChange = async (nextLocale: "en" | "es") => {
    if (!user?.uid || nextLocale === locale || isUpdatingLocale) {
      setIsLanguageDialogOpen(false);
      return;
    }

    setLocale(nextLocale);
    setIsUpdatingLocale(true);
    try {
      await userService.updateUserProfile(user.uid, { locale: nextLocale });
    } catch (error) {
      console.error("Error updating language:", error);
    } finally {
      setIsUpdatingLocale(false);
      setIsLanguageDialogOpen(false);
    }
  };

  return (
    <>
      <AppDrawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Account"
        height="full"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Profile Section */}
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
                <span className=""> Subscription status: </span>
                <span className="text-brand-primary font-medium">
                  Active
                </span>
              </span>
            </ListButton>
          </List>

          {/* Menu Options */}
          <List strong className="mb-6 rounded-xl overflow-hidden">
            <ListItem link title="Trading Accounts" />
            <ListItem link title="Subscriptions" />
            <ListItem
              link
              title="Language"
              after={isUpdatingLocale ? "Saving..." : locale === "es" ? "Español" : "English"}
              onClick={() => setIsLanguageDialogOpen(true)}
            />
            <ListItem link title="Contact" />
          </List>

          {/* Sign Out */}
          <List strong className="rounded-xl overflow-hidden">
            <ListButton
              className="k-color-brand-red text-rose-500"
              onClick={() => {
                setIsLogoutDialogOpen(true);
              }}
            >
              Sign Out
            </ListButton>
          </List>
        </div>
      </AppDrawer>

      {/* Logout Confirmation Dialog */}
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

              <Dialog
                backdrop
                opened={isLanguageDialogOpen}
                onBackdropClick={(e) => {
                  e?.stopPropagation?.();
                  setIsLanguageDialogOpen(false);
                }}
                title="Language"
                content="Choose your app language"
                buttons={
                  <>
                    <DialogButton
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        void handleLanguageChange("en");
                      }}
                    >
                      English {locale === "en" ? "✓" : ""}
                    </DialogButton>
                    <DialogButton
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        void handleLanguageChange("es");
                      }}
                    >
                      Español {locale === "es" ? "✓" : ""}
                    </DialogButton>
                    <DialogButton
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        setIsLanguageDialogOpen(false);
                      }}
                    >
                      Cancel
                    </DialogButton>
                  </>
                }
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
