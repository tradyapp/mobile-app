/* eslint-disable @next/next/no-img-element */
'use client';
import { Navbar } from 'konsta/react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import ProfileDrawer from '../modules/ProfileDrawer';

interface AppNavbarProps {
  title?: string;
  left?: ReactNode;
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

export default function AppNavbar({ title, left }: AppNavbarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <Navbar
        left={left}
        right={
          <button onClick={() => setIsProfileOpen(true)}>
            <img
              src="/img/default-user.jpg"
              alt="User"
              className="w-10 h-10 rounded-full"
            />
          </button>
        }
      />

      {title && <FloatingTitle text={title} />}

      <ProfileDrawer
        isOpen={isProfileOpen}
        onOpenChange={setIsProfileOpen}
      />
    </>
  );
}
