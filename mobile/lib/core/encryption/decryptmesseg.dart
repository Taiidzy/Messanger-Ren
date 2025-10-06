import 'package:Ren/core/encryption/crypto.dart';

import 'package:Ren/core/models/user.messages.model.dart';
import 'package:pointycastle/ecc/api.dart';
import 'package:Ren/core/utils/logger/logger.dart';

class DecryptMessage {
  String decryptMessage(
    Messages message,
    String currentUserId,
    ECPrivateKey privateKey,
  ) {
    // Только текстовые превью расшифровываем здесь
    if (message.messageType != 'text') {
      logger.t('DecryptMessage: non-text messageType=${message.messageType}');
      return '';
    }

    try {
      // Если у сообщения есть ciphertext/nonce и envelopes — расшифруем
      final hasCipher = (message.ciphertext ?? '').isNotEmpty;
      final hasNonce = (message.nonce ?? '').isNotEmpty;
      final envelopes = message.envelopes;

      if (hasCipher && hasNonce && envelopes != null && envelopes.isNotEmpty) {
        final envelope = envelopes[currentUserId];
        if (envelope == null) {
          logger.w('No envelope found for user $currentUserId. Available: ${envelopes.keys.toList()}');
          // fallback ниже
        } else {
          final messageKey = Crypto.unwrapSymmetricKey(
            envelope.key,
            envelope.ephemPubKey,
            envelope.iv,
            privateKey,
          );

          final decrypted = Crypto.decryptData(
            message.ciphertext!,
            messageKey,
            message.nonce!,
          );

          return decrypted;
        }
      }

      // Fallback: если ciphertext/nonce нет или envelope не нашёлся — используем поле message, если оно задано
      if (message.message.isNotEmpty) {
        return message.message;
      }

      return '';
    } catch (e) {
      logger.e('DecryptMessage error: $e');
      return '';
    }
  }
}
