/* eslint-disable @next/next/no-img-element */
'use client';
import { Navbar } from 'konsta/react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import ProfileDrawer from '../modules/ProfileDrawer';
import { useAuthStore } from '@/stores/authStore';
import { useAvatarStore } from '@/stores/avatarStore';
import { userService } from '@/services/UserService';

interface AppNavbarProps {
  title?: string;
  left?: ReactNode;
  right?: ReactNode | null;
  titlePosition?: 'center' | 'left';
}

function FloatingTitle({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const check = () => {
      const container = containerRef.current;
      const span = textRef.current;
      if (!container || !span) return;
      const isOverflowing = span.scrollWidth > container.clientWidth;
      setOverflows(isOverflowing);
      if (isOverflowing) {
        container.style.setProperty('--marquee-container-width', `${container.clientWidth}px`);
      }
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text]);

  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none flex items-center justify-center pt-[max(16px,env(safe-area-inset-top))] h-[calc(max(16px,env(safe-area-inset-top))_+_44px)]">
      <div
        ref={containerRef}
        className="relative overflow-hidden mx-16"
      >
        {overflows && (
          <>
            <div className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-r from-zinc-950 to-transparent" />
            <div className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-l from-zinc-950 to-transparent" />
          </>
        )}
        <span
          ref={textRef}
          className={`inline-block whitespace-nowrap font-semibold text-[17px] text-white ${overflows ? 'animate-marquee' : ''}`}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

export default function AppNavbar({ title, left, right }: AppNavbarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const wasProfileOpenRef = useRef(false);
  const user = useAuthStore((s) => s.user);
  const avatarUrl = useAvatarStore((s) => s.avatarUrl);
  const avatarUpdatedAt = useAvatarStore((s) => s.avatarUpdatedAt);
  const storeUid = useAvatarStore((s) => s.uid);
  const hasHydrated = useAvatarStore((s) => s.hasHydrated);
  const hasValidated = useAvatarStore((s) => s.hasValidated);
  const hydrateFromCache = useAvatarStore((s) => s.hydrateFromCache);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  const markValidated = useAvatarStore((s) => s.markValidated);
  const resetAvatar = useAvatarStore((s) => s.reset);

  useEffect(() => {
    if (!user?.uid) {
      resetAvatar();
      return;
    }
    if (storeUid === user.uid && hasHydrated) return;
    hydrateFromCache(user.uid);
  }, [hasHydrated, hydrateFromCache, resetAvatar, storeUid, user?.uid]);

  useEffect(() => {
    const didJustClose = wasProfileOpenRef.current && !isProfileOpen;
    wasProfileOpenRef.current = isProfileOpen;

    if (!user?.uid || !hasHydrated) return;
    if (!didJustClose && hasValidated) return;

    let cancelled = false;
    userService.getAvatarMeta(user.uid).then((meta) => {
      if (cancelled) return;
      const nextUrl = meta.avatarThumbUrl || meta.avatarUrl;
      if (meta.avatarUpdatedAt !== avatarUpdatedAt || nextUrl !== avatarUrl) {
        setAvatar({
          uid: user.uid,
          avatarUrl: nextUrl,
          avatarUpdatedAt: meta.avatarUpdatedAt,
        });
        return;
      }
      markValidated();
    }).catch(() => {
      if (!cancelled) markValidated();
    });

    return () => {
      cancelled = true;
    };
  }, [
    avatarUpdatedAt,
    avatarUrl,
    hasHydrated,
    hasValidated,
    isProfileOpen,
    markValidated,
    setAvatar,
    user?.uid,
  ]);

  const resolvedRight = right === undefined
    ? (
      <button onClick={() => setIsProfileOpen(true)}>
        <img
          src={avatarUrl || "/img/default-user.webp"}
          alt="User"
          className="w-10 h-10 rounded-full object-cover"
        />
      </button>
    )
    : right;

  return (
    <>
      <Navbar
        left={left}
        right={resolvedRight}
      />

      {title && <FloatingTitle text={title} />}

      {right === undefined && (
        <ProfileDrawer
          isOpen={isProfileOpen}
          onOpenChange={setIsProfileOpen}
        />
      )}
    </>
  );
}
