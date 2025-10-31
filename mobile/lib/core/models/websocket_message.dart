import 'package:Ren/core/models/message.dart';
import 'package:Ren/core/models/metadata.dart';

// Базовый класс для WebSocket сообщений
abstract class WebSocketMessage {
  final String type;

  WebSocketMessage({required this.type});

  Map<String, dynamic> toJson();
}

// Сообщение для регистрации
class RegisterMessage extends WebSocketMessage {
  final String token;
  final int chatId;

  RegisterMessage({required this.token, required this.chatId})
    : super(type: 'register');

  @override
  Map<String, dynamic> toJson() => {
    'type': type,
    'token': token,
    'chat_id': chatId,
  };
}

// Данные для отправки сообщения
class MessageData {
  final int id;
  final int chatId;
  final int senderId;
  final String ciphertext;
  final String nonce;
  final Map<String, dynamic> envelopes;
  final String messageType;
  final List<Metadata>? metadata;
  final String createdAt;
  final String? editedAt;
  final bool isRead;

  MessageData({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.ciphertext,
    required this.nonce,
    required this.envelopes,
    required this.messageType,
    this.metadata,
    required this.createdAt,
    this.editedAt,
    required this.isRead,
  });

  factory MessageData.fromJson(Map<String, dynamic> json) => MessageData(
    id: json['id'],
    chatId: json['chat_id'],
    senderId: json['sender_id'],
    ciphertext: json['ciphertext'],
    nonce: json['nonce'],
    envelopes: Map<String, dynamic>.from(json['envelopes']),
    messageType: json['message_type'],
    metadata:
        json['metadata'] != null
            ? List<Metadata>.from(
              json['metadata'].map((x) => Metadata.fromJson(x)),
            )
            : null,
    createdAt: json['created_at'],
    editedAt: json['edited_at'],
    isRead: json['is_read'],
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'chat_id': chatId,
    'sender_id': senderId,
    'ciphertext': ciphertext,
    'nonce': nonce,
    'envelopes': envelopes,
    'message_type': messageType,
    'metadata': metadata?.map((x) => x.toJson()).toList(),
    'created_at': createdAt,
    'edited_at': editedAt,
    'is_read': isRead,
  };
}

// Сообщение для отправки текста
class SendMessageData extends WebSocketMessage {
  final MessageData data;

  SendMessageData({required this.data}) : super(type: 'message');

  @override
  Map<String, dynamic> toJson() => {'type': type, 'data': data.toJson()};
}

// Сообщение для удаления
class DeleteMessageData extends WebSocketMessage {
  final int chatId;
  final int messageId;

  DeleteMessageData({required this.chatId, required this.messageId})
    : super(type: 'delete_message');

  @override
  Map<String, dynamic> toJson() => {
    'type': type,
    'data': {'chat_id': chatId, 'message_id': messageId},
  };
}

// Сообщение для редактирования
class EditMessageData extends WebSocketMessage {
  final MessageData data;

  EditMessageData({required this.data}) : super(type: 'edit_message');

  @override
  Map<String, dynamic> toJson() => {'type': type, 'data': data.toJson()};
}

// Входящие сообщения
class IncomingMessage {
  final String type;
  final dynamic data;

  IncomingMessage({required this.type, this.data});

  factory IncomingMessage.fromJson(Map<String, dynamic> json) =>
      IncomingMessage(type: json['type'], data: json['data']);
}

// Состояние WebSocket соединения
class WebSocketState {
  final bool isConnected;
  final bool isRegistered;
  final String? error;

  WebSocketState({
    required this.isConnected,
    required this.isRegistered,
    this.error,
  });

  WebSocketState copyWith({
    bool? isConnected,
    bool? isRegistered,
    String? error,
  }) => WebSocketState(
    isConnected: isConnected ?? this.isConnected,
    isRegistered: isRegistered ?? this.isRegistered,
    error: error ?? this.error,
  );
}

// Обработчики сообщений
class MessageHandlers {
  final Function(Messages)? onMessageReceived;
  final Function(bool)? onConnectionChange;
  final Function(bool)? onRegistrationChange;
  final Function(String)? onError;
  final Function(int)? onMessageDeleted;
  final Function(Messages)? onMessageEdited;

  MessageHandlers({
    this.onMessageReceived,
    this.onConnectionChange,
    this.onRegistrationChange,
    this.onError,
    this.onMessageDeleted,
    this.onMessageEdited,
  });
}

// Данные пользователя для WebSocket
class UserData {
  final int userId;
  final int chatId;
  final dynamic privateKey; // ECPrivateKey

  UserData({
    required this.userId,
    required this.chatId,
    required this.privateKey,
  });
}

// Прогресс загрузки файла
class UploadProgress {
  final int fileId;
  final String fileName;
  final int uploaded;
  final int total;
  final double percentage;
  final String status; // 'pending', 'uploading', 'completed', 'error'
  final String? error;

  UploadProgress({
    required this.fileId,
    required this.fileName,
    required this.uploaded,
    required this.total,
    required this.percentage,
    required this.status,
    this.error,
  });

  UploadProgress copyWith({
    int? fileId,
    String? fileName,
    int? uploaded,
    int? total,
    double? percentage,
    String? status,
    String? error,
  }) => UploadProgress(
    fileId: fileId ?? this.fileId,
    fileName: fileName ?? this.fileName,
    uploaded: uploaded ?? this.uploaded,
    total: total ?? this.total,
    percentage: percentage ?? this.percentage,
    status: status ?? this.status,
    error: error ?? this.error,
  );
}
