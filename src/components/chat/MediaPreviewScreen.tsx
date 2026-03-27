import { useState, useRef, useCallback, useEffect } from "react";

// Brand color: #00ff99
const BRAND = "#00ff99";
const BRAND_DIM = "rgba(0,255,153,0.3)";

interface MediaPreviewScreenProps {
  file: File;
  onSend: (file: File, caption: string) => void;
  onCancel: () => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ============================================================================
// Image Crop Overlay
// ============================================================================

interface CropArea { x: number; y: number; size: number }

function ImageCropOverlay({
  containerRect,
  onApply,
  onClose,
}: {
  containerRect: DOMRect;
  onApply: (crop: CropArea) => void;
  onClose: () => void;
}) {
  const initSize = Math.min(containerRect.width, containerRect.height) * 0.7;
  const [crop, setCrop] = useState<CropArea>({
    x: (containerRect.width - initSize) / 2,
    y: (containerRect.height - initSize) / 2,
    size: initSize,
  });
  const dragging = useRef<{ sx: number; sy: number; sc: CropArea } | null>(null);
  const resizing = useRef<{ sx: number; sy: number; ss: number } | null>(null);

  const onDown = (e: React.PointerEvent, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === "move") dragging.current = { sx: e.clientX, sy: e.clientY, sc: { ...crop } };
    else resizing.current = { sx: e.clientX, sy: e.clientY, ss: crop.size };
  };
  const onMove = (e: React.PointerEvent) => {
    const w = containerRect.width, h = containerRect.height;
    if (dragging.current) {
      const d = dragging.current;
      setCrop({ x: Math.max(0, Math.min(w - d.sc.size, d.sc.x + e.clientX - d.sx)), y: Math.max(0, Math.min(h - d.sc.size, d.sc.y + e.clientY - d.sy)), size: d.sc.size });
    }
    if (resizing.current) {
      const r = resizing.current;
      const ns = Math.max(60, Math.min(w, h, r.ss + Math.max(e.clientX - r.sx, e.clientY - r.sy)));
      setCrop((p) => ({ x: Math.min(p.x, w - ns), y: Math.min(p.y, h - ns), size: ns }));
    }
  };
  const onUp = () => { dragging.current = null; resizing.current = null; };

  return (
    <div className="absolute inset-0 z-10" onPointerMove={onMove} onPointerUp={onUp}>
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="cmask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={crop.x} y={crop.y} width={crop.size} height={crop.size} fill="black" rx="4" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#cmask)" />
      </svg>
      <div
        className="absolute rounded"
        style={{ left: crop.x, top: crop.y, width: crop.size, height: crop.size, border: `2px solid ${BRAND}` }}
        onPointerDown={(e) => onDown(e, "move")}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 inset-y-0 w-px" style={{ background: BRAND_DIM }} />
          <div className="absolute left-2/3 inset-y-0 w-px" style={{ background: BRAND_DIM }} />
          <div className="absolute top-1/3 inset-x-0 h-px" style={{ background: BRAND_DIM }} />
          <div className="absolute top-2/3 inset-x-0 h-px" style={{ background: BRAND_DIM }} />
        </div>
        {/* Resize handle bottom-right */}
        <div
          className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full shadow-lg cursor-nwse-resize"
          style={{ background: BRAND }}
          onPointerDown={(e) => onDown(e, "resize")}
        />
      </div>
      <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
        <button onClick={onClose} className="px-5 py-2.5 rounded-full bg-zinc-800/90 text-zinc-300 text-sm font-medium active:bg-zinc-700">
          Cancelar
        </button>
        <button onClick={() => onApply(crop)} className="px-5 py-2.5 rounded-full text-black text-sm font-semibold active:opacity-80" style={{ background: BRAND }}>
          Aplicar
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Drawing Canvas Overlay
// ============================================================================

type DrawTool = "line" | "circle" | "rect";
const DRAW_COLORS = [BRAND, "#ff4444", "#ffffff", "#fbbf24", "#3b82f6"];

function DrawOverlay({
  containerRect,
  onApply,
  onClose,
}: {
  containerRect: DOMRect;
  onApply: (canvas: HTMLCanvasElement) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<DrawTool>("rect");
  const [color, setColor] = useState(BRAND);
  const [shapes, setShapes] = useState<Array<{ tool: DrawTool; color: string; x1: number; y1: number; x2: number; y2: number }>>([]);
  const drawing = useRef<{ x1: number; y1: number } | null>(null);
  const [currentEnd, setCurrentEnd] = useState<{ x: number; y: number } | null>(null);

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);

    const drawShape = (s: { tool: DrawTool; color: string; x1: number; y1: number; x2: number; y2: number }) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      if (s.tool === "line") {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      } else if (s.tool === "rect") {
        ctx.strokeRect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1));
      } else if (s.tool === "circle") {
        const rx = Math.abs(s.x2 - s.x1) / 2;
        const ry = Math.abs(s.y2 - s.y1) / 2;
        const cx = Math.min(s.x1, s.x2) + rx;
        const cy = Math.min(s.y1, s.y2) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    shapes.forEach(drawShape);
    if (drawing.current && currentEnd) {
      drawShape({ tool, color, x1: drawing.current.x1, y1: drawing.current.y1, x2: currentEnd.x, y2: currentEnd.y });
    }
  }, [shapes, tool, color, currentEnd]);

  useEffect(() => { redraw(); }, [redraw]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = getPos(e);
    drawing.current = { x1: p.x, y1: p.y };
    setCurrentEnd(p);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    setCurrentEnd(getPos(e));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = getPos(e);
    setShapes((prev) => [...prev, { tool, color, x1: drawing.current!.x1, y1: drawing.current!.y1, x2: p.x, y2: p.y }]);
    drawing.current = null;
    setCurrentEnd(null);
  };

  const undo = () => setShapes((prev) => prev.slice(0, -1));

  const tools: { id: DrawTool; icon: string }[] = [
    { id: "line", icon: "M4 20L20 4" },
    { id: "rect", icon: "M4 6h16v12H4z" },
    { id: "circle", icon: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0" },
  ];

  return (
    <div className="absolute inset-0 z-10 flex flex-col">
      <canvas
        ref={canvasRef}
        width={containerRect.width}
        height={containerRect.height}
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* Toolbar at bottom */}
      <div className="mt-auto relative z-20 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-4 px-4 space-y-3">
        {/* Tool selector */}
        <div className="flex items-center justify-center gap-2">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: tool === t.id ? "rgba(0,255,153,0.15)" : "rgba(255,255,255,0.08)", border: tool === t.id ? `1.5px solid ${BRAND}` : "1.5px solid transparent" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={tool === t.id ? BRAND : "#aaa"} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
              </svg>
            </button>
          ))}
          {/* Undo */}
          <button onClick={undo} disabled={shapes.length === 0} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.08] disabled:opacity-30">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#aaa" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>
        </div>

        {/* Color picker */}
        <div className="flex items-center justify-center gap-2">
          {DRAW_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full transition-transform"
              style={{
                background: c,
                transform: color === c ? "scale(1.25)" : "scale(1)",
                boxShadow: color === c ? `0 0 0 2px black, 0 0 0 3.5px ${c}` : "0 0 0 1.5px rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full bg-zinc-800/90 text-zinc-300 text-sm font-medium active:bg-zinc-700">
            Cancelar
          </button>
          <button
            onClick={() => canvasRef.current && onApply(canvasRef.current)}
            className="px-5 py-2.5 rounded-full text-black text-sm font-semibold active:opacity-80"
            style={{ background: BRAND }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Video Trim Overlay
// ============================================================================

function VideoTrimOverlay({
  videoEl,
  duration,
  onApply,
  onClose,
}: {
  videoEl: HTMLVideoElement;
  duration: number;
  onApply: (start: number, end: number) => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);
  const barRef = useRef<HTMLDivElement>(null);
  const active = useRef<"start" | "end" | null>(null);

  const pctToTime = (pct: number) => Math.max(0, Math.min(duration, pct * duration));
  const timeToPct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);
  const getRelX = (e: React.PointerEvent) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const onDown = (e: React.PointerEvent, h: "start" | "end") => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    active.current = h;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!active.current) return;
    const t = pctToTime(getRelX(e));
    if (active.current === "start") { const ns = Math.min(t, end - 0.5); setStart(Math.max(0, ns)); videoEl.currentTime = Math.max(0, ns); }
    else { const ne = Math.max(t, start + 0.5); setEnd(Math.min(duration, ne)); videoEl.currentTime = Math.min(duration, ne); }
  };
  const onUp = () => { active.current = null; };
  const selPct = timeToPct(end) - timeToPct(start);

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-16 pb-6 px-4">
      <div className="flex justify-between text-xs text-zinc-400 mb-2 px-1">
        <span>{formatTime(start)}</span>
        <span className="font-medium" style={{ color: BRAND }}>{formatTime(end - start)}</span>
        <span>{formatTime(end)}</span>
      </div>
      <div ref={barRef} className="relative h-12 rounded-lg bg-zinc-800 overflow-hidden" onPointerMove={onMove} onPointerUp={onUp}>
        <div className="absolute inset-y-0" style={{ left: `${timeToPct(start)}%`, width: `${selPct}%`, background: BRAND_DIM, borderTop: `2px solid ${BRAND}`, borderBottom: `2px solid ${BRAND}` }} />
        <div className="absolute inset-y-0 left-0 bg-black/50" style={{ width: `${timeToPct(start)}%` }} />
        <div className="absolute inset-y-0 right-0 bg-black/50" style={{ width: `${100 - timeToPct(end)}%` }} />
        <div className="absolute inset-y-0 w-5 flex items-center justify-center cursor-ew-resize touch-none" style={{ left: `calc(${timeToPct(start)}% - 10px)` }} onPointerDown={(e) => onDown(e, "start")}>
          <div className="w-1 h-8 rounded-full" style={{ background: BRAND }} />
        </div>
        <div className="absolute inset-y-0 w-5 flex items-center justify-center cursor-ew-resize touch-none" style={{ left: `calc(${timeToPct(end)}% - 10px)` }} onPointerDown={(e) => onDown(e, "end")}>
          <div className="w-1 h-8 rounded-full" style={{ background: BRAND }} />
        </div>
      </div>
      <div className="flex justify-center gap-3 mt-4">
        <button onClick={onClose} className="px-5 py-2.5 rounded-full bg-zinc-800/90 text-zinc-300 text-sm font-medium active:bg-zinc-700">Cancelar</button>
        <button onClick={() => onApply(start, end)} className="px-5 py-2.5 rounded-full text-black text-sm font-semibold active:opacity-80" style={{ background: BRAND }}>Recortar</button>
      </div>
    </div>
  );
}

// ============================================================================
// Main: Media Preview Screen
// ============================================================================

type ActiveTool = "none" | "crop" | "draw" | "trim";

export default function MediaPreviewScreen({ file, onSend, onCancel }: MediaPreviewScreenProps) {
  const [caption, setCaption] = useState("");
  const [previewUrl] = useState(() => URL.createObjectURL(file));
  const [activeFile, setActiveFile] = useState(file);
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  const imgContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimming, setTrimming] = useState(false);

  const [activeTool, setActiveTool] = useState<ActiveTool>("none");
  const displayUrl = croppedUrl ?? previewUrl;

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(previewUrl);
      if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    };
  }, [previewUrl, croppedUrl]);

  // --- Image Crop ---
  const handleCropApply = useCallback((crop: CropArea) => {
    if (!imgRef.current || !imgContainerRef.current) return;
    const img = imgRef.current;
    const rect = imgContainerRef.current.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const sx = crop.x * scaleX, sy = crop.y * scaleY;
    const sSize = crop.size * Math.min(scaleX, scaleY);
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(sSize, 1600);
    canvas.height = Math.min(sSize, 1600);
    canvas.getContext("2d")!.drawImage(img, sx, sy, sSize, sSize, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const f = new File([blob], "cropped.webp", { type: "image/webp" });
      setActiveFile(f);
      if (croppedUrl) URL.revokeObjectURL(croppedUrl);
      setCroppedUrl(URL.createObjectURL(f));
      setActiveTool("none");
    }, "image/webp", 0.85);
  }, [croppedUrl]);

  // --- Drawing Apply ---
  const handleDrawApply = useCallback((drawCanvas: HTMLCanvasElement) => {
    if (!imgRef.current || !imgContainerRef.current) return;
    const img = imgRef.current;
    const rect = imgContainerRef.current.getBoundingClientRect();

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    // Draw the image
    ctx.drawImage(img, 0, 0);
    // Scale and draw annotations on top
    const sx = img.naturalWidth / rect.width;
    const sy = img.naturalHeight / rect.height;
    ctx.save();
    ctx.scale(sx, sy);
    ctx.drawImage(drawCanvas, 0, 0);
    ctx.restore();

    canvas.toBlob((blob) => {
      if (!blob) return;
      const f = new File([blob], "annotated.webp", { type: "image/webp" });
      setActiveFile(f);
      if (croppedUrl) URL.revokeObjectURL(croppedUrl);
      setCroppedUrl(URL.createObjectURL(f));
      setActiveTool("none");
    }, "image/webp", 0.85);
  }, [croppedUrl]);

  // --- Video Trim ---
  const handleTrimApply = useCallback(async (start: number, end: number) => {
    if (!videoRef.current) return;
    setTrimming(true);
    setActiveTool("none");
    try {
      const video = videoRef.current;
      video.currentTime = start;
      await new Promise<void>((r) => { video.onseeked = () => r(); });
      const stream = (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<void>((res) => { recorder.onstop = () => res(); });
      video.play();
      recorder.start();
      const check = () => { if (video.currentTime >= end || video.paused) { video.pause(); recorder.stop(); } else requestAnimationFrame(check); };
      requestAnimationFrame(check);
      await done;
      const blob = new Blob(chunks, { type: "video/webm" });
      setActiveFile(new File([blob], file.name.replace(/\.[^.]+$/, "_trimmed.webm"), { type: "video/webm" }));
    } catch { /* fallback to original */ }
    finally { setTrimming(false); }
  }, [file.name]);

  // --- Toolbar items ---
  const imageTools = [
    {
      id: "crop" as const,
      label: "Recortar",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" />
        </svg>
      ),
    },
    {
      id: "draw" as const,
      label: "Dibujar",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
        </svg>
      ),
    },
  ];

  const videoTools = [
    {
      id: "trim" as const,
      label: "Recortar",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" />
        </svg>
      ),
    },
  ];

  const currentTools = isImage ? imageTools : isVideo ? videoTools : [];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 shrink-0 border-b border-zinc-800/50" style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "3.5rem" }}>
        <button onClick={onCancel} className="w-9 h-9 flex items-center justify-center text-zinc-300 rounded-full active:bg-zinc-800">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-[15px] truncate">
            {isImage ? "Enviar imagen" : isVideo ? "Enviar video" : file.name}
          </p>
          <p className="text-zinc-500 text-[11px]">{formatSize(activeFile.size)}</p>
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        {isImage && (
          <div ref={imgContainerRef} className="relative w-full h-full flex items-center justify-center">
            <img ref={imgRef} src={displayUrl} alt="Preview" className="max-w-full max-h-full object-contain select-none" draggable={false} />
            {activeTool === "crop" && imgContainerRef.current && (
              <ImageCropOverlay containerRect={imgContainerRef.current.getBoundingClientRect()} onApply={handleCropApply} onClose={() => setActiveTool("none")} />
            )}
            {activeTool === "draw" && imgContainerRef.current && (
              <DrawOverlay containerRect={imgContainerRef.current.getBoundingClientRect()} onApply={handleDrawApply} onClose={() => setActiveTool("none")} />
            )}
          </div>
        )}

        {isVideo && (
          <div className="relative w-full h-full flex items-center justify-center">
            {trimming && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70">
                <div className="w-10 h-10 border-2 border-zinc-700 rounded-full animate-spin mb-3" style={{ borderTopColor: BRAND }} />
                <p className="text-white text-sm">Recortando video...</p>
              </div>
            )}
            <video ref={videoRef} src={previewUrl} controls playsInline onLoadedMetadata={() => setVideoDuration(videoRef.current?.duration ?? 0)} className="max-w-full max-h-full" />
            {activeTool === "trim" && videoDuration > 0 && videoRef.current && (
              <VideoTrimOverlay videoEl={videoRef.current} duration={videoDuration} onApply={handleTrimApply} onClose={() => setActiveTool("none")} />
            )}
          </div>
        )}

        {!isImage && !isVideo && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-3xl bg-zinc-900 flex items-center justify-center">
              <svg className="w-12 h-12 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-zinc-300 text-sm font-medium">{file.name}</p>
          </div>
        )}
      </div>

      {/* ── Bottom toolbar + caption ── */}
      {activeTool === "none" && (
        <div className="shrink-0 bg-zinc-950 border-t border-zinc-800/50" style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}>
          {/* Tools row */}
          {currentTools.length > 0 && (
            <div className="flex items-center justify-center gap-6 py-3 border-b border-zinc-800/30">
              {currentTools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  className="flex flex-col items-center gap-1 text-zinc-400 active:text-white transition-colors"
                >
                  {t.icon}
                  <span className="text-[10px]">{t.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Caption + send */}
          <div className="flex items-center gap-3 px-4 pt-3">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Agregar comentario..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none"
              style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSend(activeFile, caption.trim()); } }}
            />
            <button
              onClick={() => onSend(activeFile, caption.trim())}
              disabled={trimming}
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:opacity-80 disabled:opacity-40 transition-colors"
              style={{ background: BRAND }}
            >
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
