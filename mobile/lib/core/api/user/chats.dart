import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'package:Ren/core/models/chat.dart';

import 'package:Ren/core/notifications/notifications.dart';

import 'package:Ren/core/utils/constants/apiurl.dart';
import 'package:Ren/core/utils/logger/logger.dart';

class ChatsAPI {
  static Future<List<Chats>> getChats(
    String token,
    BuildContext context,
  ) async {
    final response = await http.get(
      Uri.parse('${Apiurl.CHAT_SERVICE}/chats'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return chatsFromJson(response.body);
    } else {
      logger.e(response.body);
      Notifications.showSystemNotification(
        'Ошибка',
        response.body.toString(),
        context,
        const Duration(seconds: 4),
        const Color.fromARGB(255, 121, 50, 17),
      );
      throw Exception('Failed to load chats');
    }
  }
}
