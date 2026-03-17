"use client";

import { useCallback } from "react";
import AppDrawer from "../uiux/AppDrawer";
import { DrawingTool } from "@/stores/drawingStore";
import DrawingToolGrid from "./drawings-drawer/DrawingToolGrid";

export type { DrawingTool };

interface DrawingsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDrawing: DrawingTool | null;
  onDrawingSelect: (drawing: DrawingTool) => void;
}

export default function DrawingsDrawer({
  isOpen,
  onOpenChange,
  selectedDrawing,
  onDrawingSelect,
}: DrawingsDrawerProps) {
  const handleSelect = useCallback(
    (tool: DrawingTool) => {
      onDrawingSelect(tool);
      onOpenChange(false);
    },
    [onDrawingSelect, onOpenChange],
  );

  return (
    <AppDrawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Drawing Tools"
      height="auto"
      description="Choose a drawing tool for the chart."
      showHeader
    >
      <DrawingToolGrid
        selectedDrawing={selectedDrawing}
        onSelect={handleSelect}
        isActive={isOpen}
      />
    </AppDrawer>
  );
}
