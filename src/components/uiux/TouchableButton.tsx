'use client';
import { ReactNode, ButtonHTMLAttributes } from 'react';

interface TouchableButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export default function TouchableButton({ 
  children, 
  className = '', 
  ...props 
}: TouchableButtonProps) {
  return (
    <button
      className={`relative overflow-hidden rounded-full ${className}`}
      style={{
        backgroundColor: 'color-mix(in srgb, rgb(187, 187, 188) 12%, transparent)',
        backdropFilter: 'blur(8px) saturate(150%)',
        WebkitBackdropFilter: 'blur(8px) saturate(150%)',
        boxShadow: `
          inset 0 0 0 1px rgba(255, 255, 255, 0.05),
          inset 1.8px 3px 0px -2px rgba(255, 255, 255, 0.3),
          inset -2px -2px 0px -2px rgba(255, 255, 255, 0.25),
          inset -3px -8px 1px -6px rgba(255, 255, 255, 0.2),
          inset -0.3px -1px 4px 0px rgba(0, 0, 0, 0.12),
          inset -1.5px 2.5px 0px -2px rgba(0, 0, 0, 0.2),
          inset 0px 3px 4px -2px rgba(0, 0, 0, 0.2),
          inset 2px -6.5px 1px -4px rgba(0, 0, 0, 0.1),
          0px 1px 5px 0px rgba(0, 0, 0, 0.1),
          0px 6px 16px 0px rgba(0, 0, 0, 0.08)
        `,
        transition: 'all 0.1s cubic-bezier(1, 0, 0.4, 1)',
        cursor: 'pointer',
      }}
      onPointerDown={(e) => {
        const target = e.currentTarget as HTMLButtonElement;
        target.style.transform = 'scale(0.96)';
        target.style.backgroundColor = 'color-mix(in srgb, rgb(187, 187, 188) 20%, transparent)';
      }}
      onPointerUp={(e) => {
        const target = e.currentTarget as HTMLButtonElement;
        target.style.transform = '';
        target.style.backgroundColor = 'color-mix(in srgb, rgb(187, 187, 188) 12%, transparent)';
      }}
      onPointerLeave={(e) => {
        const target = e.currentTarget as HTMLButtonElement;
        target.style.transform = '';
        target.style.backgroundColor = 'color-mix(in srgb, rgb(187, 187, 188) 12%, transparent)';
      }}
      {...props}
    >
      {children}
    </button>
  );
}