import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;

import 'package:Ren/core/utils/constants/apiurl.dart';
import 'package:Ren/core/utils/logger/logger.dart';

class OnlineStatusService {
  WebSocketChannel? _channel;
  bool _isConnected = false;
  bool _isRegistered = false;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  final int _maxReconnectAttempts = 5;

  String? _token;
  List<int> _contacts = [];

  // Stream контроллеры для статусов
  final StreamController<Map<int, UserOnlineStatus>> _statusController =
      StreamController<Map<int, UserOnlineStatus>>.broadcast();
  
  final Map<int, UserOnlineStatus> _userStatuses = {};

  // Геттеры
  bool get isConnected => _isConnected;
  bool get isRegistered => _isRegistered;
  Stream<Map<int, UserOnlineStatus>> get statusStream => _statusController.stream;
  Map<int, UserOnlineStatus> get currentStatuses => Map.from(_userStatuses);

  /// Инициализация сервиса
  Future<void> initialize(String token, List<int> contacts) async {
    _token = token;
    _contacts = contacts;
    
    await connect();
  }

  /// Подключение к WebSocket
  Future<void> connect() async {
    if (_channel != null && _channel!.closeCode == null) {
      logger.w('OnlineStatus WebSocket уже подключен');
      return;
    }

    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    try {
      _channel = WebSocketChannel.connect(Uri.parse(Apiurl.ONLINE_SERVICE));
      _setupEventHandlers();
      
      logger.d('Подключение к OnlineStatus WebSocket: ${Apiurl.ONLINE_SERVICE}');
    } catch (error) {
      logger.e('Ошибка создания OnlineStatus WebSocket соединения: $error');
      _scheduleReconnect();
    }
  }

  /// Настройка обработчиков событий
  void _setupEventHandlers() {
    if (_channel == null) return;

    _channel!.stream.listen(
      _handleMessage,
      onError: (error) {
        logger.e('OnlineStatus WebSocket ошибка: $error');
      },
      onDone: () {
        _isConnected = false;
        _isRegistered = false;
        logger.w('OnlineStatus WebSocket соединение закрыто');

        // Переподключение только если это не намеренное закрытие
        if (_channel?.closeCode != status.normalClosure) {
          _scheduleReconnect();
        }
      },
    );

    // Отправляем регистрацию после подключения
    _isConnected = true;
    _registerForStatus();
  }

  /// Обработка входящих сообщений
  Future<void> _handleMessage(dynamic message) async {
    try {
      final data = json.decode(message);
      final messageType = data['type'];

      switch (messageType) {
        case 'status_registered':
          _isRegistered = true;
          logger.d('OnlineStatus регистрация успешна');
          // Очищаем кэш статусов, ждём актуальные статусы от сервера
          _userStatuses.clear();
          _statusController.add({});
          break;

        case 'contact_status':
          _handleContactStatus(data['data']);
          break;

        case 'status_update':
          _handleStatusUpdate(data['data']);
          break;

        case 'error':
          logger.e('OnlineStatus ошибка сервера: ${data['data']['message']}');
          break;

        default:
          // Некоторые сообщения могут приходить без type, например, просто {"data": {"message": "..."}}
          // или другой формат от сервера. Аккуратно логируем для диагностики.
          logger.w('OnlineStatus неизвестный тип сообщения: $messageType. Полное сообщение: $data');
      }
    } catch (error) {
      logger.e('OnlineStatus ошибка парсинга сообщения: $error');
    }
  }

  /// Обработка статуса контакта при подключении
  void _handleContactStatus(dynamic data) {
    try {
      // Сервер может прислать один объект или массив контактов
      if (data is Map<String, dynamic> && data.containsKey('contacts')) {
        final contacts = (data['contacts'] as List?) ?? [];
        for (final item in contacts) {
          _applySingleStatus(item as Map<String, dynamic>);
        }
      } else if (data is List) {
        for (final item in data) {
          _applySingleStatus(Map<String, dynamic>.from(item));
        }
      } else if (data is Map<String, dynamic>) {
        _applySingleStatus(data);
      } else {
        logger.w('Неизвестный формат contact_status: $data');
      }

      _statusController.add(Map.from(_userStatuses));
    } catch (error) {
      logger.e('Ошибка обработки статуса контакта: $error');
    }
  }

  /// Обработка обновления статуса
  void _handleStatusUpdate(dynamic data) {
    try {
      // Поддерживаем как {contacts: [...]} так и одиночный объект
      if (data is Map<String, dynamic> && data.containsKey('contacts')) {
        final contacts = (data['contacts'] as List?) ?? [];
        for (final item in contacts) {
          _applySingleStatus(item as Map<String, dynamic>);
        }
      } else if (data is List) {
        for (final item in data) {
          _applySingleStatus(Map<String, dynamic>.from(item));
        }
      } else if (data is Map<String, dynamic>) {
        _applySingleStatus(data);
      } else {
        logger.w('Неизвестный формат status_update: $data');
      }

      _statusController.add(Map.from(_userStatuses));
    } catch (error) {
      logger.e('Ошибка обработки обновления статуса: $error');
    }
  }

  /// Применить статус из единичной записи {user_id, status, last_seen}
  void _applySingleStatus(Map<String, dynamic> data) {
    final userId = int.parse(data['user_id'].toString());
    final status = data['status']?.toString() ?? 'offline';
    final lastSeenStr = data['last_seen']?.toString();

    DateTime? lastSeen;
    if (lastSeenStr != null && lastSeenStr.isNotEmpty) {
      try {
        lastSeen = DateTime.parse(lastSeenStr);
      } catch (_) {}
    }

    _userStatuses[userId] = UserOnlineStatus(
      userId: userId,
      // Храним явный статус от сервера
      isOnline: status == 'online',
      lastSeen: lastSeen,
      hasExplicitStatus: true,
    );

    logger.d('Статус пользователя $userId: $status, last_seen: $lastSeen');
  }

  /// Регистрация для отслеживания статуса
  void _registerForStatus() {
    if (_channel == null || _token == null) {
      logger.w('OnlineStatus WebSocket не подключен или нет токена для регистрации');
      return;
    }

    // Сервер ожидает плоский формат без вложенного data
    final registerMessage = {
      'type': 'status_register',
      'token': _token,
      'contacts': _contacts,
    };

    _channel!.sink.add(json.encode(registerMessage));
    logger.d('Отправлена регистрация OnlineStatus для ${_contacts.length} контактов');
  }

  /// Получить статус конкретного пользователя
  bool isUserOnline(int userId) {
    final status = _userStatuses[userId];
    if (status == null) return false;

    // Если сервер прислал явный статус — используем его строго.
    if (status.hasExplicitStatus) {
      return status.isOnline;
    }

    // Фолбэк: если явного статуса нет, но есть last_seen и это было недавно — считаем онлайн.
    if (status.lastSeen != null) {
      final difference = DateTime.now().difference(status.lastSeen!);
      return difference.inMinutes < 2;
    }

    return false;
  }

  /// Получить время последнего посещения
  DateTime? getLastSeen(int userId) {
    return _userStatuses[userId]?.lastSeen;
  }

  /// Обновить список контактов
  Future<void> updateContacts(List<int> contacts) async {
    _contacts = contacts;
    
    if (_isConnected && _isRegistered) {
      // Переподключаемся с новым списком контактов
      await disconnect();
      await connect();
    }
  }

  /// Планирование переподключения
  void _scheduleReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      logger.e('OnlineStatus достигнуто максимальное количество попыток переподключения');
      return;
    }

    _reconnectTimer?.cancel();

    _reconnectAttempts++;
    final delay = Duration(
      milliseconds: (1000 * (1 << _reconnectAttempts)).clamp(1000, 30000),
    );

    logger.w(
      'OnlineStatus попытка переподключения $_reconnectAttempts/$_maxReconnectAttempts '
      'через ${delay.inSeconds} секунд...',
    );

    _reconnectTimer = Timer(delay, () {
      connect();
    });
  }

  /// Отключение
  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    if (_channel != null) {
      _channel!.sink.close(status.normalClosure, 'Пользователь отключился');
      _channel = null;
    }

    _isConnected = false;
    _isRegistered = false;
    _reconnectAttempts = 0;
  }

  /// Освобождение ресурсов
  void dispose() {
    disconnect();
    _statusController.close();
    _userStatuses.clear();
  }
}

/// Модель статуса пользователя
class UserOnlineStatus {
  final int userId;
  final bool isOnline;
  final DateTime? lastSeen;
  final bool hasExplicitStatus;

  UserOnlineStatus({
    required this.userId,
    required this.isOnline,
    this.lastSeen,
    this.hasExplicitStatus = false,
  });

  @override
  String toString() {
    return 'UserOnlineStatus(userId: $userId, isOnline: $isOnline, lastSeen: $lastSeen, hasExplicitStatus: $hasExplicitStatus)';
  }
}
