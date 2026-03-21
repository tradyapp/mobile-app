import React from "react";

const TradeIcon = () => {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      stroke="currentColor"
    >
      {/* Línea diagonal entrecortada separando las dos flechas */}
      <line
        x1="4"
        y1="20"
        x2="20"
        y2="4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 2"
        fill="none"
      />
      {/* Flecha superior-izquierda apuntando arriba-izquierda */}
      <polygon points="3,3 9,3 3,9" fill="currentColor" stroke="none" />
      <line x1="3" y1="3" x2="10" y2="10" strokeWidth="2" stroke="currentColor" fill="none" />
      {/* Flecha inferior-derecha apuntando abajo-derecha (invertida) */}
      <polygon points="21,21 15,21 21,15" fill="currentColor" stroke="none" />
      <line x1="21" y1="21" x2="14" y2="14" strokeWidth="2" stroke="currentColor" fill="none" />
    </svg>
  );
};

export default TradeIcon;
