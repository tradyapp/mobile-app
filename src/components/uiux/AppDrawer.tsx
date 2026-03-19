'use client'

import { ReactNode, useRef } from "react";
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
  /** Optional element rendered on the left side of the header row. */
  headerLeft?: ReactNode;
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
  headerLeft,
}: AppDrawerProps) {
  const useScreenNav = !!screens;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const pullGestureAllowedRef = useRef(false);
  const CLOSE_PULL_THRESHOLD = 52;
  const DRAG_START_THRESHOLD = 10;
  const safeAreaPaddingStyle: React.CSSProperties = {
    paddingLeft: "max(16px, env(safe-area-inset-left))",
    paddingRight: "max(16px, env(safe-area-inset-right))",
    paddingBottom: "max(16px, env(safe-area-inset-bottom))",
  };

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        'button, a, input, textarea, select, [role="button"], [data-no-drag], [data-drawer-ignore-drag]'
      )
    );
  };

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0];
    touchStartYRef.current = touch?.clientY ?? null;
    touchStartXRef.current = touch?.clientX ?? null;
    pullDistanceRef.current = 0;
    pullGestureAllowedRef.current = !isInteractiveTarget(event.target);
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!pullGestureAllowedRef.current) return;

    const startY = touchStartYRef.current;
    const startX = touchStartXRef.current;
    const container = scrollContainerRef.current;
    if (startY === null || startX === null || !container) return;

    const touch = event.touches[0];
    const currentY = touch?.clientY;
    const currentX = touch?.clientX;
    if (currentY === undefined || currentX === undefined) return;

    const deltaY = currentY - startY;
    const deltaX = currentX - startX;

    if (Math.abs(deltaY) <= DRAG_START_THRESHOLD || Math.abs(deltaY) <= Math.abs(deltaX)) {
      pullDistanceRef.current = 0;
      return;
    }

    if (container.scrollTop <= 0 && deltaY > 0) {
      pullDistanceRef.current = deltaY;
    } else {
      pullDistanceRef.current = 0;
    }
  };

  const handleTouchEnd = () => {
    const shouldClose = pullGestureAllowedRef.current && pullDistanceRef.current > CLOSE_PULL_THRESHOLD;
    touchStartYRef.current = null;
    touchStartXRef.current = null;
    pullDistanceRef.current = 0;
    pullGestureAllowedRef.current = false;
    if (shouldClose) onOpenChange(false);
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-1002" />
        <Drawer.Content
          className={`bg-black flex flex-col rounded-t-[10px] fixed bottom-0 left-0 right-0 z-1003 overflow-hidden ${heightClasses[height]}`}
        >
          {description && (
            <Drawer.Description className="sr-only">
              {description}
            </Drawer.Description>
          )}
          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 overflow-y-auto [touch-action:pan-y]"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div
              className="pt-4 bg-zinc-950 rounded-t-[10px] border-t border-zinc-800 min-h-full"
              style={safeAreaPaddingStyle}
            >
              <div className="mx-auto w-12 h-1.5 shrink-0 rounded-full bg-zinc-600 mb-6" />
              <div className="w-full pb-2">
                {useScreenNav ? (
                  <AnimatedDrawerNav
                    screens={screens}
                    title={title}
                    isOpen={isOpen}
                    onOpenChange={onOpenChange}
                    wrapperClassName={contentClassName ?? "pb-6"}
                  />
                ) : (
                  <>
                    {showHeader ? (
                      <div className="mb-4 flex items-center justify-between shrink-0">
                        <div className="h-10 w-10 shrink-0">
                          {headerLeft}
                        </div>
                        <Drawer.Title className="text-white mx-auto">
                          {title}
                        </Drawer.Title>
                        <TouchableButton
                          onClick={() => onOpenChange(false)}
                          className="text-zinc-400 text-xl font-light w-10 h-10 flex items-center justify-center shrink-0"
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
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
