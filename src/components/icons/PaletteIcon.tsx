import React from 'react'

const PaletteIcon = () => {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2 0-.51-.2-.98-.52-1.34-.3-.33-.48-.77-.48-1.24 0-.91.74-1.65 1.65-1.65H16c3.31 0 6-2.69 6-6 0-4.96-4.48-9.77-10-9.77z"
      />
      <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default PaletteIcon
