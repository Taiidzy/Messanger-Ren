export interface Messages {
  id: number;
  chat_id: number;
  sender_id: number;
  message: string;
  message_type: string;
  created_at: string;
  edited_at: string | null;
  is_read: boolean;
  hasFiles?: boolean;
  metadata: Metadata[];
  envelopes?: { [userId: string]: Envelope };
  status?: "pending" | "sent";
}

// Интерфейс для данных сообщения
export interface Envelope {
  key: string;
  ephemPubKey: string;
  iv: string;
}

export interface Metadata {
  file_id: number;
  filename: string;
  mimetype: string;
  size: number;
  encFile: string | null;
  nonce: string | null;
  file_creation_date?: string | null;
  // Для chunked видео:
  nonces?: string[];
  chunk_size?: number;
  chunk_count?: number;
}

export interface Files {
  file_id?: number;
  encFile?: string;
  nonce?: string;
}

export interface MessageData {
  id: number;
  chat_id: number;
  sender_id: number;
  files?: Files[] | null;
  ciphertext: string;
  nonce: string;
  envelopes: { [userId: string]: Envelope };
  message_type: string;
  metadata: Metadata[];
  created_at: string;
  edited_at: string | null;
  is_read: boolean;
}

export interface Recipient {
  userId: number;
  publicKey: CryptoKey;
}

export interface FileInfo {
  id: number;
  message_id: number;
  file_id: number;
  file_path: string;
  filename: string;
  mimetype: string;
  size: number;
  nonce: string;
  metadata: Metadata;
  created_at?: string;
  chunks?: FileChunk[];
}

export interface DecryptedFile {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  file_id?: number;
}

export interface FileChunk {
  chunk: string; // base64
  nonce: string; // base64
  index: number;
}
