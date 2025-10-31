import 'dart:typed_data';

import 'package:pointycastle/export.dart';

import 'package:Ren/core/encryption/crypto.dart' as core_crypto;
import 'package:Ren/core/models/message.dart';
import 'package:Ren/core/models/envelope.dart';
import 'package:Ren/core/models/metadata.dart';

/// Сервис шифрования/дешифрования сообщений и файлов.
/// Единая точка для работы с криптографией в приложении.
class MessageCipherService {
  const MessageCipherService();

  /// Шифрует текст сообщения и возвращает шифртекст с nonce.
  core_crypto.EncryptedMessage encryptText(String text, Uint8List messageKey) {
    return core_crypto.Crypto.encryptMessage(text, messageKey);
  }

  /// Дешифрует текст сообщения по шифртексту и nonce.
  String decryptText(String ciphertext, Uint8List messageKey, String nonce) {
    return core_crypto.Crypto.decryptData(ciphertext, messageKey, nonce);
  }

  /// Шифрует файл и возвращает данные для `Metadata` (nonce/size и т.д.)
  core_crypto.EncryptedFile encryptFile(
    Uint8List bytes,
    String filename,
    String mime,
    Uint8List messageKey,
  ) {
    return core_crypto.Crypto.encryptFile(bytes, filename, mime, messageKey);
  }

  /// Генерирует симметричный ключ для сообщения/пакета файлов.
  Uint8List generateMessageKey() => core_crypto.Crypto.generateMessageEncryptionKey();

  /// Оборачивает симметричный ключ для получателя.
  core_crypto.WrappedKeyResult wrapKeyForRecipient(Uint8List key, ECPublicKey pubKey) {
    return core_crypto.Crypto.wrapSymmetricKey(key, pubKey);
  }

  /// Распаковывает симметричный ключ из конверта для текущего пользователя.
  Uint8List unwrapKeyFromEnvelope(Envelope env, ECPrivateKey privateKey) {
    return core_crypto.Crypto.unwrapSymmetricKey(env.key, env.ephemPubKey, env.iv, privateKey);
  }

  /// Временный метод для дешифрования истории сообщений с бэка.
  /// Реализация перенесена из util `DecryptMessages`.
  Future<List<Messages>> decryptHistory(
    List<dynamic> jsonList,
    ECPrivateKey privateKey,
    int userId,
  ) async {
    final List<Messages> decrypted = [];
    for (final messageData in jsonList) {
      final msg = await _decryptSingleMessage(
        Map<String, dynamic>.from(messageData as Map),
        privateKey,
        userId,
      );
      if (msg != null) {
        decrypted.add(msg);
      }
    }
    return decrypted;
  }

  /// Дешифрует сообщение из WebSocket
  Future<Messages?> decryptWebSocketMessage(
    Map<String, dynamic> messageData,
    ECPrivateKey privateKey,
    int currentUserId,
  ) async {
    return _decryptSingleMessage(messageData, privateKey, currentUserId);
  }

  /// Проверяет, может ли пользователь дешифровать сообщение
  bool canDecryptMessage(
    Map<String, dynamic> messageData,
    int currentUserId,
  ) {
    final envelopes = messageData['envelopes'] as Map<String, dynamic>?;
    if (envelopes == null) return false;
    final userIdStr = currentUserId.toString();
    return envelopes.containsKey(userIdStr);
  }

  /// Получает список пользователей, которые могут дешифровать сообщение
  List<int> getDecryptableUsers(Map<String, dynamic> messageData) {
    final envelopes = messageData['envelopes'] as Map<String, dynamic>?;
    if (envelopes == null) return const [];
    final users = <int>[];
    for (final key in envelopes.keys) {
      final id = int.tryParse(key);
      if (id != null) users.add(id);
    }
    return users;
  }

  /// Вспомогательный метод: дешифрует одно сообщение по данным с сервера
  Future<Messages?> _decryptSingleMessage(
    Map<String, dynamic> messageData,
    ECPrivateKey privateKey,
    int currentUserId,
  ) async {
    try {
      final id = messageData['id'] as int;
      final chatId = messageData['chat_id'] as int;
      final senderId = messageData['sender_id'] as int;
      final messageType = messageData['message_type'] as String;
      final createdAt = DateTime.parse(messageData['created_at'] as String);
      final editedAt = messageData['edited_at'] != null
          ? DateTime.parse(messageData['edited_at'] as String)
          : null;
      final isRead = messageData['is_read'] as bool? ?? false;

      // metadata
      List<Metadata>? metadata;
      if (messageData['metadata'] != null) {
        metadata = (messageData['metadata'] as List)
            .map((m) => Metadata.fromJson(m))
            .toList();
      }

      // envelopes
      Map<String, Envelope>? envelopes;
      if (messageData['envelopes'] != null) {
        final envelopesData = messageData['envelopes'] as Map<String, dynamic>;
        envelopes = envelopesData.map((k, v) => MapEntry(k, Envelope.fromJson(v)));
      }

      String decryptedText = '';
      if (messageData['ciphertext'] != null &&
          messageData['nonce'] != null &&
          envelopes != null) {
        Envelope? envelope;
        final userIdStr = currentUserId.toString();
        if (envelopes.containsKey(userIdStr)) {
          envelope = envelopes[userIdStr];
        }

        if (envelope != null) {
          final messageKey = core_crypto.Crypto.unwrapSymmetricKey(
            envelope.key,
            envelope.ephemPubKey,
            envelope.iv,
            privateKey,
          );
          if (messageData['ciphertext'].toString().isNotEmpty &&
              messageData['nonce'].toString().isNotEmpty) {
            decryptedText = core_crypto.Crypto.decryptData(
              messageData['ciphertext'] as String,
              messageKey,
              messageData['nonce'] as String,
            );
          }
        }
      }

      final hasFiles =
          messageType == 'file' ||
          messageType == 'message_with_files' ||
          (metadata != null && metadata.isNotEmpty);

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
    } catch (_) {
      return null;
    }
  }
}
