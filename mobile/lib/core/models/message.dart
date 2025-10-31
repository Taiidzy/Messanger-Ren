import 'dart:convert';

import 'package:Ren/core/models/envelope.dart';
import 'package:Ren/core/models/metadata.dart';

List<Messages> chatFromJson(String str) =>
    List<Messages>.from(json.decode(str).map((x) => Messages.fromJson(x)));

String chatToJson(List<Messages> data) =>
    json.encode(List<dynamic>.from(data.map((x) => x.toJson())));

class Messages {
  final int id;
  final int chatId;
  final int senderId;
  final String message; // Может быть расшифрованным текстом или пустым, если есть ciphertext
  final String messageType;
  final List<Metadata>? metadata;
  final DateTime createdAt;
  final DateTime? editedAt;
  final bool isRead;
  final bool hasFiles;
  final String status; // 'sent', 'pending', 'error'
  final Map<String, Envelope>? envelopes; // Для совместимости с сервером
  final String? ciphertext; // Зашифрованный текст, если приходит с сервера
  final String? nonce; // IV для AES-GCM текста

  Messages({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.message,
    required this.messageType,
    this.metadata,
    required this.createdAt,
    this.editedAt,
    required this.isRead,
    this.hasFiles = false,
    this.status = 'sent',
    this.envelopes,
    this.ciphertext,
    this.nonce,
  });

  factory Messages.fromJson(Map<String, dynamic> json) => Messages(
        id: json["id"],
        chatId: json["chat_id"],
        senderId: json["sender_id"],
        message: json["message"] ?? "",
        messageType: json["message_type"],
        metadata: json["metadata"] == null
            ? null
            : List<Metadata>.from(json["metadata"].map((x) => Metadata.fromJson(x))),
        createdAt: DateTime.parse(json["created_at"]),
        editedAt: json["edited_at"] != null ? DateTime.parse(json["edited_at"]) : null,
        isRead: json["is_read"] ?? false,
        hasFiles: json["hasFiles"] ??
            (json["message_type"] == "file" || json["message_type"] == "message_with_files"),
        status: json["status"] ?? "sent",
        envelopes: json["envelopes"] != null
            ? Map.from(json["envelopes"]).map((k, v) => MapEntry<String, Envelope>(k, Envelope.fromJson(v)))
            : null,
        ciphertext: json["ciphertext"],
        nonce: json["nonce"],
      );

  Map<String, dynamic> toJson() => {
        "id": id,
        "chat_id": chatId,
        "sender_id": senderId,
        "message": message,
        "message_type": messageType,
        "metadata": metadata == null ? null : List<dynamic>.from(metadata!.map((x) => x.toJson())),
        "created_at": createdAt.toIso8601String(),
        "edited_at": editedAt?.toIso8601String(),
        "is_read": isRead,
        "hasFiles": hasFiles,
        "status": status,
        "envelopes": envelopes != null
            ? Map.from(envelopes!).map((k, v) => MapEntry<String, dynamic>(k, v.toJson()))
            : null,
        "ciphertext": ciphertext,
        "nonce": nonce,
      };

  Messages copyWith({
    int? id,
    int? chatId,
    int? senderId,
    String? message,
    String? messageType,
    List<Metadata>? metadata,
    DateTime? createdAt,
    DateTime? editedAt,
    bool? isRead,
    bool? hasFiles,
    String? status,
    Map<String, Envelope>? envelopes,
    String? ciphertext,
    String? nonce,
  }) {
    return Messages(
      id: id ?? this.id,
      chatId: chatId ?? this.chatId,
      senderId: senderId ?? this.senderId,
      message: message ?? this.message,
      messageType: messageType ?? this.messageType,
      metadata: metadata ?? this.metadata,
      createdAt: createdAt ?? this.createdAt,
      editedAt: editedAt ?? this.editedAt,
      isRead: isRead ?? this.isRead,
      hasFiles: hasFiles ?? this.hasFiles,
      status: status ?? this.status,
      envelopes: envelopes ?? this.envelopes,
      ciphertext: ciphertext ?? this.ciphertext,
      nonce: nonce ?? this.nonce,
    );
  }
}
