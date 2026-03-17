import { Preloader } from "konsta/react";
import React, { FC } from "react";
import FadeIn from "../uiux/FadeIn";

const ChartSkeleton: FC<{
    show: boolean
}> = ({
    show
}) => {
  return (
    <div 
      className={`absolute top-0 left-0 right-0 bottom-0 bg-black/30 backdrop-blur-md z-10 transition-opacity duration-300 ease-in-out select-none pointer-events-none flex items-center justify-center ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
        <FadeIn>
            <Preloader className="text-brand-primary " />
        </FadeIn>
    </div>
  );
};

export default ChartSkeleton;
