import 'dart:convert';
import 'package:http/http.dart' as http;

import 'package:Ren/core/utils/constants/apiurl.dart';

/// HTTP-клиент для работы с историей сообщений/чатов.
class ChatApi {
  const ChatApi();

  /// Загружает историю сообщений конкретного чата.
  Future<List<dynamic>> fetchHistory({required int chatId, required String token}) async {
    final uri = Uri.parse('${Apiurl.CHAT_SERVICE}/chats/$chatId/messages');
    final resp = await http.get(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (resp.statusCode == 200) {
      return json.decode(resp.body) as List<dynamic>;
    }

    if (resp.statusCode == 401) {
      throw const ChatApiUnauthorized();
    }

    throw ChatApiError('Failed to fetch history: ${resp.statusCode}');
  }
}

class ChatApiError implements Exception {
  final String message;
  const ChatApiError(this.message);
  @override
  String toString() => 'ChatApiError: $message';
}

class ChatApiUnauthorized implements Exception {
  const ChatApiUnauthorized();
}
