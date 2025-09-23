export interface ChatResponse {
  chatId: number;
  user1Id: number;
  user2Id: number;
  createdAt: Date;
}

export interface ChatWithUserInfo {
  chat_id: number;
  user_id: number;
  companion_id: number;
  created_at: Date;
  companion_avatar: string | null;
  companion_userName: string | null;
  companion_pubKey: string | null;
  last_message: Message | null;
}

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  ciphertext: string; // base64 encoded
  nonce: string; // base64 encoded
  envelopes: any;
  message_type: string;
  metadata?: any;
  created_at: string; // ISO string
  edited_at?: string | null; // ISO string
  is_read: boolean;
}
