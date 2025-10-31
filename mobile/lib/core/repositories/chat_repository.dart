import 'package:pointycastle/export.dart';

import 'package:Ren/core/api/chat_api.dart';
import 'package:Ren/core/crypto/message_cipher_service.dart';
import 'package:Ren/core/models/message.dart';
import 'package:Ren/core/api/websocket_service.dart';
import 'package:Ren/core/encryption/crypto.dart' as core_crypto;

/// Репозиторий чата инкапсулирует доступ к данным (HTTP/WS) и криптологию.
class ChatRepository {
  final ChatApi _chatApi;
  final MessageCipherService _cipher;

  const ChatRepository({required ChatApi chatApi, required MessageCipherService cipher})
      : _chatApi = chatApi,
        _cipher = cipher;

  /// Загрузка истории сообщений и их дешифрование.
  Future<List<Messages>> fetchHistory({
    required int chatId,
    required String token,
    required ECPrivateKey privateKey,
    required int userId,
  }) async {
    final raw = await _chatApi.fetchHistory(chatId: chatId, token: token);
    return _cipher.decryptHistory(raw, privateKey, userId);
  }

  /// Построение списка получателей для шифрования сообщений.
  List<Recipient> buildRecipients({
    required int selfUserId,
    required ECPublicKey selfPublicKey,
    required int companionUserId,
    required String companionPubKeyString,
  }) {
    final recipients = <Recipient>[];

    // добавляем себя
    recipients.add(Recipient(userId: selfUserId, publicKey: selfPublicKey));

    // добавляем собеседника, если ключ валиден
    try {
      final companionPubKey = core_crypto.Crypto.publicKeyFromString(companionPubKeyString);
      recipients.add(Recipient(userId: companionUserId, publicKey: companionPubKey));
    } catch (_) {
      // игнорируем, сообщение будет доступно только себе
    }

    return recipients;
  }
}
