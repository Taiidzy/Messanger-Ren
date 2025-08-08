import type { MessageData } from "@/components/models/Messages";

export interface User {
  id: number;
  userName: string;
  avatar: string;
  last_message: MessageData;
  online: boolean;
  newMessage: boolean;
  chat_id: number;
  user_id: number;
  companion_id: number;
  companion_userName: string;
  companion_avatar: string;
  companion_pubKey: string;
  created_at: Date;
}
