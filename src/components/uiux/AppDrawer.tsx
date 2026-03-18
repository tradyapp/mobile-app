'use client'

import { ReactNode } from "react";
import { Drawer } from "vaul";
import TouchableButton from "./TouchableButton";
import { AnimatedDrawerNav, type DrawerScreen } from "./drawer-nav";

type DrawerHeight = 'full' | 'auto' | 'content';

interface AppDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children?: ReactNode;
  height?: DrawerHeight;
  description?: string;
  showHeader?: boolean;
  /** When provided, enables multi-screen navigation. Children are ignored. */
  screens?: DrawerScreen[];
  /** Extra className on the animated content wrapper (only used with screens) */
  contentClassName?: string;
}

export type { DrawerScreen };

const heightClasses: Record<DrawerHeight, string> = {
  full: 'h-[96%] mt-24',
  auto: 'max-h-[95vh]',
  content: '',
};

export default function AppDrawer({
  isOpen,
  onOpenChange,
  title,
  children,
  height = 'full',
  description,
  showHeader = true,
  screens,
  contentClassName,
}: AppDrawerProps) {
  const useScreenNav = !!screens;

  return (
    <Drawer.Root open={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-1002" />
        <Drawer.Content
          className={`bg-black flex flex-col rounded-t-[10px] fixed bottom-0 left-0 right-0 z-1003 ${heightClasses[height]}`}
        >
          {description && (
            <Drawer.Description className="sr-only">
              {description}
            </Drawer.Description>
          )}
          <div className="p-4 bg-zinc-950 rounded-t-[10px] flex-1 flex flex-col overflow-hidden border-t border-zinc-800">
            <div className="mx-auto w-12 h-1.5 shrink-0 rounded-full bg-zinc-600 mb-6" />
            <div className="max-w-md mx-auto w-full flex-1 flex flex-col overflow-hidden">
              {useScreenNav ? (
                <AnimatedDrawerNav
                  screens={screens}
                  title={title}
                  isOpen={isOpen}
                  onOpenChange={onOpenChange}
                  wrapperClassName={contentClassName}
                />
              ) : (
                <>
                  {showHeader ? (
                    <div className="flex items-center justify-between mb-4 shrink-0">
                      <Drawer.Title className="text-white mx-auto">
                        <span className="ml-6">{title}</span>
                      </Drawer.Title>
                      <TouchableButton
                        onClick={() => onOpenChange(false)}
                        className="text-zinc-400 text-xl font-light w-10 h-10 flex items-center justify-center"
                      >
                        ✕
                      </TouchableButton>
                    </div>
                  ) : (
                    <Drawer.Title className="sr-only">{title}</Drawer.Title>
                  )}
                  {children}
                </>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
