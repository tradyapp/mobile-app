interface GroupAvatarIconProps {
  className?: string;
}

export default function GroupAvatarIcon({ className = "w-7 h-7 text-zinc-500" }: GroupAvatarIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      {/* Center person */}
      <circle cx="12" cy="8" r="3.2" />
      <path d="M12 12.5c-3.5 0-6.5 1.75-6.5 4v1.5h13v-1.5c0-2.25-3-4-6.5-4z" />
      {/* Left person (behind) */}
      <circle cx="6.5" cy="8.5" r="2.2" opacity="0.6" />
      <path d="M6.5 11.8c-2.4 0-4.5 1.2-4.5 2.8v1h3.5c.2-1.3 1.1-2.5 2.4-3.3a6.3 6.3 0 00-1.4-.5z" opacity="0.6" />
      {/* Right person (behind) */}
      <circle cx="17.5" cy="8.5" r="2.2" opacity="0.6" />
      <path d="M17.5 11.8c2.4 0 4.5 1.2 4.5 2.8v1h-3.5c-.2-1.3-1.1-2.5-2.4-3.3.5-.2.9-.4 1.4-.5z" opacity="0.6" />
    </svg>
  );
}
