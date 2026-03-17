"use client";

import { useEffect, useCallback } from "react";
import LineIcon from "../../icons/drawings/LineIcon";
import HorizontalLineIcon from "../../icons/drawings/HorizontalLineIcon";
import VerticalLineIcon from "../../icons/drawings/VerticalLineIcon";
import RectangleIcon from "../../icons/drawings/RectangleIcon";
import EllipseIcon from "../../icons/drawings/EllipseIcon";
import TriangleIcon from "../../icons/drawings/TriangleIcon";
import InvertedTriangleIcon from "../../icons/drawings/InvertedTriangleIcon";
import PolygonIcon from "../../icons/drawings/PolygonIcon";
import FreehandIcon from "../../icons/drawings/FreehandIcon";
import TextIcon from "../../icons/drawings/TextIcon";
import { type DrawingTool } from "@/stores/drawingStore";

const categories: {
  label: string;
  tools: { value: DrawingTool; label: string; icon: React.ReactNode }[];
}[] = [
  {
    label: "Lines",
    tools: [
      { value: "line", label: "Line", icon: <LineIcon /> },
      {
        value: "horizontal_line",
        label: "Hor. Line",
        icon: <HorizontalLineIcon />,
      },
      {
        value: "vertical_line",
        label: "Ver. Line",
        icon: <VerticalLineIcon />,
      },
    ],
  },
  {
    label: "Shapes",
    tools: [
      { value: "rectangle", label: "Rectangle", icon: <RectangleIcon /> },
      { value: "ellipse", label: "Ellipse", icon: <EllipseIcon /> },
      { value: "triangle", label: "Triangle", icon: <TriangleIcon /> },
      {
        value: "inverted_triangle",
        label: "Inv. Triangle",
        icon: <InvertedTriangleIcon />,
      },
    ],
  },
  {
    label: "Hand Drawing",
    tools: [
      { value: "freehand", label: "Freehand", icon: <FreehandIcon /> },
      { value: "polygon", label: "Polygon", icon: <PolygonIcon /> },
    ],
  },
  {
    label: "Text",
    tools: [{ value: "text", label: "Text", icon: <TextIcon /> }],
  },
];

// Key binding rows: groups of 4 keys each
const KEY_ROWS = [
  ["1", "2", "3", "4"],
  ["q", "w", "e", "r"],
  ["a", "s", "d", "f"],
  ["z", "x", "c", "v"],
  ["5", "6", "7", "8"],
  ["t", "y", "u", "i"],
];

// Flatten tools and build key→tool mapping
const allTools = categories.flatMap((c) => c.tools);
const allKeys = KEY_ROWS.flat();

const keyToTool = new Map<string, DrawingTool>();
const toolToKey = new Map<DrawingTool, string>();
allTools.forEach((tool, i) => {
  if (i < allKeys.length) {
    keyToTool.set(allKeys[i], tool.value);
    toolToKey.set(tool.value, allKeys[i]);
  }
});

interface DrawingToolGridProps {
  selectedDrawing: DrawingTool | null;
  onSelect: (tool: DrawingTool) => void;
  isActive: boolean;
}

export default function DrawingToolGrid({
  selectedDrawing,
  onSelect,
  isActive,
}: DrawingToolGridProps) {
  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const tool = keyToTool.get(key);
      if (tool) {
        e.preventDefault();
        onSelect(tool);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isActive, onSelect]);

  return (
    <div className="flex-1 overflow-y-auto max-h-[80vh] space-y-5 pb-6">
      {categories.map((category) => (
        <div key={category.label}>
          <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
            {category.label}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {category.tools.map((tool) => {
              const key = toolToKey.get(tool.value);
              return (
                <button
                  key={tool.value}
                  onClick={() => onSelect(tool.value)}
                  className={`relative flex flex-col items-center gap-2 py-3 rounded-lg transition-colors ${
                    selectedDrawing === tool.value
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {key && (
                    <span className="absolute top-1 right-1.5 text-[9px] text-zinc-500 font-mono uppercase">
                      {key}
                    </span>
                  )}
                  {tool.icon}
                  <span className="text-[11px]">{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
