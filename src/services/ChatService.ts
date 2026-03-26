import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  status: "active" | "archived";
  sort_order: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_email: string;
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

const MESSAGE_FIELDS = "id, room_id, user_id, user_email, text, attachment_url, attachment_type, attachment_name, thumbnail_url, created_at";

class ChatService {
  async getRooms(): Promise<ChatRoom[]> {
    const { data, error } = await supabase
      .from("chat_rooms")
      .select("id, name, description, icon_url, status, sort_order, created_at")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return (data as ChatRoom[]) ?? [];
  }

  async getMessages(roomId: string, limit = 100): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from("chat_messages")
      .select(MESSAGE_FIELDS)
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data as ChatMessage[]) ?? [];
  }

  async sendMessage(
    roomId: string,
    userId: string,
    userEmail: string,
    text: string,
    attachment?: AttachmentResult
  ): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: roomId,
        user_id: userId,
        user_email: userEmail,
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

  private async uploadFile(roomId: string, file: File, suffix = ""): Promise<string> {
    const ext = file.name.split(".").pop() ?? "";
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

    if (file.type.startsWith("video/")) type = "video";

    const url = await this.uploadFile(roomId, file);
    return { url, type, name: file.name, thumbnailUrl: null };
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
