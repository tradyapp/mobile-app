/* eslint-disable @next/next/no-img-element */
'use client';
import { Navbar } from 'konsta/react';
import { ReactNode, useState } from 'react';
import ProfileDrawer from '../modules/ProfileDrawer';

interface AppNavbarProps {
  title?: string;
  left?: ReactNode;
  titlePosition?: 'center' | 'left';
}

export default function AppNavbar({ title, left, titlePosition = 'center' }: AppNavbarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <Navbar 
        title={title}
        titleClassName={titlePosition === 'left' ? 'text-left flex-none ml-0' : ''}
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

      <ProfileDrawer 
        isOpen={isProfileOpen} 
        onOpenChange={setIsProfileOpen} 
      />
    </>
  );
}
