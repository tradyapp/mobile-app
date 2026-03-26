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
  created_at: string;
}

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
      .select("id, room_id, user_id, user_email, text, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data as ChatMessage[]) ?? [];
  }

  async sendMessage(roomId: string, userId: string, userEmail: string, text: string): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ room_id: roomId, user_id: userId, user_email: userEmail, text })
      .select("id, room_id, user_id, user_email, text, created_at")
      .single();

    if (error) throw error;
    return data as ChatMessage;
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
