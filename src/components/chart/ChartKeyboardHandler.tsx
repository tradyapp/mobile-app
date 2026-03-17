import React, { FC, useEffect } from "react";

const ChartKeyboardHandler: FC<{
  showSymbolDrawer: (initialLetter?: string) => void;
  showIntervalDrawer: () => void;
  hideIntervalDrawer: () => void;
  handleIntervalSelect: (interval: string) => void;
  isIntervalDrawerOpen?: boolean;
  isSymbolDrawerOpen?: boolean;
  isAnyDrawerOpen?: boolean;
}> = ({
  showSymbolDrawer,
  showIntervalDrawer,
  hideIntervalDrawer,
  handleIntervalSelect,
  isSymbolDrawerOpen,
  isIntervalDrawerOpen,
  isAnyDrawerOpen,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return; // Do nothing if the event was already processed
      }

      // on any letter key press, show symbol drawer (only when no drawer is open)
    if (
      event.key.length === 1 &&
      event.key.match(/[a-zA-Z]/) &&
      !isAnyDrawerOpen &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      showSymbolDrawer(event.key);
      event.preventDefault();
    }

      // on 1/2/3/4 key press, change timeframe based on ctrl/cmd key
      if (event.key === "1" && !isSymbolDrawerOpen) {
        if (event.ctrlKey || event.metaKey) {
          handleIntervalSelect("1m");
        } else {
          handleIntervalSelect("1H");
        }
        event.preventDefault();
      }
      if (event.key === "2" && !isSymbolDrawerOpen) {
        if (event.ctrlKey || event.metaKey) {
          handleIntervalSelect("5m");
        } else {
          handleIntervalSelect("1D");
        }
        event.preventDefault();
      }
      if (event.key === "3" && !isSymbolDrawerOpen) {
        if (event.ctrlKey || event.metaKey) {
          handleIntervalSelect("15m");
        } else {
          handleIntervalSelect("1W");
        }
        event.preventDefault();
      }
      if (event.key === "4" && !isSymbolDrawerOpen) {
        if (event.ctrlKey || event.metaKey) {
          handleIntervalSelect("30m");
        } else {
          handleIntervalSelect("1M");
        }
        event.preventDefault();
      }

      // on 0 key press, show interval drawer
      if (event.key === "0" && !isSymbolDrawerOpen) {
        if (isIntervalDrawerOpen) {
          hideIntervalDrawer();
        } else {
          showIntervalDrawer();
        }
        showIntervalDrawer();
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    showSymbolDrawer,
    showIntervalDrawer,
    handleIntervalSelect,
    isSymbolDrawerOpen,
    isIntervalDrawerOpen,
    isAnyDrawerOpen,
    hideIntervalDrawer,
  ]);

  return <></>;
};

export default ChartKeyboardHandler;
