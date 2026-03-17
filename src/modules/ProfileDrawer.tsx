/* eslint-disable @next/next/no-img-element */
"use client";
import { List, ListItem, ListButton, Dialog, DialogButton } from "konsta/react";
import AppDrawer from "../components/uiux/AppDrawer";
import { authService } from "@/services/AuthService";
import { useState } from "react";
import { createPortal } from "react-dom";

interface ProfileDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileDrawer({
  isOpen,
  onOpenChange,
}: ProfileDrawerProps) {
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
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
            <ListItem link title="Language" />
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
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
