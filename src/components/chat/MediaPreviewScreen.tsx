import { useState, useRef, useCallback, useEffect } from "react";

interface MediaPreviewScreenProps {
  file: File;
  onSend: (file: File, caption: string) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Image Crop overlay (activated by user)
// ---------------------------------------------------------------------------

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

  const onPointerDown = (e: React.PointerEvent, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === "move") dragging.current = { sx: e.clientX, sy: e.clientY, sc: { ...crop } };
    else resizing.current = { sx: e.clientX, sy: e.clientY, ss: crop.size };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const w = containerRect.width;
    const h = containerRect.height;
    if (dragging.current) {
      const d = dragging.current;
      setCrop({
        x: Math.max(0, Math.min(w - d.sc.size, d.sc.x + e.clientX - d.sx)),
        y: Math.max(0, Math.min(h - d.sc.size, d.sc.y + e.clientY - d.sy)),
        size: d.sc.size,
      });
    }
    if (resizing.current) {
      const r = resizing.current;
      const delta = Math.max(e.clientX - r.sx, e.clientY - r.sy);
      const ns = Math.max(60, Math.min(w, h, r.ss + delta));
      setCrop((p) => ({
        x: Math.min(p.x, w - ns),
        y: Math.min(p.y, h - ns),
        size: ns,
      }));
    }
  };

  const onPointerUp = () => { dragging.current = null; resizing.current = null; };

  return (
    <div
      className="absolute inset-0 z-10"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Dark mask with cut-out */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="crop-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={crop.x} y={crop.y} width={crop.size} height={crop.size} fill="black" rx="4" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#crop-mask)" />
      </svg>

      {/* Crop frame */}
      <div
        className="absolute border-2 border-white rounded"
        style={{ left: crop.x, top: crop.y, width: crop.size, height: crop.size }}
        onPointerDown={(e) => onPointerDown(e, "move")}
      >
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 inset-y-0 w-px bg-white/25" />
          <div className="absolute left-2/3 inset-y-0 w-px bg-white/25" />
          <div className="absolute top-1/3 inset-x-0 h-px bg-white/25" />
          <div className="absolute top-2/3 inset-x-0 h-px bg-white/25" />
        </div>
        {/* Corner handles */}
        {[
          "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl",
          "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr",
          "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl",
          "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br",
        ].map((cls, i) => (
          <div
            key={i}
            className={`absolute w-5 h-5 border-white ${cls} ${i === 3 ? "cursor-nwse-resize" : "pointer-events-none"}`}
            onPointerDown={i === 3 ? (e) => onPointerDown(e, "resize") : undefined}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-full bg-zinc-800 text-zinc-300 text-sm font-medium active:bg-zinc-700"
        >
          Cancelar
        </button>
        <button
          onClick={() => onApply(crop)}
          className="px-5 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium active:bg-emerald-700"
        >
          Aplicar recorte
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video Trimmer overlay (activated by user)
// ---------------------------------------------------------------------------

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

  const getRelX = (e: React.PointerEvent | PointerEvent) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: React.PointerEvent, handle: "start" | "end") => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    active.current = handle;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active.current) return;
    const t = pctToTime(getRelX(e));
    if (active.current === "start") {
      const ns = Math.min(t, end - 0.5);
      setStart(Math.max(0, ns));
      videoEl.currentTime = Math.max(0, ns);
    } else {
      const ne = Math.max(t, start + 0.5);
      setEnd(Math.min(duration, ne));
      videoEl.currentTime = Math.min(duration, ne);
    }
  };

  const onPointerUp = () => { active.current = null; };

  const selectedPct = timeToPct(end) - timeToPct(start);

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-16 pb-6 px-4">
      {/* Time labels */}
      <div className="flex justify-between text-xs text-zinc-400 mb-2 px-1">
        <span>{formatTime(start)}</span>
        <span className="text-emerald-400 font-medium">{formatTime(end - start)}</span>
        <span>{formatTime(end)}</span>
      </div>

      {/* Timeline bar */}
      <div
        ref={barRef}
        className="relative h-12 rounded-lg bg-zinc-800 overflow-hidden"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Selected range */}
        <div
          className="absolute inset-y-0 bg-emerald-600/30 border-y-2 border-emerald-500"
          style={{ left: `${timeToPct(start)}%`, width: `${selectedPct}%` }}
        />

        {/* Unselected left */}
        <div
          className="absolute inset-y-0 left-0 bg-black/50"
          style={{ width: `${timeToPct(start)}%` }}
        />

        {/* Unselected right */}
        <div
          className="absolute inset-y-0 right-0 bg-black/50"
          style={{ width: `${100 - timeToPct(end)}%` }}
        />

        {/* Start handle */}
        <div
          className="absolute inset-y-0 w-5 flex items-center justify-center cursor-ew-resize touch-none"
          style={{ left: `calc(${timeToPct(start)}% - 10px)` }}
          onPointerDown={(e) => onPointerDown(e, "start")}
        >
          <div className="w-1 h-8 bg-emerald-400 rounded-full" />
        </div>

        {/* End handle */}
        <div
          className="absolute inset-y-0 w-5 flex items-center justify-center cursor-ew-resize touch-none"
          style={{ left: `calc(${timeToPct(end)}% - 10px)` }}
          onPointerDown={(e) => onPointerDown(e, "end")}
        >
          <div className="w-1 h-8 bg-emerald-400 rounded-full" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-3 mt-4">
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-full bg-zinc-800 text-zinc-300 text-sm font-medium active:bg-zinc-700"
        >
          Cancelar
        </button>
        <button
          onClick={() => onApply(start, end)}
          className="px-5 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium active:bg-emerald-700"
        >
          Recortar video
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: Media Preview Screen
// ---------------------------------------------------------------------------

export default function MediaPreviewScreen({ file, onSend, onCancel }: MediaPreviewScreenProps) {
  const [caption, setCaption] = useState("");
  const [previewUrl] = useState(() => URL.createObjectURL(file));
  const [activeFile, setActiveFile] = useState(file);
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  // Image state
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);

  // Video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showTrim, setShowTrim] = useState(false);
  const [trimming, setTrimming] = useState(false);

  const displayUrl = croppedUrl ?? previewUrl;

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(previewUrl);
      if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    };
  }, [previewUrl, croppedUrl]);

  // Apply image crop
  const handleCropApply = useCallback((crop: CropArea) => {
    if (!imgRef.current || !imgContainerRef.current) return;
    const img = imgRef.current;
    const rect = imgContainerRef.current.getBoundingClientRect();

    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const sx = crop.x * scaleX;
    const sy = crop.y * scaleY;
    const sSize = crop.size * Math.min(scaleX, scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(sSize, 1600);
    canvas.height = Math.min(sSize, 1600);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const cropped = new File([blob], "cropped.webp", { type: "image/webp" });
        setActiveFile(cropped);
        if (croppedUrl) URL.revokeObjectURL(croppedUrl);
        setCroppedUrl(URL.createObjectURL(cropped));
        setShowCrop(false);
      },
      "image/webp",
      0.85,
    );
  }, [croppedUrl]);

  // Apply video trim using MediaRecorder
  const handleTrimApply = useCallback(async (start: number, end: number) => {
    if (!videoRef.current) return;
    setTrimming(true);
    setShowTrim(false);

    try {
      const video = videoRef.current;
      video.currentTime = start;
      await new Promise<void>((r) => { video.onseeked = () => r(); });

      const stream = (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

      video.play();
      recorder.start();

      // Stop when reaching end time
      const checkEnd = () => {
        if (video.currentTime >= end || video.paused) {
          video.pause();
          recorder.stop();
        } else {
          requestAnimationFrame(checkEnd);
        }
      };
      requestAnimationFrame(checkEnd);

      await done;

      const blob = new Blob(chunks, { type: "video/webm" });
      const trimmedFile = new File([blob], file.name.replace(/\.[^.]+$/, "_trimmed.webm"), { type: "video/webm" });
      setActiveFile(trimmedFile);
    } catch {
      // If trimming fails, just use original
    } finally {
      setTrimming(false);
    }
  }, [file.name]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0 bg-black/80 backdrop-blur-sm"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "3.5rem" }}
      >
        <button onClick={onCancel} className="w-9 h-9 flex items-center justify-center text-white rounded-full active:bg-white/10">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-[15px] truncate">
            {isImage ? "Enviar imagen" : isVideo ? "Enviar video" : file.name}
          </p>
          <p className="text-zinc-500 text-[11px]">{formatSize(activeFile.size)}</p>
        </div>

        {/* Tool buttons */}
        <div className="flex items-center gap-1">
          {isImage && (
            <button
              onClick={() => setShowCrop(true)}
              className="w-9 h-9 flex items-center justify-center text-white rounded-full active:bg-white/10"
              title="Recortar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5M20.25 16.5V18A2.25 2.25 0 0118 20.25h-1.5M3.75 16.5V18A2.25 2.25 0 006 20.25h1.5" />
              </svg>
            </button>
          )}
          {isVideo && !trimming && (
            <button
              onClick={() => setShowTrim(true)}
              className="w-9 h-9 flex items-center justify-center text-white rounded-full active:bg-white/10"
              title="Recortar video"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isImage && (
          <div ref={imgContainerRef} className="relative w-full h-full flex items-center justify-center">
            <img
              ref={imgRef}
              src={displayUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
            {showCrop && imgContainerRef.current && (
              <ImageCropOverlay
                containerRect={imgContainerRef.current.getBoundingClientRect()}
                onApply={handleCropApply}
                onClose={() => setShowCrop(false)}
              />
            )}
          </div>
        )}

        {isVideo && (
          <div className="relative w-full h-full flex items-center justify-center">
            {trimming && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70">
                <div className="w-10 h-10 border-2 border-white/30 border-t-emerald-400 rounded-full animate-spin mb-3" />
                <p className="text-white text-sm">Recortando video...</p>
              </div>
            )}
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              playsInline
              onLoadedMetadata={() => setVideoDuration(videoRef.current?.duration ?? 0)}
              className="max-w-full max-h-full"
            />
            {showTrim && videoDuration > 0 && videoRef.current && (
              <VideoTrimOverlay
                videoEl={videoRef.current}
                duration={videoDuration}
                onApply={handleTrimApply}
                onClose={() => setShowTrim(false)}
              />
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

      {/* Bottom: Caption + Send */}
      {!showCrop && !showTrim && (
        <div
          className="shrink-0 bg-black/80 backdrop-blur-sm px-4 py-3"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
        >
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Agregar comentario..."
              className="flex-1 bg-zinc-900/80 border border-zinc-700/50 rounded-full px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-600/50"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSend(activeFile, caption.trim());
                }
              }}
            />
            <button
              onClick={() => onSend(activeFile, caption.trim())}
              disabled={trimming}
              className="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 active:bg-emerald-700 disabled:opacity-40 transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
