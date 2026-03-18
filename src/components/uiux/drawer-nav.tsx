'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { Drawer } from 'vaul';
import TouchableButton from './TouchableButton';

// ── Public types ──

export interface DrawerScreen {
  name: string;
  title: string | ((params?: Record<string, unknown>) => string);
  component: React.ComponentType;
  isRoot?: boolean;
}

interface NavStackEntry {
  screenName: string;
  params?: Record<string, unknown>;
}

interface DrawerNavContextValue {
  navigateTo: (screenName: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  goBackTo: (screenName: string) => void;
  close: () => void;
  currentScreen: string;
  params: Record<string, unknown>;
  isRoot: boolean;
}

// ── Context ──

const NavCtx = createContext<DrawerNavContextValue | null>(null);

export function useDrawerNav(): DrawerNavContextValue {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error('useDrawerNav must be used within AppDrawer with screens prop');
  return ctx;
}

/** Returns true when rendered inside AppDrawer's screen navigation system.
 *  Used by ScreenHeader to auto-suppress (the nav system renders its own header). */
export function useIsInsideDrawerNav(): boolean {
  return useContext(NavCtx) !== null;
}

// ── AnimatedDrawerNav — the single entry-point component for AppDrawer ──

interface AnimatedDrawerNavProps {
  screens: DrawerScreen[];
  title: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  wrapperClassName?: string;
  /** Extra children rendered alongside the nav system (e.g. dialogs) */
  children?: ReactNode;
}

export function AnimatedDrawerNav({ screens, title, isOpen, onOpenChange, wrapperClassName, children }: AnimatedDrawerNavProps) {
  const rootScreen = screens.find(s => s.isRoot) ?? screens[0];

  const [stack, setStack] = useState<NavStackEntry[]>([{ screenName: rootScreen.name }]);
  const [contentStyle, setContentStyle] = useState<React.CSSProperties>({});
  const animatingRef = useRef(false);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAnimationTimers = useCallback(() => {
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }
    if (unlockTimeoutRef.current) {
      clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }
    animatingRef.current = false;
  }, []);

  // Reset to root when drawer opens
  const prevIsOpen = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      clearAnimationTimers();
      setStack([{ screenName: rootScreen.name }]);
      setContentStyle({});
    }
    prevIsOpen.current = isOpen;
  }, [clearAnimationTimers, isOpen, rootScreen.name]);

  useEffect(() => {
    return () => {
      clearAnimationTimers();
    };
  }, [clearAnimationTimers]);

  const animate = useCallback((direction: 'forward' | 'backward', stackUpdater: (prev: NavStackEntry[]) => NavStackEntry[]) => {
    // Never drop taps: interrupt any in-flight transition and honor the latest intent.
    clearAnimationTimers();
    animatingRef.current = true;

    setContentStyle({ opacity: 0, transition: 'opacity 120ms ease-out' });
    phaseTimeoutRef.current = setTimeout(() => {
      setStack(stackUpdater);
      setContentStyle({
        opacity: 0,
        transform: direction === 'forward' ? 'translateX(40px)' : 'translateX(-40px)',
        transition: 'none',
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setContentStyle({
            opacity: 1,
            transform: 'translateX(0)',
            transition: 'opacity 180ms ease-out, transform 180ms ease-out',
          });
          unlockTimeoutRef.current = setTimeout(() => {
            animatingRef.current = false;
            unlockTimeoutRef.current = null;
          }, 180);
        });
      });
      phaseTimeoutRef.current = null;
    }, 120);
  }, [clearAnimationTimers]);

  const navigateTo = useCallback((screenName: string, params?: Record<string, unknown>) => {
    animate('forward', prev => [...prev, { screenName, params }]);
  }, [animate]);

  const goBack = useCallback(() => {
    animate('backward', prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, [animate]);

  const goBackTo = useCallback((screenName: string) => {
    animate('backward', prev => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].screenName === screenName) return prev.slice(0, i + 1);
      }
      return prev;
    });
  }, [animate]);

  const close = useCallback(() => {
    setStack([{ screenName: rootScreen.name }]);
    setContentStyle({});
    animatingRef.current = false;
    onOpenChange(false);
  }, [rootScreen.name, onOpenChange]);

  const currentEntry = stack[stack.length - 1];
  const currentScreenDef = screens.find(s => s.name === currentEntry.screenName);
  const isRootScreen = currentScreenDef?.isRoot ?? false;

  const navValue: DrawerNavContextValue = {
    navigateTo,
    goBack,
    goBackTo,
    close,
    currentScreen: currentEntry.screenName,
    params: currentEntry.params ?? {},
    isRoot: isRootScreen,
  };

  // Resolve title
  const resolvedTitle = currentScreenDef
    ? (typeof currentScreenDef.title === 'function' ? currentScreenDef.title(currentEntry.params) : currentScreenDef.title)
    : title;

  const ScreenComponent = currentScreenDef?.component;

  return (
    <NavCtx.Provider value={navValue}>
      {/* Header — managed automatically */}
      {isRootScreen ? (
        <div className="flex items-center justify-between mb-4 shrink-0">
          <Drawer.Title className="text-white mx-auto">
            <span className="ml-6">{resolvedTitle}</span>
          </Drawer.Title>
          <TouchableButton
            onClick={close}
            className="text-zinc-400 text-xl font-light w-10 h-10 flex items-center justify-center"
          >
            ✕
          </TouchableButton>
        </div>
      ) : (
        <>
          <Drawer.Title className="sr-only">{resolvedTitle}</Drawer.Title>
          <div className="flex items-center justify-between mb-6">
            <TouchableButton
              onClick={goBack}
              className="text-zinc-400 text-xl w-10 h-10 flex items-center justify-center"
            >
              ←
            </TouchableButton>
            <span className="text-white font-medium">{resolvedTitle}</span>
            <TouchableButton
              onClick={close}
              className="text-zinc-400 text-xl font-light w-10 h-10 flex items-center justify-center"
            >
              ✕
            </TouchableButton>
          </div>
        </>
      )}

      {/* Animated content */}
      <div className={wrapperClassName} style={contentStyle}>
        {ScreenComponent && <ScreenComponent />}
      </div>

      {children}
    </NavCtx.Provider>
  );
}
