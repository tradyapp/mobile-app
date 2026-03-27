import { useState, useRef, useCallback, useEffect } from "react";

interface MediaPreviewScreenProps {
  file: File;
  onSend: (file: File, caption: string) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Image Cropper
// ---------------------------------------------------------------------------

interface CropArea {
  x: number;
  y: number;
  size: number;
}

function ImageCropper({
  src,
  onCrop,
}: {
  src: string;
  onCrop: (croppedFile: File, originalFile?: undefined) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [cropping, setCropping] = useState(false);
  const dragging = useRef<{ startX: number; startY: number; startCrop: CropArea } | null>(null);
  const resizing = useRef<{ startX: number; startY: number; startSize: number } | null>(null);

  // Initialize crop area centered
  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) * 0.75;
    setCrop({
      x: (rect.width - size) / 2,
      y: (rect.height - size) / 2,
      size,
    });
  }, [imgLoaded]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: "move" | "resize") => {
      if (!crop) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      if (mode === "move") {
        dragging.current = { startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
      } else {
        resizing.current = { startX: e.clientX, startY: e.clientY, startSize: crop.size };
      }
    },
    [crop]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (dragging.current) {
        const dx = e.clientX - dragging.current.startX;
        const dy = e.clientY - dragging.current.startY;
        const sc = dragging.current.startCrop;
        setCrop({
          x: Math.max(0, Math.min(rect.width - sc.size, sc.x + dx)),
          y: Math.max(0, Math.min(rect.height - sc.size, sc.y + dy)),
          size: sc.size,
        });
      }

      if (resizing.current) {
        const dx = e.clientX - resizing.current.startX;
        const dy = e.clientY - resizing.current.startY;
        const delta = Math.max(dx, dy);
        const newSize = Math.max(80, Math.min(rect.width, rect.height, resizing.current.startSize + delta));
        setCrop((prev) =>
          prev
            ? {
                x: Math.min(prev.x, rect.width - newSize),
                y: Math.min(prev.y, rect.height - newSize),
                size: newSize,
              }
            : prev
        );
      }
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = null;
    resizing.current = null;
  }, []);

  const applyCrop = useCallback(() => {
    if (!crop || !imgRef.current || !containerRef.current) return;
    setCropping(true);

    const img = imgRef.current;
    const rect = containerRef.current.getBoundingClientRect();

    // Map crop area from display coords to image coords
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
        setCropping(false);
        if (blob) {
          onCrop(new File([blob], "cropped.webp", { type: "image/webp" }));
        }
      },
      "image/webp",
      0.85
    );
  }, [crop, onCrop]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
      <div
        ref={containerRef}
        className="relative w-full max-h-[60vh] overflow-hidden flex items-center justify-center"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt="Preview"
          onLoad={() => setImgLoaded(true)}
          className="w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />

        {/* Overlay with hole for crop area */}
        {crop && imgLoaded && (
          <>
            {/* Dark overlay */}
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }}>
              {/* Clear rectangle for crop area */}
              <div
                className="absolute bg-transparent"
                style={{
                  left: crop.x,
                  top: crop.y,
                  width: crop.size,
                  height: crop.size,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                }}
              />
            </div>

            {/* Crop frame border */}
            <div
              className="absolute border-2 border-white/90 rounded-sm"
              style={{ left: crop.x, top: crop.y, width: crop.size, height: crop.size }}
              onPointerDown={(e) => handlePointerDown(e, "move")}
            >
              {/* Grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
              </div>
              {/* Resize handle */}
              <div
                className="absolute -bottom-2 -right-2 w-6 h-6 bg-white rounded-full shadow-lg"
                onPointerDown={(e) => handlePointerDown(e, "resize")}
              />
            </div>
          </>
        )}
      </div>

      <button
        onClick={applyCrop}
        disabled={cropping || !crop}
        className="px-5 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium active:bg-emerald-700 disabled:opacity-40 transition-colors"
      >
        {cropping ? "Recortando..." : "Recortar"}
      </button>
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
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(previewUrl);
      if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    };
  }, [previewUrl, croppedUrl]);

  const handleCrop = useCallback((croppedFile: File) => {
    setActiveFile(croppedFile);
    const url = URL.createObjectURL(croppedFile);
    setCroppedUrl(url);
  }, []);

  const displayUrl = croppedUrl ?? previewUrl;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 border-b border-zinc-800 shrink-0"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "3.5rem" }}
      >
        <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center text-zinc-200">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h1 className="text-white font-medium text-sm flex-1 truncate">
          {isImage ? "Imagen" : isVideo ? "Video" : file.name}
        </h1>
        <span className="text-zinc-500 text-xs">
          {(file.size / (1024 * 1024)).toFixed(1)} MB
        </span>
      </div>

      {/* Preview area */}
      {isImage && !croppedUrl && (
        <ImageCropper src={previewUrl} onCrop={handleCrop} />
      )}

      {isImage && croppedUrl && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <img src={displayUrl} alt="Preview" className="max-w-full max-h-[60vh] rounded-lg object-contain" />
          <button
            onClick={() => {
              setCroppedUrl(null);
              setActiveFile(file);
            }}
            className="px-4 py-1.5 rounded-full border border-zinc-700 text-zinc-300 text-xs active:bg-zinc-800 transition-colors"
          >
            Recortar de nuevo
          </button>
        </div>
      )}

      {isVideo && (
        <div className="flex-1 flex items-center justify-center px-4">
          <video
            src={previewUrl}
            controls
            playsInline
            className="max-w-full max-h-[60vh] rounded-lg"
          />
        </div>
      )}

      {!isImage && !isVideo && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <div className="w-20 h-20 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-zinc-300 text-sm font-medium">{file.name}</p>
          <p className="text-zinc-500 text-xs">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
        </div>
      )}

      {/* Bottom: Caption + Send */}
      <div
        className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-4 py-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
      >
        <div className="flex items-end gap-3">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Agregar comentario..."
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSend(activeFile, caption.trim());
              }
            }}
          />
          <button
            onClick={() => onSend(activeFile, caption.trim())}
            className="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 active:bg-emerald-700 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
