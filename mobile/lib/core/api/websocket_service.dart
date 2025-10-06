import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;
import 'package:pointycastle/export.dart';

import 'package:Ren/core/models/websocket_message.dart';
import 'package:Ren/core/models/user.messages.model.dart';
import 'package:Ren/core/models/envelope.dart';
import 'package:Ren/core/models/metadata.dart';
import 'package:Ren/core/encryption/crypto.dart';
import 'package:Ren/core/utils/constants/apiurl.dart';
import 'package:Ren/core/utils/logger/logger.dart';

class WebSocketService {
  WebSocketChannel? _channel;
  bool _isConnected = false;
  bool _isRegistered = false;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  final int _maxReconnectAttempts = 5;

  final UserData _userData;
  final String _token;
  MessageHandlers _handlers;

  // Stream контроллеры для состояния
  final StreamController<WebSocketState> _stateController =
      StreamController<WebSocketState>.broadcast();

  WebSocketService({
    required UserData userData,
    required String token,
    MessageHandlers? handlers,
  }) : _userData = userData,
       _token = token,
       _handlers = handlers ?? MessageHandlers();

  // Геттеры
  bool get isConnected => _isConnected;
  bool get isRegistered => _isRegistered;
  Stream<WebSocketState> get stateStream => _stateController.stream;

  // Подключение к WebSocket
  Future<void> connect() async {
    if (_channel != null &&
        (_channel!.closeCode == null ||
            _channel!.closeCode == status.goingAway)) {
      logger.w('WebSocket уже подключен или подключается');
      return;
    }

    // Останавливаем предыдущие попытки переподключения
    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    try {
      _channel = WebSocketChannel.connect(Uri.parse(Apiurl.MESSAGE_SERVICE));
      _setupEventHandlers();
    } catch (error) {
      logger.e('Ошибка создания WebSocket соединения: $error');
      _handlers.onError?.call('Ошибка создания соединения');
      _scheduleReconnect();
    }
  }

  // Настройка обработчиков событий
  void _setupEventHandlers() {
    if (_channel == null) return;

    _channel!.stream.listen(
      _handleMessage,
      onError: (error) {
        logger.e('WebSocket ошибка: $error');
        // Не изменяем состояние здесь, это сделает onDone
      },
      onDone: () {
        _isConnected = false;
        _isRegistered = false;
        _updateState();
        _handlers.onConnectionChange?.call(false);
        _handlers.onRegistrationChange?.call(false);

        // Переподключение только если это не намеренное закрытие
        if (_channel?.closeCode != status.normalClosure) {
          _scheduleReconnect();
        }
      },
    );

    // Отправляем регистрацию после подключения
    _isConnected = true;
    _updateState();
    _handlers.onConnectionChange?.call(true);
    _registerUser();
  }

  // Обработка входящих сообщений
  Future<void> _handleMessage(dynamic message) async {
    try {
      final data = json.decode(message);
      final incomingMessage = IncomingMessage.fromJson(data);

      switch (incomingMessage.type) {
        case 'registered':
          _isRegistered = true;
          _updateState();
          _handlers.onRegistrationChange?.call(true);
          break;

        case 'new_message':
          await _handleNewMessage(incomingMessage.data);
          break;

        case 'message_deleted':
          _handleMessageDeleted(incomingMessage.data);
          break;

        case 'message_edited':
          await _handleMessageEdited(incomingMessage.data);
          break;

        case 'error':
          logger.e('Ошибка сервера: ${incomingMessage.data['message']}');
          _handlers.onError?.call(incomingMessage.data['message']);
          break;

        default:
          logger.w('Неизвестный тип сообщения: $data');
      }
    } catch (error) {
      logger.e('Ошибка парсинга сообщения: $error');
      _handlers.onError?.call('Ошибка обработки сообщения');
    }
  }

  // Обработка нового сообщения
  Future<void> _handleNewMessage(dynamic data) async {
    try {
      final messageData = MessageData.fromJson(data);
      final privateKey = _userData.privateKey as ECPrivateKey?;

      if (privateKey == null) {
        _handlers.onError?.call(
          'Приватный ключ отсутствует, не могу расшифровать сообщение.',
        );
        return;
      }

      // Находим envelope для текущего пользователя
      Envelope? envelope;
      final envelopes = messageData.envelopes;
      final userIdStr = _userData.userId.toString();
      final userIdNum = _userData.userId;

      if (envelopes.containsKey(userIdStr)) {
        envelope = Envelope.fromJson(envelopes[userIdStr]);
      } else if (envelopes.containsKey(userIdNum.toString())) {
        envelope = Envelope.fromJson(envelopes[userIdNum.toString()]);
      }

      if (envelope == null) {
        _handlers.onError?.call(
          'Конверт для пользователя ${_userData.userId} не найден. '
          'Доступные ключи: ${envelopes.keys.toList()}',
        );
        return;
      }

      // Расшифровываем ключ сообщения
      final messageKey = Crypto.unwrapSymmetricKey(
        envelope.key,
        envelope.ephemPubKey,
        envelope.iv,
        privateKey,
      );

      String decryptedText = '';

      // Обрабатываем разные типы сообщений
      if (messageData.messageType == 'text') {
        if (messageData.ciphertext.isNotEmpty && messageData.nonce.isNotEmpty) {
          decryptedText = Crypto.decryptData(
            messageData.ciphertext,
            messageKey,
            messageData.nonce,
          );
        }
      } else if (messageData.messageType == 'message_with_files') {
        if (messageData.ciphertext.isNotEmpty && messageData.nonce.isNotEmpty) {
          decryptedText = Crypto.decryptData(
            messageData.ciphertext,
            messageKey,
            messageData.nonce,
          );
        }
      } else if (messageData.messageType == 'file') {
        decryptedText = '';
      }

      // Создаем объект сообщения
      final decryptedMessage = Messages(
        id: messageData.id,
        chatId: messageData.chatId,
        senderId: messageData.senderId,
        message: decryptedText,
        messageType: messageData.messageType,
        metadata: messageData.metadata,
        createdAt: DateTime.parse(messageData.createdAt),
        editedAt:
            messageData.editedAt != null
                ? DateTime.parse(messageData.editedAt!)
                : null,
        isRead: messageData.isRead,
        hasFiles:
            messageData.messageType == "file" ||
            messageData.messageType == "message_with_files",
        status: "sent",
        envelopes: messageData.envelopes.map(
          (k, v) => MapEntry(k, Envelope.fromJson(v)),
        ),
      );

      _handlers.onMessageReceived?.call(decryptedMessage);
    } catch (error) {
      logger.e('Ошибка расшифровки сообщения: $error');
      _handlers.onError?.call('Не удалось расшифровать входящее сообщение.');
    }
  }

  // Обработка удаленного сообщения
  void _handleMessageDeleted(dynamic data) {
    final deletedId = data['message_id'] ?? data['id'] ?? data;
    if (deletedId is int) {
      _handlers.onMessageDeleted?.call(deletedId);
    }
  }

  // Обработка отредактированного сообщения
  Future<void> _handleMessageEdited(dynamic data) async {
    try {
      final messageData = MessageData.fromJson(data);
      final privateKey = _userData.privateKey as ECPrivateKey?;

      if (privateKey == null) {
        _handlers.onError?.call(
          'Приватный ключ отсутствует, не могу расшифровать отредактированное сообщение.',
        );
        return;
      }

      // Находим envelope для текущего пользователя
      Envelope? envelope;
      final envelopes = messageData.envelopes;
      final userIdStr = _userData.userId.toString();
      final userIdNum = _userData.userId;

      if (envelopes.containsKey(userIdStr)) {
        envelope = Envelope.fromJson(envelopes[userIdStr]);
      } else if (envelopes.containsKey(userIdNum.toString())) {
        envelope = Envelope.fromJson(envelopes[userIdNum.toString()]);
      }

      if (envelope == null) {
        _handlers.onError?.call(
          'Конверт для пользователя ${_userData.userId} не найден при редактировании.',
        );
        return;
      }

      // Расшифровываем ключ сообщения
      final messageKey = Crypto.unwrapSymmetricKey(
        envelope.key,
        envelope.ephemPubKey,
        envelope.iv,
        privateKey,
      );

      String decryptedText = '';
      if (messageData.ciphertext.isNotEmpty && messageData.nonce.isNotEmpty) {
        decryptedText = Crypto.decryptData(
          messageData.ciphertext,
          messageKey,
          messageData.nonce,
        );
      }

      // Создаем объект сообщения
      final decryptedMessage = Messages(
        id: messageData.id,
        chatId: messageData.chatId,
        senderId: messageData.senderId,
        message: decryptedText,
        messageType: messageData.messageType,
        metadata: messageData.metadata,
        createdAt: DateTime.parse(messageData.createdAt),
        editedAt:
            messageData.editedAt != null
                ? DateTime.parse(messageData.editedAt!)
                : null,
        isRead: messageData.isRead,
        hasFiles:
            messageData.messageType == "file" ||
            messageData.messageType == "message_with_files",
        status: "sent",
        envelopes: messageData.envelopes.map(
          (k, v) => MapEntry(k, Envelope.fromJson(v)),
        ),
      );

      _handlers.onMessageEdited?.call(decryptedMessage);
    } catch (error) {
      logger.e('Ошибка расшифровки отредактированного сообщения: $error');
      _handlers.onError?.call(
        'Не удалось расшифровать отредактированное сообщение.',
      );
    }
  }

  // Регистрация пользователя
  void _registerUser() {
    if (_channel == null) {
      logger.w('WebSocket не подключен для регистрации');
      return;
    }

    final registerMessage = RegisterMessage(
      token: _token,
      chatId: _userData.chatId,
    );

    _channel!.sink.add(json.encode(registerMessage.toJson()));
  }

  // Отправка текстового сообщения
  Future<bool> sendMessage(
    String messageText,
    List<Recipient> recipients,
  ) async {
    if (!_isConnected ||
        !_isRegistered ||
        messageText.trim().isEmpty ||
        recipients.isEmpty) {
      logger.w(
        'Невозможно отправить сообщение: socketConnected=$_isConnected, userRegistered=$_isRegistered, messageText=${messageText.trim()}, hasRecipients=${recipients.isNotEmpty}',
      );
      return false;
    }

    try {
      final messageKey = Crypto.generateMessageEncryptionKey();
      final encryptedMessage = Crypto.encryptMessage(messageText, messageKey);

      final envelopes = <String, Map<String, String>>{};

      for (final recipient in recipients) {
        final wrappedKey = Crypto.wrapSymmetricKey(
          messageKey,
          recipient.publicKey,
        );

        envelopes[recipient.userId.toString()] = {
          'key': wrappedKey.wrappedKey,
          'ephemPubKey': wrappedKey.ephemeralPublicKey,
          'iv': wrappedKey.iv,
        };
      }

      final messageData = MessageData(
        id: DateTime.now().millisecondsSinceEpoch,
        chatId: _userData.chatId,
        senderId: _userData.userId,
        ciphertext: encryptedMessage.ciphertext,
        nonce: encryptedMessage.nonce,
        envelopes: envelopes,
        messageType: 'text',
        metadata: null,
        createdAt: DateTime.now().toIso8601String(),
        editedAt: null,
        isRead: false,
      );

      final sendMessage = SendMessageData(data: messageData);
      _channel!.sink.add(json.encode(sendMessage.toJson()));
      return true;
    } catch (error) {
      logger.e('Ошибка при шифровании или отправке сообщения: $error');
      _handlers.onError?.call('Ошибка шифрования сообщения');
      return false;
    }
  }

  // Отправка сообщения с файлами
  Future<bool> sendMessageWithFiles(
    String message,
    List<File> files,
    List<Recipient> recipients,
    Function(List<UploadProgress>)? onProgress,
    int? pendingId,
  ) async {
    if (!_isConnected ||
        !_isRegistered ||
        files.isEmpty ||
        recipients.isEmpty) {
      logger.w(
        'Невозможно отправить сообщение с файлами: socketConnected=$_isConnected, userRegistered=$_isRegistered, hasMessage=${message.trim().isNotEmpty}, filesCount=${files.length}, hasRecipients=${recipients.isNotEmpty}',
      );
      return false;
    }

    try {
      // Создаем один общий ключ для сообщения и всех файлов
      final messageKey = Crypto.generateMessageEncryptionKey();

      // Шифруем текстовое сообщение (если оно есть)
      EncryptedMessage encryptedMessage = EncryptedMessage(
        ciphertext: '',
        nonce: '',
      );
      if (message.trim().isNotEmpty) {
        encryptedMessage = Crypto.encryptMessage(message, messageKey);
      }

      // Создаем envelopes один раз для всего
      final envelopes = <String, Map<String, String>>{};

      for (final recipient in recipients) {
        final wrappedKey = Crypto.wrapSymmetricKey(
          messageKey,
          recipient.publicKey,
        );

        envelopes[recipient.userId.toString()] = {
          'key': wrappedKey.wrappedKey,
          'ephemPubKey': wrappedKey.ephemeralPublicKey,
          'iv': wrappedKey.iv,
        };
      }

      // Обработка файлов
      final progressArray = <UploadProgress>[];
      final metadataArray = <Metadata>[];

      for (int i = 0; i < files.length; i++) {
        final file = files[i];
        final progress = UploadProgress(
          fileId: DateTime.now().millisecondsSinceEpoch + i,
          fileName: file.path.split('/').last,
          uploaded: 0,
          total: await file.length(),
          percentage: 0.0,
          status: 'pending',
        );
        progressArray.add(progress);
      }

      onProgress?.call(progressArray);

      for (int i = 0; i < files.length; i++) {
        final file = files[i];
        final progress = progressArray[i];

        try {
          progressArray[i] = progress.copyWith(status: 'uploading');
          onProgress?.call(progressArray);

          final fileData = await file.readAsBytes();
          final encryptedFile = Crypto.encryptFile(
            fileData,
            file.path.split('/').last,
            'application/octet-stream', // TODO: определить MIME тип
            messageKey,
          );

          metadataArray.add(
            Metadata(
              size: fileData.length,
              nonce: encryptedFile.nonce,
              fileId: progress.fileId,
              filename: file.path.split('/').last,
              mimetype: 'application/octet-stream',
              fileCreationDate: DateTime.now(),
            ),
          );

          progressArray[i] = progress.copyWith(
            status: 'completed',
            percentage: 100.0,
            uploaded: fileData.length,
          );
          onProgress?.call(progressArray);
        } catch (error) {
          progressArray[i] = progress.copyWith(
            status: 'error',
            error: error.toString(),
          );
          onProgress?.call(progressArray);
          logger.e('Ошибка при шифровании файла ${file.path}: $error');
          continue;
        }
      }

      // Проверяем, что есть хотя бы один успешно загруженный файл
      if (metadataArray.isEmpty) {
        logger.w('Нет успешно загруженных файлов, отменяем отправку');
        _handlers.onError?.call('Не удалось загрузить ни одного файла');
        return false;
      }

      // Отправляем сообщение через WebSocket
      final messageData = MessageData(
        id: pendingId ?? DateTime.now().millisecondsSinceEpoch,
        ciphertext: encryptedMessage.ciphertext,
        nonce: encryptedMessage.nonce,
        chatId: _userData.chatId,
        senderId: _userData.userId,
        envelopes: envelopes,
        messageType: 'message_with_files',
        metadata: metadataArray,
        createdAt: DateTime.now().toIso8601String(),
        editedAt: null,
        isRead: false,
      );

      final sendMessage = SendMessageData(data: messageData);
      _channel!.sink.add(json.encode(sendMessage.toJson()));
      return true;
    } catch (error) {
      logger.e('Ошибка при отправке сообщения с файлами: $error');
      _handlers.onError?.call('Ошибка отправки: ${error.toString()}');
      return false;
    }
  }

  // Удаление сообщения
  Future<bool> deleteMessage(int messageId, List<Metadata>? metadata) async {
    if (!_isConnected || !_isRegistered) {
      _handlers.onError?.call('Нет соединения для удаления сообщения');
      return false;
    }

    try {
      final deleteMessage = DeleteMessageData(
        chatId: _userData.chatId,
        messageId: messageId,
      );

      _channel!.sink.add(json.encode(deleteMessage.toJson()));
      return true;
    } catch (error) {
      logger.e('Ошибка отправки запроса на удаление: $error');
      _handlers.onError?.call(
        'Не удалось отправить запрос на удаление сообщения',
      );
      return false;
    }
  }

  // Редактирование сообщения
  Future<bool> editMessage(
    int messageId,
    String newText,
    List<Recipient> recipients,
    String? messageType,
  ) async {
    if (!_isConnected || !_isRegistered) {
      _handlers.onError?.call('Нет соединения для редактирования сообщения');
      return false;
    }

    try {
      final messageKey = Crypto.generateMessageEncryptionKey();
      final encryptedMessage = Crypto.encryptMessage(newText, messageKey);

      final envelopes = <String, Map<String, String>>{};
      for (final recipient in recipients) {
        final wrappedKey = Crypto.wrapSymmetricKey(
          messageKey,
          recipient.publicKey,
        );

        envelopes[recipient.userId.toString()] = {
          'key': wrappedKey.wrappedKey,
          'ephemPubKey': wrappedKey.ephemeralPublicKey,
          'iv': wrappedKey.iv,
        };
      }

      final messageData = MessageData(
        id: messageId,
        chatId: _userData.chatId,
        senderId: _userData.userId,
        ciphertext: encryptedMessage.ciphertext,
        nonce: encryptedMessage.nonce,
        envelopes: envelopes,
        messageType: messageType ?? 'text',
        metadata: null,
        createdAt: DateTime.now().toIso8601String(),
        editedAt: DateTime.now().toIso8601String(),
        isRead: false,
      );

      final editMessage = EditMessageData(data: messageData);
      _channel!.sink.add(json.encode(editMessage.toJson()));
      return true;
    } catch (error) {
      logger.e('Ошибка при подготовке/отправке редактирования: $error');
      _handlers.onError?.call('Не удалось отправить редактирование сообщения');
      return false;
    }
  }

  // Планирование переподключения
  void _scheduleReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      logger.e('Достигнуто максимальное количество попыток переподключения');
      _handlers.onError?.call('Не удалось подключиться к серверу');
      return;
    }

    _reconnectTimer?.cancel();

    _reconnectAttempts++;
    final delay = Duration(
      milliseconds:
          (1000 * math.pow(2, _reconnectAttempts)).clamp(1000, 30000).toInt(),
    );

    logger.w(
      'Попытка переподключения $_reconnectAttempts/$_maxReconnectAttempts '
      'через ${delay.inSeconds} секунд...',
    );

    _reconnectTimer = Timer(delay, () {
      connect();
    });
  }

  // Обновление состояния
  void _updateState() {
    _stateController.add(
      WebSocketState(isConnected: _isConnected, isRegistered: _isRegistered),
    );
  }

  // Обновление обработчиков
  void updateHandlers(MessageHandlers handlers) {
    _handlers = handlers;
  }

  // Обновление данных пользователя
  void updateUserData(UserData userData) {
    // В реальном приложении здесь может потребоваться переподключение
    // если изменились критичные данные
  }

  // Отключение
  void disconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    if (_channel != null) {
      _channel!.sink.close(status.normalClosure, 'Пользователь отключился');
      _channel = null;
    }

    _isConnected = false;
    _isRegistered = false;
    _reconnectAttempts = 0;
    _updateState();
    _handlers.onConnectionChange?.call(false);
    _handlers.onRegistrationChange?.call(false);
  }

  // Получение состояния соединения
  WebSocketState getConnectionState() {
    return WebSocketState(
      isConnected: _isConnected,
      isRegistered: _isRegistered,
    );
  }

  // Освобождение ресурсов
  void dispose() {
    disconnect();
    _stateController.close();
  }
}

// Класс для получателя сообщения
class Recipient {
  final int userId;
  final ECPublicKey publicKey;

  Recipient({required this.userId, required this.publicKey});
}
