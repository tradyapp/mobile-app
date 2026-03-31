"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services/UserService";
import { chatService, type ChatMessage } from "@/services/ChatService";
import MediaPreviewScreen from "@/components/chat/MediaPreviewScreen";

// ---------------------------------------------------------------------------
// ProgressiveImage (standardized chat image with fullscreen preview)
// ---------------------------------------------------------------------------

function ProgressiveImage({ src, thumbnail, alt }: { src: string; thumbnail: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setPreviewOpen(true)}
        className="relative rounded-lg overflow-hidden mb-1.5 block w-full text-left"
        style={{ height: 220 }}
      >
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover rounded-lg blur-sm scale-105"
          />
        )}
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover rounded-lg transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
        />
        {!thumbnail && !loaded && (
          <div className="absolute inset-0 bg-zinc-800 rounded-lg animate-pulse" />
        )}
      </button>

      {previewOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex flex-col"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="flex items-center px-4 shrink-0"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "3.5rem" }}
          >
            <button
              onClick={() => setPreviewOpen(false)}
              className="w-9 h-9 flex items-center justify-center text-white rounded-full active:bg-white/10"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ChatVideoPreview (thumbnail → fullscreen inline player)
// ---------------------------------------------------------------------------

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function ChatVideoPreview({ videoUrl, thumbnailUrl }: { videoUrl: string; thumbnailUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeeds, setShowSpeeds] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleOpen = () => {
    setOpen(true);
    setLoading(true);
    setSpeed(1);
    setShowSpeeds(false);
  };

  const handleClose = () => {
    setOpen(false);
    setLoading(false);
    setShowSpeeds(false);
  };

  const handleCanPlay = () => {
    setLoading(false);
    videoRef.current?.play();
  };

  const handleSpeedChange = (s: number) => {
    setSpeed(s);
    setShowSpeeds(false);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "video";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative rounded-lg overflow-hidden mb-1.5 block w-full text-left"
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="Video" className="w-full rounded-lg" />
        ) : (
          <div className="w-full aspect-video bg-zinc-900 rounded-lg flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
          <div
            className="flex items-center justify-between px-4 shrink-0"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "3.5rem" }}
          >
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center text-white rounded-full active:bg-white/10"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSpeeds(!showSpeeds)}
                className="h-9 px-3 flex items-center gap-1.5 text-white rounded-full active:bg-white/10"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm font-medium">{speed}x</span>
              </button>

              <button
                onClick={handleDownload}
                className="w-9 h-9 flex items-center justify-center text-white rounded-full active:bg-white/10"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
            </div>
          </div>

          {showSpeeds && (
            <div className="absolute top-16 right-4 z-20 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl" style={{ marginTop: "env(safe-area-inset-top, 0px)" }}>
              {PLAYBACK_SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`w-full px-5 py-2.5 text-sm text-left transition-colors ${speed === s ? "text-[#00ff99] bg-white/5" : "text-zinc-300 active:bg-white/5"}`}
                >
                  {s}x {s === 1 && "(Normal)"}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 flex items-center justify-center relative" onClick={() => showSpeeds && setShowSpeeds(false)}>
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              autoPlay
              onCanPlay={handleCanPlay}
              poster={thumbnailUrl ?? undefined}
              className="max-w-full max-h-full"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ChatRoomPage — standalone fullscreen chat room
// ---------------------------------------------------------------------------

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // Room name
  const [roomName, setRoomName] = useState("Chat");

  // Messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessagesLoading, setChatMessagesLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // Media
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showMediaPreview, setShowMediaPreview] = useState(false);

  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialScrollDone = useRef(false);

  // ---------------------------------------------------------------------------
  // Fetch room name
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!roomId) return;
    let active = true;
    const run = async () => {
      try {
        const rooms = await chatService.getRooms();
        if (!active) return;
        const room = rooms.find((r) => r.id === roomId);
        if (room) setRoomName(room.name);
      } catch {
        // silent
      }
    };
    void run();
    return () => { active = false; };
  }, [roomId]);

  // ---------------------------------------------------------------------------
  // Resolve display names
  // ---------------------------------------------------------------------------

  const resolveUserNames = useCallback(async (msgs: ChatMessage[]) => {
    const unknownIds = [...new Set(msgs.map((m) => m.user_id))].filter((id) => !userNames[id]);
    if (unknownIds.length === 0) return;
    try {
      const profiles = await userService.listPublicProfiles(unknownIds);
      setUserNames((prev) => {
        const next = { ...prev };
        for (const p of profiles) next[p.id] = p.displayName;
        return next;
      });
    } catch {
      // silent
    }
  }, [userNames]);

  // ---------------------------------------------------------------------------
  // Fetch messages + realtime subscription
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!roomId) return;
    let active = true;
    initialScrollDone.current = false;
    setHasMoreMessages(true);
    setChatMessagesLoading(true);
    setChatMessages([]);

    const run = async () => {
      try {
        const msgs = await chatService.getMessages(roomId, 15);
        if (!active) return;
        setChatMessages(msgs);
        if (msgs.length < 15) setHasMoreMessages(false);
        void resolveUserNames(msgs);
      } catch {
        // silent
      } finally {
        if (active) setChatMessagesLoading(false);
      }
    };

    void run();

    const channel = chatService.subscribeToRoom(roomId, (newMsg) => {
      if (!active) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      void resolveUserNames([newMsg]);
    });

    return () => {
      active = false;
      chatService.unsubscribe(channel);
    };
  }, [roomId]);

  // ---------------------------------------------------------------------------
  // Load older messages
  // ---------------------------------------------------------------------------

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMoreMessages || !roomId || chatMessages.length === 0) return;
    const oldest = chatMessages[0];
    if (!oldest) return;

    setLoadingOlder(true);
    const scrollEl = chatScrollRef.current;
    const prevHeight = scrollEl?.scrollHeight ?? 0;

    try {
      const older = await chatService.getOlderMessages(roomId, oldest.created_at, 5);
      if (older.length < 5) setHasMoreMessages(false);
      if (older.length > 0) {
        setChatMessages((prev) => [...older, ...prev]);
        void resolveUserNames(older);
        requestAnimationFrame(() => {
          if (scrollEl) {
            scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight;
          }
        });
      }
    } catch {
      // silent
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMoreMessages, roomId, chatMessages]);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    if (el.scrollTop < 80 && hasMoreMessages && !loadingOlder) {
      void loadOlderMessages();
    }
  }, [loadOlderMessages, hasMoreMessages, loadingOlder]);

  // ---------------------------------------------------------------------------
  // Scroll to bottom
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (chatMessages.length === 0) return;
    if (!initialScrollDone.current) {
      initialScrollDone.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = chatScrollRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      });
    } else if (!loadingOlder) {
      const el = chatScrollRef.current;
      if (el) {
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        if (nearBottom) {
          requestAnimationFrame(() => {
            const scrollEl = chatScrollRef.current;
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
          });
        }
      }
    }
  }, [chatMessages, loadingOlder]);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const handleSendMessage = async () => {
    const text = chatMessage.trim();
    if (!text || !user || !roomId || sending) return;

    setChatMessage("");
    if (chatInputRef.current) {
      chatInputRef.current.style.height = "auto";
    }

    setSending(true);
    try {
      await chatService.sendMessage(roomId, user.uid, user.email ?? "User", text);
    } catch {
      setChatMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  // ---------------------------------------------------------------------------
  // File / media
  // ---------------------------------------------------------------------------

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setShowMediaPreview(true);
    }
    e.target.value = "";
  };

  const handleMediaSend = async (file: File, caption: string) => {
    if (!user || !roomId || sending) return;
    setShowMediaPreview(false);
    setPendingFile(null);
    setSending(true);
    try {
      setUploading(true);
      const attachment = await chatService.uploadAttachment(roomId, file);
      setUploading(false);
      await chatService.sendMessage(roomId, user.uid, user.email ?? "User", caption, attachment);
    } catch {
      // silent
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleMediaCancel = () => {
    setShowMediaPreview(false);
    setPendingFile(null);
  };

  const handleBack = () => {
    navigate("/learn/chat");
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 border-b border-zinc-800 shrink-0" style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "3.5rem" }}>
        <button
          className="w-8 h-8 flex items-center justify-center text-zinc-200"
          onClick={handleBack}
        >
          <span className="text-xl">&#8249;</span>
        </button>
        <h1 className="text-white font-medium text-sm truncate flex-1">
          {roomName}
        </h1>
      </div>

      {/* Messages area */}
      <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto px-4 py-3">
        {chatMessagesLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-600 text-sm">Cargando mensajes...</p>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-600 text-sm">No hay mensajes aun. Inicia la conversacion.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {loadingOlder && (
              <div className="flex justify-center py-2">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
              </div>
            )}
            {chatMessages.map((msg) => {
              const isOwn = msg.user_id === user?.uid;
              const time = new Date(msg.created_at);
              return (
                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${isOwn ? "bg-emerald-600 text-white rounded-br-md" : "bg-zinc-800 text-zinc-100 rounded-bl-md"}`}>
                    {!isOwn && (
                      <p className="text-[10px] font-medium text-emerald-400 mb-0.5">{userNames[msg.user_id] || "User"}</p>
                    )}
                    {msg.attachment_url && msg.attachment_type === "image" && (
                      <ProgressiveImage src={msg.attachment_url} thumbnail={msg.thumbnail_url} alt={msg.attachment_name ?? "image"} />
                    )}
                    {msg.attachment_url && msg.attachment_type === "video" && (
                      <ChatVideoPreview
                        videoUrl={msg.attachment_url}
                        thumbnailUrl={msg.thumbnail_url}
                      />
                    )}
                    {msg.attachment_url && msg.attachment_type === "document" && (
                      <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-1.5 ${isOwn ? "bg-emerald-700/50" : "bg-zinc-700/50"}`}>
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-xs truncate">{msg.attachment_name ?? "Documento"}</span>
                      </a>
                    )}
                    {msg.text && <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>}
                    <p className={`text-[10px] mt-1 text-right ${isOwn ? "text-emerald-200/60" : "text-zinc-500"}`}>
                      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Media Preview Screen */}
      {showMediaPreview && pendingFile && (
        <MediaPreviewScreen
          file={pendingFile}
          onSend={handleMediaSend}
          onCancel={handleMediaCancel}
        />
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-end gap-2 px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="w-10 h-10 flex items-center justify-center text-zinc-400 active:text-zinc-200 shrink-0 disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </button>
          <textarea
            ref={chatInputRef}
            value={chatMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={uploading ? "Subiendo archivo..." : "Escribe un mensaje..."}
            rows={1}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500 max-h-[120px]"
          />
          <button
            onClick={() => void handleSendMessage()}
            disabled={!chatMessage.trim() || sending}
            className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 disabled:opacity-30 active:bg-emerald-700 transition-colors"
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
