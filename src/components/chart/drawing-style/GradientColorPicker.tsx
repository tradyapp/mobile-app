import { useCallback, useRef, useEffect } from "react";
import { hslToHex } from "./shared";

interface GradientColorPickerProps {
  hue: number;
  saturation: number;
  lightness: number;
  onSaturationChange: (s: number) => void;
  onLightnessChange: (l: number) => void;
}

export default function GradientColorPicker({
  hue,
  saturation,
  lightness,
  onSaturationChange,
  onLightnessChange,
}: GradientColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const drawGradient = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const s = (x / w) * 100;
        const l = 100 - (y / h) * 100;
        ctx.fillStyle = `hsl(${hue}, ${s}%, ${l}%)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [hue]);

  useEffect(() => {
    drawGradient();
  }, [drawGradient]);

  const handleInteraction = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
      const s = Math.round((x / rect.width) * 100);
      const l = Math.round(100 - (y / rect.height) * 100);
      onSaturationChange(s);
      onLightnessChange(l);
    },
    [onSaturationChange, onLightnessChange]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleInteraction(e.clientX, e.clientY);
    },
    [handleInteraction]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      handleInteraction(e.clientX, e.clientY);
    },
    [handleInteraction]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const selectorX = `${(saturation / 100) * 100}%`;
  const selectorY = `${((100 - lightness) / 100) * 100}%`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-48 rounded-lg overflow-hidden cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        width={256}
        height={192}
        className="w-full h-full"
      />
      <div
        className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{
          left: selectorX,
          top: selectorY,
          backgroundColor: hslToHex(hue, saturation, lightness),
        }}
      />
    </div>
  );
}
