import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';

import 'package:Ren/core/api/websocket_service.dart';
import 'package:Ren/core/models/websocket_message.dart';
import 'package:Ren/core/models/message.dart';
import 'package:Ren/core/models/chat.dart';
import 'package:Ren/core/models/metadata.dart';
import 'package:Ren/core/models/envelope.dart';
import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/core/utils/logger/logger.dart';

class WebSocketProvider extends ChangeNotifier {
  WebSocketService? _webSocketService;
  WebSocketState _connectionState = WebSocketState(
    isConnected: false,
    isRegistered: false,
  );

  final List<Messages> _messages = [];
  final Map<int, List<UploadProgress>> _uploadProgress = {};
  bool _isUploading = false;

  // Геттеры
  WebSocketState get connectionState => _connectionState;
  List<Messages> get messages => List.unmodifiable(_messages);
  bool get isUploading => _isUploading;

  // Получение прогресса загрузки для конкретного чата
  List<UploadProgress> getUploadProgress(int chatId) {
    return _uploadProgress[chatId] ?? [];
  }

  // Инициализация WebSocket сервиса
  Future<void> initialize(CryptoProvider cryptoProvider, Chats chat) async {
    try {
      final privateKey = cryptoProvider.privateKey;
      final token = cryptoProvider.token;

      if (privateKey == null || token == null) {
        logger.w('Нет ключей для инициализации WebSocket');
        return;
      }

      // Отключаем предыдущий сервис, если был
      _webSocketService?.disconnect();

      final userData = UserData(
        userId: cryptoProvider.userId ?? 0,
        chatId: chat.chatId,
        privateKey: privateKey,
      );

      final handlers = MessageHandlers(
        onMessageReceived: _handleMessageReceived,
        onConnectionChange: _handleConnectionChange,
        onRegistrationChange: _handleRegistrationChange,
        onError: _handleError,
        onMessageDeleted: _handleMessageDeleted,
        onMessageEdited: _handleMessageEdited,
      );

      _webSocketService = WebSocketService(
        userData: userData,
        token: token,
        handlers: handlers,
      );

      // Подписываемся на изменения состояния
      _webSocketService!.stateStream.listen((state) {
        _connectionState = state;
        notifyListeners();
      });

      // Подключаемся
      await _webSocketService!.connect();
    } catch (error) {
      logger.e('Ошибка инициализации WebSocket: $error');
    }
  }

  // Публичный метод для добавления сообщений (например, при загрузке истории)
  void addMessage(Messages message) {
    _handleMessageReceived(message);
  }

  // Обработка полученного сообщения
  void _handleMessageReceived(Messages message) {
    logger.d('Получено сообщение: ${message.id}');

    // Ищем существующее сообщение по ID
    final existingIndex = _messages.indexWhere((msg) => msg.id == message.id);

    if (existingIndex != -1) {
      // Обновляем существующее сообщение
      _messages[existingIndex] = message.copyWith(status: 'sent');
    } else {
      // Добавляем новое сообщение
      _messages.add(message);
    }

    notifyListeners();
  }

  // Обработка изменения соединения
  void _handleConnectionChange(bool isConnected) {
    logger.d('WebSocket соединение: $isConnected');
    _connectionState = _connectionState.copyWith(isConnected: isConnected);
    notifyListeners();
  }

  // Обработка изменения регистрации
  void _handleRegistrationChange(bool isRegistered) {
    logger.d('WebSocket регистрация: $isRegistered');
    _connectionState = _connectionState.copyWith(isRegistered: isRegistered);
    notifyListeners();
  }

  // Обработка ошибок
  void _handleError(String error) {
    logger.e('WebSocket ошибка: $error');
    _connectionState = _connectionState.copyWith(error: error);
    notifyListeners();
  }

  // Обработка удаленного сообщения
  void _handleMessageDeleted(int messageId) {
    logger.d('Удалено сообщение: $messageId');
    _messages.removeWhere((msg) => msg.id == messageId);
    notifyListeners();
  }

  // Обработка отредактированного сообщения
  void _handleMessageEdited(Messages editedMessage) {
    logger.d('Отредактировано сообщение: ${editedMessage.id}');

    final index = _messages.indexWhere((msg) => msg.id == editedMessage.id);
    if (index != -1) {
      _messages[index] = editedMessage;
      notifyListeners();
    }
  }

  // Отправка текстового сообщения
  Future<bool> sendMessage(
    String messageText,
    List<Recipient> recipients,
  ) async {
    if (_webSocketService == null) {
      logger.e('WebSocket сервис не инициализирован');
      return false;
    }

    return await _webSocketService!.sendMessage(messageText, recipients);
  }

  // Отправка сообщения с файлами
  Future<bool> sendMessageWithFiles(
    String message,
    List<File> files,
    List<Recipient> recipients,
    int chatId,
  ) async {
    if (_webSocketService == null) {
      logger.e('WebSocket сервис не инициализирован');
      return false;
    }

    _isUploading = true;
    notifyListeners();

    try {
      final result = await _webSocketService!.sendMessageWithFiles(
        message,
        files,
        recipients,
        (progress) {
          _uploadProgress[chatId] = progress;
          notifyListeners();
        },
        DateTime.now().millisecondsSinceEpoch,
      );

      return result;
    } finally {
      _isUploading = false;
      _uploadProgress.remove(chatId);
      notifyListeners();
    }
  }

  // Удаление сообщения
  Future<bool> deleteMessage(int messageId, List<Metadata>? metadata) async {
    if (_webSocketService == null) {
      logger.e('WebSocket сервис не инициализирован');
      return false;
    }

    return await _webSocketService!.deleteMessage(messageId, metadata);
  }

  // Редактирование сообщения
  Future<bool> editMessage(
    int messageId,
    String newText,
    List<Recipient> recipients,
    String? messageType,
  ) async {
    if (_webSocketService == null) {
      logger.e('WebSocket сервис не инициализирован');
      return false;
    }

    return await _webSocketService!.editMessage(
      messageId,
      newText,
      recipients,
      messageType,
    );
  }

  // Загрузка сообщений для чата
  void loadMessagesForChat(int chatId) {
    // Фильтруем сообщения по chatId
    // Здесь можно добавить логику загрузки из локального хранилища или API
  }

  // Очистка сообщений для чата
  void clearMessagesForChat(int chatId) {
    _messages.removeWhere((msg) => msg.chatId == chatId);
    notifyListeners();
  }

  // Отключение
  void disconnect() {
    _webSocketService?.disconnect();
    _webSocketService = null;
    _connectionState = WebSocketState(isConnected: false, isRegistered: false);
    notifyListeners();
  }

  // Освобождение ресурсов
  @override
  void dispose() {
    _webSocketService?.dispose();
    super.dispose();
  }
}

// Расширение для Messages с методом copyWith
extension MessagesCopyWith on Messages {
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
    );
  }
}
