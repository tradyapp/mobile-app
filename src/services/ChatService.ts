import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  icon_thumb_url: string | null;
  status: "active" | "archived";
  sort_order: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_displayname: string | null;
  text: string;
  attachment_url: string | null;
  attachment_type: "image" | "video" | "document" | null;
  attachment_name: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface AttachmentResult {
  url: string;
  type: "image" | "video" | "document";
  name: string;
  thumbnailUrl: string | null;
}

const MESSAGE_FIELDS = "id, room_id, user_id, user_displayname, text, attachment_url, attachment_type, attachment_name, thumbnail_url, created_at";

class ChatService {
  async getRooms(): Promise<ChatRoom[]> {
    const { data, error } = await supabase
      .from("chat_rooms")
      .select("id, name, description, icon_url, icon_thumb_url, status, sort_order, created_at")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return (data as ChatRoom[]) ?? [];
  }

  /** Fetch the latest `limit` messages (returned in ascending order). */
  async getMessages(roomId: string, limit = 15): Promise<ChatMessage[]> {
    // Fetch newest first, then reverse so the array is chronological
    const { data, error } = await supabase
      .from("chat_messages")
      .select(MESSAGE_FIELDS)
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ((data as ChatMessage[]) ?? []).reverse();
  }

  /** Fetch `limit` messages older than `beforeId` (returned in ascending order). */
  async getOlderMessages(roomId: string, beforeDate: string, limit = 5): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from("chat_messages")
      .select(MESSAGE_FIELDS)
      .eq("room_id", roomId)
      .lt("created_at", beforeDate)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ((data as ChatMessage[]) ?? []).reverse();
  }

  async sendMessage(
    roomId: string,
    userId: string,
    userDisplayname: string,
    text: string,
    attachment?: AttachmentResult
  ): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: roomId,
        user_id: userId,
        user_displayname: userDisplayname,
        text: text || "",
        attachment_url: attachment?.url ?? null,
        attachment_type: attachment?.type ?? null,
        attachment_name: attachment?.name ?? null,
        thumbnail_url: attachment?.thumbnailUrl ?? null,
      })
      .select(MESSAGE_FIELDS)
      .single();

    if (error) throw error;
    return data as ChatMessage;
  }

  private resizeToWebP(file: File, maxWidth: number, quality: number): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const baseName = file.name.replace(/\.[^.]+$/, "");
            resolve(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Failed to load image")); };
      img.src = objectUrl;
    });
  }

  private async uploadFile(roomId: string, file: File, suffix = "", extOverride?: string): Promise<string> {
    const ext = extOverride ?? (file.name.split(".").pop() ?? "");
    const path = `${roomId}/${crypto.randomUUID()}${suffix}.${ext}`;

    const { error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async uploadAttachment(roomId: string, file: File): Promise<AttachmentResult> {
    let type: "image" | "video" | "document" = "document";

    if (file.type.startsWith("image/")) {
      type = "image";

      // Create both versions in parallel
      const [fullFile, thumbFile] = await Promise.all([
        this.resizeToWebP(file, 1600, 0.8),
        this.resizeToWebP(file, 48, 0.6),
      ]);

      const [fullUrl, thumbUrl] = await Promise.all([
        this.uploadFile(roomId, fullFile),
        this.uploadFile(roomId, thumbFile, "_thumb"),
      ]);

      return { url: fullUrl, type, name: file.name, thumbnailUrl: thumbUrl };
    }

    if (file.type.startsWith("video/")) {
      type = "video";

      // Compress video and generate thumbnail in parallel
      const [compressedFile, thumbFile] = await Promise.all([
        this.compressVideo(file),
        this.generateVideoThumbnail(file),
      ]);

      const [videoUrl, thumbUrl] = await Promise.all([
        this.uploadFile(roomId, compressedFile, "", "webm"),
        this.uploadFile(roomId, thumbFile, "_thumb"),
      ]);

      return { url: videoUrl, type, name: file.name, thumbnailUrl: thumbUrl };
    }

    const url = await this.uploadFile(roomId, file);
    return { url, type, name: file.name, thumbnailUrl: null };
  }

  private compressVideo(file: File): Promise<File> {
    // Max resolution 720p, target ~1 Mbps
    const MAX_W = 720;
    const MAX_H = 720;
    const TARGET_BITRATE = 1_000_000;

    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        const { videoWidth: ow, videoHeight: oh, duration } = video;

        // Skip compression for already-small files (< 2 MB) or very short clips
        if (file.size < 2 * 1024 * 1024 || duration < 1) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        // Calculate target dimensions
        let w = ow;
        let h = oh;
        if (w > MAX_W) { h = Math.round(h * (MAX_W / w)); w = MAX_W; }
        if (h > MAX_H) { w = Math.round(w * (MAX_H / h)); h = MAX_H; }
        // Ensure even dimensions (required by some codecs)
        w = w % 2 === 0 ? w : w + 1;
        h = h % 2 === 0 ? h : h + 1;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;

        const stream = canvas.captureStream(30);

        // Add audio track if present
        try {
          const audioCtx = new AudioContext();
          const source = audioCtx.createMediaElementSource(video);
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);
          source.connect(audioCtx.destination);
          dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        } catch {
          // No audio or not supported — continue without audio
        }

        const recorderOptions: MediaRecorderOptions = { mimeType: "video/webm" };
        // Try to set bitrate (not all browsers support it)
        try {
          recorderOptions.videoBitsPerSecond = TARGET_BITRATE;
        } catch { /* ignore */ }

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, recorderOptions);
        } catch {
          // Fallback without bitrate control
          recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = () => {
          URL.revokeObjectURL(objectUrl);
          const blob = new Blob(chunks, { type: "video/webm" });
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${baseName}.webm`, { type: "video/webm" }));
        };

        recorder.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(file); // Fallback to original on error
        };

        // Draw frames to canvas
        const drawFrame = () => {
          if (video.paused || video.ended) return;
          ctx.drawImage(video, 0, 0, w, h);
          requestAnimationFrame(drawFrame);
        };

        video.onplay = () => {
          recorder.start(100); // Collect data every 100ms
          drawFrame();
        };

        video.onended = () => {
          recorder.stop();
          stream.getTracks().forEach((t) => t.stop());
        };

        video.currentTime = 0;
        video.muted = false;
        video.play().catch(() => {
          // Autoplay blocked - try muted
          video.muted = true;
          video.play().catch(() => {
            URL.revokeObjectURL(objectUrl);
            resolve(file); // Can't play — return original
          });
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load video for compression"));
      };

      video.src = objectUrl;
    });
  }

  private generateVideoThumbnail(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      const objectUrl = URL.createObjectURL(file);

      const capture = () => {
        const canvas = document.createElement("canvas");
        const maxW = 480;
        let { videoWidth: w, videoHeight: h } = video;
        if (!w || !h) { w = 480; h = 270; }
        if (w > maxW) {
          h = Math.round(h * (maxW / w));
          w = maxW;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(video, 0, 0, w, h);
        URL.revokeObjectURL(objectUrl);

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Failed to generate video thumbnail")); return; }
            const baseName = file.name.replace(/\.[^.]+$/, "");
            resolve(new File([blob], `${baseName}_thumb.webp`, { type: "image/webp" }));
          },
          "image/webp",
          0.75,
        );
      };

      video.onseeked = capture;

      video.onloadeddata = () => {
        if (video.duration > 0.5) {
          video.currentTime = Math.min(1, video.duration * 0.25);
        } else {
          // Very short video – capture first available frame
          capture();
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load video for thumbnail"));
      };

      video.src = objectUrl;
    });
  }

  subscribeToRoom(roomId: string, onMessage: (msg: ChatMessage) => void): RealtimeChannel {
    return supabase
      .channel(`chat_room_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          onMessage(payload.new as ChatMessage);
        }
      )
      .subscribe();
  }

  unsubscribe(channel: RealtimeChannel) {
    supabase.removeChannel(channel);
  }
}

export const chatService = new ChatService();
