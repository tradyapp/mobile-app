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
  created_at: string;
}

const MESSAGE_FIELDS = "id, room_id, user_id, user_email, text, attachment_url, attachment_type, attachment_name, created_at";

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
    attachment?: { url: string; type: "image" | "video" | "document"; name: string }
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
      })
      .select(MESSAGE_FIELDS)
      .single();

    if (error) throw error;
    return data as ChatMessage;
  }

  async uploadAttachment(roomId: string, file: File): Promise<{ url: string; type: "image" | "video" | "document"; name: string }> {
    const ext = file.name.split(".").pop() ?? "";
    const path = `${roomId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file);

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    let type: "image" | "video" | "document" = "document";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";

    return { url: urlData.publicUrl, type, name: file.name };
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
