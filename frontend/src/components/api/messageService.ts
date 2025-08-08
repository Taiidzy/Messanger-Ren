import React from "react";
import type {
  Messages,
  MessageData,
  Recipient,
  Metadata,
} from "@/components/models/Messages";
import type { Envelope } from "@/components/models/Messages";
import {
  encryptFile,
  decryptMessage,
  encryptMessage,
  generateMessageEncryptionKey,
  wrapSymmetricKey,
  unwrapSymmetricKey,
} from "@/components/utils/crypto";
import { WS_URL } from "@/components/utils/const";
import { uploadVideoByChunks } from "@/components/api/fileUploader";

interface UserData {
  user_id: number;
  chat_id: number;
  privateKey: CryptoKey | null;
}

interface RegisterData {
  type: "register";
  token: string;
  chat_id: number;
}

interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  isRegistered: boolean;
}

interface MessageHandlers {
  onMessageReceived?: (message: Messages) => void;
  onConnectionChange?: (isConnected: boolean) => void;
  onRegistrationChange?: (isRegistered: boolean) => void;
  onError?: (error: string) => void;
}

// Интерфейс для прогресса загрузки
export interface UploadProgress {
  fileId: number;
  fileName: string;
  uploaded: number;
  total: number;
  percentage: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

// Интерфейс для chunk'а файла
export interface FileChunk {
  chunk: string; // base64
  nonce: string; // base64
  index: number;
}

// Добавляю тип для видео-метаданных
export interface VideoMetadata {
  file_id: number;
  filename: string;
  mimetype: string;
  size: number;
  chunk_count: number;
  chunk_size: number;
}

export class MessageService {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isRegistered: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private userData: UserData;
  private token: string;
  private handlers: MessageHandlers = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(userData: UserData, handlers: MessageHandlers = {}, token: string) {
    this.userData = userData;
    this.handlers = handlers;
    this.token = token;
  }

  public connect(): void {
    // Предотвращаем множественные подключения
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      console.warn("WebSocket уже подключен или подключается");
      return;
    }

    // Останавливаем предыдущие попытки переподключения
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      this.ws = new WebSocket(WS_URL);
      this.setupEventHandlers();
    } catch (error) {
      console.error("Ошибка создания WebSocket соединения:", error);
      this.handlers.onError?.("Ошибка создания соединения");
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0; // Сбрасываем счетчик попыток
      this.handlers.onConnectionChange?.(true);
      this.registerUser();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.isRegistered = false;
      this.handlers.onConnectionChange?.(false);
      this.handlers.onRegistrationChange?.(false);

      // Переподключение только если это не намеренное закрытие
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket ошибка:", error);
      // Не изменяем состояние здесь, это сделает onclose
    };
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "registered":
          this.isRegistered = true;
          this.handlers.onRegistrationChange?.(true);
          break;

        case "new_message":
          {
            const messageData: MessageData = data.data;

            const privateKey = this.userData.privateKey;

            if (!privateKey) {
              this.handlers.onError?.(
                "Приватный ключ отсутствует, не могу расшифровать сообщение.",
              );
              return;
            }

            let envelope: Envelope | undefined = undefined;
            const envelopes = messageData.envelopes;
            const userIdStr = this.userData.user_id.toString();
            const userIdNum = this.userData.user_id;

            // Попробуем найти envelope по строковому и числовому ключу, а если envelopes массив — по индексу
            if (Array.isArray(envelopes)) {
              envelope = envelopes[userIdNum] || envelopes[userIdStr];
            } else {
              envelope = envelopes[userIdStr] || envelopes[userIdNum];
            }

            if (!envelope) {
              this.handlers.onError?.(
                `Конверт для пользователя ${this.userData.user_id} не найден. Доступные ключи: ${Object.keys(envelopes)}`,
              );
              return;
            }

            try {
              const messageKey = await unwrapSymmetricKey(
                envelope.key,
                envelope.ephemPubKey,
                envelope.iv,
                privateKey,
              );

              let decryptedText = "";

              // Обрабатываем разные типы сообщений
              if (messageData.message_type === "text") {
                // Обычное текстовое сообщение
                if (messageData.ciphertext && messageData.nonce) {
                  decryptedText = await decryptMessage(
                    messageData.ciphertext,
                    messageData.nonce,
                    messageKey,
                  );
                }
              } else if (messageData.message_type === "message_with_files") {
                // Сообщение с файлами
                if (messageData.ciphertext && messageData.nonce) {
                  decryptedText = await decryptMessage(
                    messageData.ciphertext,
                    messageData.nonce,
                    messageKey,
                  );
                }
                // Не добавляем дополнительный текст о файлах - они отображаются отдельно
              } else if (messageData.message_type === "file") {
                // Только файлы - не добавляем текст "Файлы"
                decryptedText = "";
              }

              const decryptedMessage: Messages = {
                id: messageData.id,
                chat_id: messageData.chat_id,
                message: decryptedText,
                created_at: messageData.created_at,
                sender_id: messageData.sender_id,
                message_type: messageData.message_type,
                edited_at: messageData.edited_at,
                is_read: messageData.is_read,
                metadata: messageData.metadata || [],
                hasFiles: messageData.message_type === "file" || messageData.message_type === "message_with_files",
                envelopes: messageData.envelopes
              };

              this.handlers.onMessageReceived?.(decryptedMessage);
            } catch (decryptionError) {
              console.error("Ошибка расшифровки сообщения:", decryptionError);
              this.handlers.onError?.(
                "Не удалось расшифровать входящее сообщение.",
              );
            }
          }
          break;

        case "message_sent":
          // Для message_sent больше не обрабатываем, так как отправитель получает NEW_MESSAGE
          break;

        case "error":
          console.error("Ошибка сервера:", data.message);
          this.handlers.onError?.(data.message);
          break;

        default:
          console.warn("Неизвестный тип сообщения:", data);
      }
    } catch (error) {
      console.error("Ошибка парсинга сообщения:", error);
      this.handlers.onError?.("Ошибка обработки сообщения");
    }
  }

  private registerUser(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket не подключен для регистрации");
      return;
    }

    const registerData: RegisterData = {
      type: "register",
      token: this.token,
      chat_id: this.userData.chat_id,
    };

    this.ws.send(JSON.stringify(registerData));
  }

  public async sendMessage(
    messageText: string,
    recipients: Recipient[],
  ): Promise<boolean> {
    if (
      !this.ws ||
      !this.isConnected ||
      !this.isRegistered ||
      !messageText.trim() ||
      recipients.length === 0
    ) {
      console.warn("Невозможно отправить сообщение:", {
        socketConnected: !!this.ws && this.isConnected,
        userRegistered: this.isRegistered,
        messageText: messageText.trim(),
        hasRecipients: recipients.length > 0,
      });
      return false;
    }

    try {
      const messageKey = await generateMessageEncryptionKey();
      const { ciphertext, nonce } = await encryptMessage(
        messageText,
        messageKey,
      );
      const envelopes: {
        [userId: number]: { key: string; ephemPubKey: string; iv: string };
      } = {};

      for (const recipient of recipients) {
        const { wrappedKey, ephemeralPublicKey, iv } = await wrapSymmetricKey(
          messageKey,
          recipient.publicKey,
        );

        envelopes[recipient.userId] = {
          key: wrappedKey,
          ephemPubKey: ephemeralPublicKey,
          iv: iv,
        };
      }

      const messageData: MessageData = {
        id: Date.now(),
        chat_id: this.userData.chat_id,
        sender_id: this.userData.user_id,
        ciphertext: ciphertext,
        nonce: nonce,
        envelopes: JSON.parse(JSON.stringify(envelopes)),
        message_type: "text",
        metadata: [],
        created_at: new Date().toISOString(),
        edited_at: null,
        is_read: false,
      };

      this.ws.send(JSON.stringify({ type: "message", data: messageData }));
      return true;
    } catch (error) {
      console.error("Ошибка при шифровании или отправке сообщения:", error);
      this.handlers.onError?.("Ошибка шифрования сообщения");
      return false;
    }
  }

  public async sendMessageWithFiles(
    message: string,
    files: File[],
    recipients: Recipient[],
    onProgress?: (progress: UploadProgress[]) => void,
    pendingId?: number, // ID для отслеживания pending-сообщения
  ): Promise<boolean> {
    if (
      !this.ws ||
      !this.isConnected ||
      !this.isRegistered ||
      !files ||
      recipients.length === 0
    ) {
      console.warn("Невозможно отправить сообщение с файлами:", {
        socketConnected: !!this.ws && this.isConnected,
        userRegistered: this.isRegistered,
        hasMessage: !!message.trim(),
        filesCount: files?.length || 0,
        hasRecipients: recipients.length > 0,
      });
      return false;
    }

    try {
      // Создаем один общий ключ для сообщения и всех файлов
      const messageKey = await generateMessageEncryptionKey();

      // Шифруем текстовое сообщение (если оно есть)
      let encryptedMessage = { ciphertext: "", nonce: "" };
      if (message.trim()) {
        encryptedMessage = await encryptMessage(message, messageKey);
      }

      // Создаем envelopes один раз для всего
      const envelopes: {
        [userId: number]: { key: string; ephemPubKey: string; iv: string };
      } = {};

      for (const recipient of recipients) {
        const { wrappedKey, ephemeralPublicKey, iv } = await wrapSymmetricKey(
          messageKey,
          recipient.publicKey,
        );

        envelopes[recipient.userId] = {
          key: wrappedKey,
          ephemPubKey: ephemeralPublicKey,
          iv: iv,
        };
      }

      // --- Новый блок: обработка файлов ---
      const progressArray: UploadProgress[] = files.map((file, index) => ({
        fileId: Date.now() + index,
        fileName: file.name,
        uploaded: 0,
        total: file.size,
        percentage: 0,
        status: "pending" as const,
      }));
      onProgress?.(progressArray);

      const metadataArray: Metadata[] = [];
      let usedChunkedUpload = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = progressArray[i];
        
        // Улучшенная логика определения типа файла
        const isVideo = file.type.startsWith("video/") || 
                       file.name.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v|3gp|ogv)$/);
        const isLarge = file.size > 20 * 1024 * 1024;
        
        if (isVideo || isLarge) {
          usedChunkedUpload = true;
          progress.status = "uploading";
          onProgress?.(progressArray);
          try {
            // Загружаем файл по чанкам через HTTP POST
            const pendingMessageId = pendingId || Date.now();
            const videoMeta = await uploadVideoByChunks(
              file,
              this.userData.chat_id,
              pendingMessageId,
              messageKey,
              (prog: { uploaded: number; total: number; percentage: number }) => {
                progress.uploaded = prog.uploaded;
                progress.total = prog.total;
                progress.percentage = prog.percentage;
                progress.status =
                  prog.percentage === 100 ? "completed" : "uploading";
                // Принудительно обновляем прогресс
                onProgress?.([...progressArray]);
              }
            );
            progress.status = "completed";
            onProgress?.(progressArray);
            // Добавляем метаданные для этого файла
            metadataArray.push({
              file_id: videoMeta.file_id,
              filename: videoMeta.filename,
              mimetype: videoMeta.mimetype,
              size: videoMeta.size,
              chunk_count: videoMeta.chunk_count,
              chunk_size: videoMeta.chunk_size,
              nonces: videoMeta.nonces,
              encFile: null,
              nonce: null,
            });
          } catch (error) {
            progress.status = "error";
            progress.error = error instanceof Error ? error.message : String(error);
            onProgress?.([...progressArray]);
            console.error(`[SEND_FILES][ERROR] Ошибка chunked upload для файла ${file.name}:`, error);
            // Не прерываем весь процесс, продолжаем с другими файлами
            continue;
          }
        } else {
          // Маленький файл — обычная отправка через WebSocket
          progress.status = "uploading";
          onProgress?.([...progressArray]);
          try {
            const encrypted = await encryptFile(file, messageKey);
            metadataArray.push({
              encFile: encrypted.ciphertext,
              file_id: progress.fileId,
              filename: file.name,
              file_creation_date: new Date().toISOString(),
              mimetype: file.type || "application/octet-stream",
              size: file.size,
              nonce: encrypted.nonce,
            });
            progress.status = "completed";
            progress.percentage = 100;
            progress.uploaded = file.size;
            onProgress?.([...progressArray]);
          } catch (error) {
            progress.status = "error";
            progress.error = error instanceof Error ? error.message : String(error);
            onProgress?.([...progressArray]);
            console.error(`[SEND_FILES][ERROR] Ошибка при шифровании маленького файла ${file.name}:`, error);
            // Не прерываем весь процесс, продолжаем с другими файлами
            continue;
          }
        }
      }

      // Проверяем, что есть хотя бы один успешно загруженный файл
      if (metadataArray.length === 0) {
        console.warn("[SEND_FILES] Нет успешно загруженных файлов, отменяем отправку");
        this.handlers.onError?.("Не удалось загрузить ни одного файла");
        return false;
      }

      // --- Отправляем сообщение через WebSocket ---
      const messageType = usedChunkedUpload && files.length === 1 && 
        (files[0].type.startsWith("video/") || files[0].name.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v|3gp|ogv)$/))
        ? "video"
        : usedChunkedUpload
        ? "message_with_files"
        : "message_with_files";
      const messageData: MessageData = {
        id: pendingId || Date.now(),
        ciphertext: encryptedMessage.ciphertext,
        nonce: encryptedMessage.nonce,
        chat_id: this.userData.chat_id,
        sender_id: this.userData.user_id,
        envelopes: JSON.parse(JSON.stringify(envelopes)),
        message_type: messageType,
        metadata: metadataArray,
        created_at: new Date().toISOString(),
        edited_at: null,
        is_read: false,
      };
      this.ws.send(
        JSON.stringify({
          type: "message",
          data: messageData,
        })
      );
      return true;
    } catch (error) {
      console.error("[SEND_FILES][ERROR] Ошибка при отправке сообщения с файлами:", error);
      this.handlers.onError?.(
        `Ошибка отправки: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        "Достигнуто максимальное количество попыток переподключения",
      );
      this.handlers.onError?.("Не удалось подключиться к серверу");
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Экспоненциальная задержка

    console.warn(
      `Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts} через ${delay / 1000} секунд...`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, "Пользователь отключился");
      this.ws = null;
    }

    this.isConnected = false;
    this.isRegistered = false;
    this.reconnectAttempts = 0;
    this.handlers.onConnectionChange?.(false);
    this.handlers.onRegistrationChange?.(false);
  }

  public getConnectionState(): WebSocketState {
    return {
      socket: this.ws,
      isConnected: this.isConnected,
      isRegistered: this.isRegistered,
    };
  }

  public updateHandlers(handlers: MessageHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public updateUserData(userData: UserData): void {
    this.userData = userData;
  }
}

export const useMessageService = (
  userData: UserData,
  handlers: MessageHandlers = {},
  token: string
) => {
  const [connectionState, setConnectionState] = React.useState<WebSocketState>({
    socket: null,
    isConnected: false,
    isRegistered: false,
  });

  // Создаём новый экземпляр при изменении userData/privateKey
  const messageServiceRef = React.useRef<MessageService | null>(null);

  React.useEffect(() => {
    // Отключаем старый сервис, если был
    if (messageServiceRef.current) {
      messageServiceRef.current.disconnect();
    }
    // Создаём новый сервис с актуальными userData и handlers
    messageServiceRef.current = new MessageService(userData, handlers, token);

    // Обновляем обработчики состояния
    const service = messageServiceRef.current;
    const enhancedHandlers = {
      ...handlers,
      onConnectionChange: (isConnected: boolean) => {
        setConnectionState((prev) => ({ ...prev, isConnected }));
        handlers.onConnectionChange?.(isConnected);
      },
      onRegistrationChange: (isRegistered: boolean) => {
        setConnectionState((prev) => ({ ...prev, isRegistered }));
        handlers.onRegistrationChange?.(isRegistered);
      },
    };
    service.updateHandlers(enhancedHandlers);

    // Подключаемся, если есть ключ
    if (userData.privateKey) {
      service.connect();
    } else {
      console.warn("Нет ключа для подключения");
    }

    // Отключаем при размонтировании/смене ключа
    return () => {
      service.disconnect();
    };
  }, [userData.user_id, userData.chat_id, userData.privateKey, handlers, userData, token]);

  return {
    connectionState,
    sendMessage: (messageText: string, recipients: Recipient[]) =>
      messageServiceRef.current!.sendMessage(messageText, recipients),
    sendMessageWithFiles: (
      message: string,
      files: File[],
      recipients: Recipient[],
      onProgress?: (progress: UploadProgress[]) => void,
      pendingId?: number,
    ) =>
      messageServiceRef.current!.sendMessageWithFiles(
        message,
        files,
        recipients,
        onProgress,
        pendingId,
      ),
  };
};
