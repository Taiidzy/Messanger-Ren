import 'package:pointycastle/export.dart';

import 'package:Ren/core/models/message.dart';
import 'package:Ren/core/models/envelope.dart';
import 'package:Ren/core/models/metadata.dart';
import 'package:Ren/core/encryption/crypto.dart';
import 'package:Ren/core/utils/logger/logger.dart';

class DecryptMessages {
  /// Дешифрует список сообщений с сервера
  static Future<List<Messages>> decryptMessagesFromServer(
    List<dynamic> serverMessages,
    ECPrivateKey privateKey,
    int currentUserId,
  ) async {
    final List<Messages> decryptedMessages = [];

    logger.d(
      'Начинаем дешифровку ${serverMessages.length} сообщений для пользователя $currentUserId',
    );

    for (final messageData in serverMessages) {
      try {
        final decryptedMessage = await _decryptSingleMessage(
          messageData,
          privateKey,
          currentUserId,
        );

        if (decryptedMessage != null) {
          decryptedMessages.add(decryptedMessage);
        } else {
          logger.w('Не удалось дешифровать сообщение ${messageData['id']}');
        }
      } catch (error) {
        logger.e('Ошибка дешифровки сообщения ${messageData['id']}: $error');
        // Продолжаем обработку других сообщений
      }
    }

    logger.d(
      'Дешифровка завершена. Получено ${decryptedMessages.length} сообщений',
    );
    return decryptedMessages;
  }

  /// Дешифрует одно сообщение
  static Future<Messages?> _decryptSingleMessage(
    Map<String, dynamic> messageData,
    ECPrivateKey privateKey,
    int currentUserId,
  ) async {
    try {
      // Извлекаем данные сообщения
      final id = messageData['id'] as int;
      final chatId = messageData['chat_id'] as int;
      final senderId = messageData['sender_id'] as int;
      final messageType = messageData['message_type'] as String;
      final createdAt = DateTime.parse(messageData['created_at'] as String);
      final editedAt =
          messageData['edited_at'] != null
              ? DateTime.parse(messageData['edited_at'] as String)
              : null;
      final isRead = messageData['is_read'] as bool? ?? false;

      // Обрабатываем метаданные
      List<Metadata>? metadata;
      if (messageData['metadata'] != null) {
        metadata =
            (messageData['metadata'] as List)
                .map((m) => Metadata.fromJson(m))
                .toList();
      }

      // Обрабатываем envelopes
      Map<String, Envelope>? envelopes;
      if (messageData['envelopes'] != null) {
        final envelopesData = messageData['envelopes'] as Map<String, dynamic>;
        envelopes = envelopesData.map(
          (k, v) => MapEntry(k, Envelope.fromJson(v)),
        );
      }

      String decryptedText = '';

      // Если есть зашифрованные данные, дешифруем их
      if (messageData['ciphertext'] != null &&
          messageData['nonce'] != null &&
          envelopes != null) {
        // Находим envelope для текущего пользователя
        Envelope? envelope;
        final userIdStr = currentUserId.toString();
        final userIdNum = currentUserId;

        if (envelopes.containsKey(userIdStr)) {
          envelope = envelopes[userIdStr];
        } else if (envelopes.containsKey(userIdNum.toString())) {
          envelope = envelopes[userIdNum.toString()];
        }

        if (envelope != null) {
          // Расшифровываем ключ сообщения
          final messageKey = Crypto.unwrapSymmetricKey(
            envelope.key,
            envelope.ephemPubKey,
            envelope.iv,
            privateKey,
          );

          // Расшифровываем текст сообщения
          if (messageData['ciphertext'].toString().isNotEmpty &&
              messageData['nonce'].toString().isNotEmpty) {
            decryptedText = Crypto.decryptData(
              messageData['ciphertext'] as String,
              messageKey,
              messageData['nonce'] as String,
            );
          }
        } else {
          logger.w(
            'Envelope для пользователя $currentUserId не найден в сообщении $id. Доступные ключи: ${envelopes.keys.toList()}',
          );
        }
      }

      // Определяем, есть ли файлы
      final hasFiles =
          messageType == 'file' ||
          messageType == 'message_with_files' ||
          (metadata != null && metadata.isNotEmpty);

      // Создаем объект сообщения
      return Messages(
        id: id,
        chatId: chatId,
        senderId: senderId,
        message: decryptedText,
        messageType: messageType,
        metadata: metadata,
        createdAt: createdAt,
        editedAt: editedAt,
        isRead: isRead,
        hasFiles: hasFiles,
        status: 'sent',
        envelopes: envelopes,
      );
    } catch (error) {
      logger.e('Ошибка обработки сообщения: $error');
      return null;
    }
  }

  /// Дешифрует сообщение из WebSocket
  static Future<Messages?> decryptWebSocketMessage(
    Map<String, dynamic> messageData,
    ECPrivateKey privateKey,
    int currentUserId,
  ) async {
    return await _decryptSingleMessage(messageData, privateKey, currentUserId);
  }

  /// Проверяет, может ли пользователь дешифровать сообщение
  static bool canDecryptMessage(
    Map<String, dynamic> messageData,
    int currentUserId,
  ) {
    final envelopes = messageData['envelopes'] as Map<String, dynamic>?;
    if (envelopes == null) return false;

    final userIdStr = currentUserId.toString();
    final userIdNum = currentUserId;

    return envelopes.containsKey(userIdStr) ||
        envelopes.containsKey(userIdNum.toString());
  }

  /// Получает список пользователей, которые могут дешифровать сообщение
  static List<int> getDecryptableUsers(Map<String, dynamic> messageData) {
    final envelopes = messageData['envelopes'] as Map<String, dynamic>?;
    if (envelopes == null) return [];

    final users = <int>[];
    for (final key in envelopes.keys) {
      final userId = int.tryParse(key);
      if (userId != null) {
        users.add(userId);
      }
    }

    return users;
  }
}
