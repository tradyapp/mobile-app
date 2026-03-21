import React from "react";

const TradeIcon = () => {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Flecha abajo-izquierda */}
      <polyline points="9,14 4,19 9,19" fill="none" />
      <line x1="4" y1="19" x2="11" y2="12" />
      {/* Línea diagonal entrecortada entre las flechas */}
      <line
        x1="10"
        y1="13"
        x2="14"
        y2="11"
        strokeDasharray="1.5 1.5"
      />
      {/* Flecha arriba-derecha */}
      <polyline points="15,10 20,5 15,5" fill="none" />
      <line x1="20" y1="5" x2="13" y2="12" />
    </svg>
  );
};

export default TradeIcon;
