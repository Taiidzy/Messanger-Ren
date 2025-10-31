import 'dart:convert';

import 'package:Ren/core/models/message.dart';

List<Chats> chatsFromJson(String str) =>
    List<Chats>.from(json.decode(str).map((x) => Chats.fromJson(x)));

String chatsToJson(List<Chats> data) =>
    json.encode(List<dynamic>.from(data.map((x) => x.toJson())));

String toJsonChats(Chats chats) => json.encode(chats.toJson());

class Chats {
  final int chatId;
  final int userId;
  final int companionId;
  final DateTime createdAt;
  final String? companionAvatar;
  final String companionUserName;
  final String companionPubKey;
  final Messages lastMessage;

  Chats({
    required this.chatId,
    required this.userId,
    required this.companionId,
    required this.createdAt,
    this.companionAvatar,
    required this.companionUserName,
    required this.companionPubKey,
    required this.lastMessage,
  });

  factory Chats.fromJson(Map<String, dynamic> json) => Chats(
        chatId: json["chat_id"],
        userId: json["user_id"],
        companionId: json["companion_id"],
        createdAt: DateTime.parse(json["created_at"]),
        companionAvatar: json["companion_avatar"],
        companionUserName: json["companion_userName"],
        companionPubKey: json["companion_pubKey"],
        lastMessage: Messages.fromJson(json["last_message"]),
      );

  Map<String, dynamic> toJson() => {
        "chat_id": chatId,
        "user_id": userId,
        "companion_id": companionId,
        "created_at":
            "${createdAt.year.toString().padLeft(4, '0')}-${createdAt.month.toString().padLeft(2, '0')}-${createdAt.day.toString().padLeft(2, '0')}",
        "companion_avatar": companionAvatar,
        "companion_userName": companionUserName,
        "companion_pubKey": companionPubKey,
        "last_message": lastMessage.toJson(),
      };

  @override
  String toString() {
    return 'Chats(chatId: $chatId, companionUserName: "$companionUserName")';
  }
}
