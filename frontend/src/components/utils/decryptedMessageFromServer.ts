import { decryptMessage, unwrapSymmetricKey } from "@/components/utils/crypto";
import type {
  Messages,
  MessageData,
  Envelope,
} from "@/components/models/Messages";

// Функция принимает массив сообщений, приватный ключ пользователя и user_id текущего пользователя
export const decryptedMessagesFromServer = async (
  messages: MessageData[],
  privateKey: CryptoKey,
  myUserId: number,
): Promise<Messages[]> => {
  if (!privateKey) {
    console.warn("Приватный ключ отсутствует, не могу расшифровать сообщения.");
    return [];
  }

  const decryptedMessages: Messages[] = [];

  for (const messageData of messages) {
    const envelopes = messageData.envelopes;
    // Берём envelope именно для текущего пользователя
    const userIdStr = myUserId.toString();
    let envelope: Envelope | undefined = envelopes[userIdStr];
    // Если не найдено по userId, пробуем fallback — первый доступный envelope
    if (!envelope) {
      const allKeys = Object.keys(envelopes);
      for (const key of allKeys) {
        if (envelopes[key]) {
          envelope = envelopes[key];
          break;
        }
      }
    }
    if (!envelope) {
      // Нет конверта для этого пользователя — пропускаем сообщение
      continue;
    }
    try {
      const messageKey = await unwrapSymmetricKey(
        envelope.key,
        envelope.ephemPubKey,
        envelope.iv,
        privateKey,
      );

      let decryptedText = "";

      // Расшифровываем текст только если есть ciphertext и nonce
      if (
        messageData.ciphertext &&
        messageData.nonce &&
        messageData.ciphertext.trim() !== "" &&
        messageData.nonce.trim() !== ""
      ) {
        try {
          decryptedText = await decryptMessage(
            messageData.ciphertext,
            messageData.nonce,
            messageKey,
          );
        } catch (textDecryptionError) {
          console.error(
            "Ошибка расшифровки текста сообщения:",
            textDecryptionError,
          );
          decryptedText = "Ошибка расшифровки текста";
        }
      }

      // Для сообщений с файлами добавляем информацию о файлах
      if (messageData.message_type === "file") {
        decryptedText = "";
      }

      console.log(messageData);

      decryptedMessages.push({
        id: messageData.id ?? Date.now() + Math.floor(Math.random() * (10000000 - 1 + 1)) + 1,
        chat_id: messageData.chat_id,
        sender_id: messageData.sender_id,
        message: decryptedText,
        message_type: messageData.message_type,
        created_at: messageData.created_at,
        edited_at: messageData.edited_at,
        is_read: messageData.is_read,
        hasFiles:
          messageData.message_type === "file" ||
          messageData.message_type === "message_with_files",
        envelopes: messageData.envelopes,
        metadata: messageData.metadata ?? [], // всегда добавляем metadata
      });
      console.log(decryptedMessages);
    } catch (decryptionError) {
      console.error("Ошибка расшифровки сообщения:", decryptionError);
    }
  }
  return decryptedMessages;
};
