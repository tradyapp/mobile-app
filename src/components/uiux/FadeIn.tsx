import React, { FC, useEffect } from "react";

const FadeIn: FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element) {
      setTimeout(() => {
        element.style.opacity = '1';
      }, 200);
    }
  }, [ref]);

  return (
    <div
      ref={ref}
      className="transition-opacity duration-500 ease-in-out"
      style={{
        opacity: 0,
      }}
    >
      {children}
    </div>
  );
};

export default FadeIn;
