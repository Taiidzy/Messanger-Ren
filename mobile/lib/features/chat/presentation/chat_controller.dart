import 'package:flutter/foundation.dart';

import 'package:Ren/features/chat/data/chat_repository.dart';
import 'package:Ren/core/providers/websocket_provider.dart';
import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/core/models/message.dart';
import 'package:Ren/core/models/chat.dart';

/// Контроллер состояния чата.
/// Держит состояние, оркестрирует загрузку истории и отправку сообщений.
class ChatController extends ChangeNotifier {
  final ChatRepository _repository;
  final WebSocketProvider _wsProvider;
  final CryptoProvider _crypto;

  ChatController({
    required ChatRepository repository,
    required WebSocketProvider wsProvider,
    required CryptoProvider crypto,
  })  : _repository = repository,
        _wsProvider = wsProvider,
        _crypto = crypto;

  Chats? _chat;
  List<Messages> _messages = [];
  bool _isLoading = false;
  String? _error;

  List<Messages> get messages => _messages;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Инициализация контроллера для конкретного чата.
  Future<void> init(Chats chat) async {
    _chat = chat;
    _error = null;
    _isLoading = true;
    notifyListeners();

    try {
      // Инициализируем WebSocket для выбранного чата
      await _wsProvider.initialize(_crypto, chat);
      _wsProvider.addListener(_onWsUpdate);

      // Загружаем историю через репозиторий
      final token = _crypto.token ?? await _crypto.getToken();
      final privKey = _crypto.privateKey;
      final userId = _crypto.userId ?? 0;

      if (token == null || privKey == null) {
        throw StateError('Нет токена или приватного ключа');
      }

      final history = await _repository.fetchHistory(
        chatId: chat.chatId,
        token: token,
        privateKey: privKey,
        userId: userId,
      );

      // Публикуем историю локально и в провайдер (для консистентности)
      for (final m in history) {
        _wsProvider.addMessage(m);
      }

      _mergeMessages();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Отправка текстового сообщения текущему чату.
  Future<bool> sendMessage(String text) async {
    final chat = _chat;
    if (chat == null) return false;

    final selfPub = _crypto.publicKey;
    if (selfPub == null) return false;

    final recipients = _repository.buildRecipients(
      selfUserId: chat.userId,
      selfPublicKey: selfPub,
      companionUserId: chat.companionId,
      companionPubKeyString: chat.companionPubKey,
    );

    final ok = await _wsProvider.sendMessage(text, recipients);
    return ok;
  }

  /// Обновление из WebSocket -> объединяем локальные/входящие сообщения
  void _onWsUpdate() {
    _mergeMessages();
    notifyListeners();
  }

  void _mergeMessages() {
    final chat = _chat;
    if (chat == null) return;

    final wsMsgs = _wsProvider.messages.where((m) => m.chatId == chat.chatId);
    final map = <int, Messages>{};
    for (final m in _messages) {
      map[m.id] = m;
    }
    for (final m in wsMsgs) {
      map[m.id] = m;
    }
    _messages = map.values.toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  }

  @override
  void dispose() {
    _wsProvider.removeListener(_onWsUpdate);
    super.dispose();
  }
}
