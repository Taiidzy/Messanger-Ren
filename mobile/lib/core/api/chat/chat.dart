import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';

import 'package:Ren/core/utils/logout/logout.dart';

import 'package:Ren/core/models/message.dart';

import 'package:Ren/core/utils/constants/apiurl.dart';

class ChatAPI {
  static Future<List<Messages>> getChat(
    String token,
    int chatId,
    BuildContext context,
  ) async {
    final response = await http.get(
      Uri.parse('${Apiurl.CHAT_SERVICE}/chats/$chatId/messages'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 401) {
      await Logout.logout(context, 0);

      return [];
    }

    if (response.statusCode == 200) {
      return chatFromJson(response.body);
    } else {
      throw Exception('Failed to load chat');
    }
  }
}
