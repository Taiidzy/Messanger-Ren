import 'dart:convert';
import 'package:hugeicons/hugeicons.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'package:pointycastle/export.dart' hide State, Padding;

import 'package:Ren/core/api/websocket_service.dart';

import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/core/encryption/crypto.dart';
import 'package:Ren/core/models/user.messages.model.dart';
import 'package:Ren/core/models/user.chats.model.dart';

import 'package:Ren/core/providers/websocket_provider.dart';

import 'package:Ren/core/utils/logger/logger.dart';
import 'package:Ren/core/utils/decrypt_messages.dart';
import 'package:Ren/core/utils/logout/logout.dart';
import 'package:Ren/core/utils/constants/apiurl.dart';

import 'package:Ren/ui/theme/themes.dart';

import 'package:Ren/ui/widgets/glassmorphicbutton.dart';
import 'package:Ren/ui/widgets/chat_bubble.dart';
import 'package:Ren/ui/widgets/renlogo.dart';

class ChatScreen extends StatefulWidget {
  final bool hideAppBar;
  final Chats chat;

  const ChatScreen({Key? key, this.hideAppBar = false, required this.chat})
    : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late Chats chat;
  List<Messages> messages = [];
  String? _token;
  bool _isLoading = true;
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  // WebSocket провайдер
  late WebSocketProvider _webSocketProvider;

  // Криптографические ключи
  ECPrivateKey? _privateKey;
  ECPublicKey? _publicKey;

  @override
  void initState() {
    super.initState();
    chat = widget.chat;
    _webSocketProvider = WebSocketProvider();
    _initializeData();
  }

  @override
  void didUpdateWidget(ChatScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.chat.chatId != widget.chat.chatId) {
      setState(() {
        chat = widget.chat;
        _isLoading = true;
        messages = [];
      });
      _initializeData();
    }
  }

  Future<void> _initializeData() async {
    try {
      final cryptoProvider = Provider.of<CryptoProvider>(
        context,
        listen: false,
      );

      String? token = cryptoProvider.token;
      token ??= await cryptoProvider.getToken();

      if (token != null && cryptoProvider.privateKey != null) {
        setState(() {
          _token = token;
          _privateKey = cryptoProvider.privateKey;
          _publicKey = cryptoProvider.publicKey;
        });

        // Инициализируем WebSocket провайдер
        await _webSocketProvider.initialize(cryptoProvider, chat);

        // Подписываемся на изменения сообщений
        _webSocketProvider.addListener(_onWebSocketUpdate);

        // Загружаем существующие сообщения
        final response = await http.get(
          Uri.parse('${Apiurl.CHAT_SERVICE}/chats/${chat.chatId}/messages'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $_token',
          },
        );

        if (response.statusCode == 401) {
          await Logout.logout(context, 0);
          return;
        }

        if (response.statusCode == 200 && mounted) {
          // Парсим JSON напрямую и дешифруем
          final List<dynamic> messagesJson = json.decode(response.body);
          final decryptedMessages =
              await DecryptMessages.decryptMessagesFromServer(
                messagesJson,
                _privateKey!,
                cryptoProvider.userId ?? 0,
              );

          // Добавляем расшифрованные сообщения в WebSocketProvider
          for (final message in decryptedMessages) {
            _webSocketProvider.addMessage(message);
          }

          setState(() {
            messages = decryptedMessages;
            _isLoading = false;
          });
          _scrollToBottom();
        } else if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      }
    } catch (error) {
      logger.e('Error initializing chat: $error');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _onWebSocketUpdate() {
    if (mounted) {
      setState(() {
        // Объединяем локальные сообщения с новыми из WebSocket
        final webSocketMessages =
            _webSocketProvider.messages
                .where((msg) => msg.chatId == chat.chatId)
                .toList();

        // Создаем Map для быстрого поиска по ID
        final Map<int, Messages> messageMap = {};

        // Добавляем существующие сообщения
        for (final msg in messages) {
          messageMap[msg.id] = msg;
        }

        // Добавляем/обновляем сообщения из WebSocket
        for (final msg in webSocketMessages) {
          messageMap[msg.id] = msg;
        }

        // Преобразуем обратно в список и сортируем по времени
        messages =
            messageMap.values.toList()
              ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
      });
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _webSocketProvider.removeListener(_onWebSocketUpdate);
    _webSocketProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasAppBar = Scaffold.maybeOf(context)?.hasAppBar ?? false;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: Colors.transparent,
      appBar:
          (hasAppBar || widget.hideAppBar)
              ? null
              : _buildModernAppBar(context, isDark),
      body: Container(
        decoration: BoxDecoration(
          gradient:
              isDark
                  ? AppGradients.darkBackground
                  : AppGradients.lightBackground,
        ),
        child: Column(
          children: [
            Expanded(
              child:
                  _isLoading
                      ? _buildLoadingState(context, isDark)
                      : messages.isEmpty
                      ? _buildEmptyState(context, isDark)
                      : _buildMessagesWithCustomScroll(context, isDark),
            ),
            _buildMessageInput(context, isDark),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildModernAppBar(BuildContext context, bool isDark) {
    return AppBar(
      elevation: 0,
      backgroundColor: (isDark
              ? AppColors.darkBackground
              : AppColors.lightBackground)
          .withOpacity(0.95),
      flexibleSpace: Container(
        decoration: BoxDecoration(
          gradient: isDark ? AppGradients.glassDark : AppGradients.glassLight,
          border: Border(
            bottom: BorderSide(
              color: isDark ? AppColors.neutral800 : AppColors.neutral200,
              width: 1,
            ),
          ),
        ),
      ),
      title: Text(
        chat.companionUserName,
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w600,
          color: isDark ? AppColors.neutral100 : AppColors.neutral900,
        ),
      ),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, size: 20),
        onPressed: () => Navigator.of(context).pop(),
        color: isDark ? AppColors.neutral300 : AppColors.neutral700,
      ),
      actions: [
        Container(
          margin: const EdgeInsets.only(right: 8),
          decoration: BoxDecoration(
            color:
                isDark
                    ? AppColors.neutral800.withOpacity(0.3)
                    : AppColors.neutral200.withOpacity(0.3),
            borderRadius: BorderRadius.circular(12),
          ),
          child: IconButton(
            onPressed: () {
              // Действия для настроек чата
            },
            icon: const Icon(Icons.more_vert_rounded, size: 20),
            color: isDark ? AppColors.neutral300 : AppColors.neutral700,
          ),
        ),
      ],
    );
  }

  Widget _buildLoadingState(BuildContext context, bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          RenLogo(),
          const SizedBox(height: 24),
          CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2),
          const SizedBox(height: 16),
          Text(
            'Загрузка сообщений...',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: isDark ? AppColors.neutral400 : AppColors.neutral600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, bool isDark) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 32),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkCard : AppColors.lightCard,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isDark ? AppColors.neutral800 : AppColors.neutral200,
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.1 : 0.05),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.primary.withOpacity(0.1),
                    AppColors.secondary.withOpacity(0.1),
                  ],
                ),
                borderRadius: BorderRadius.circular(40),
              ),
              child: Icon(
                Icons.chat_bubble_outline_rounded,
                size: 40,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Пока нет сообщений',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Отправьте первое сообщение, чтобы начать разговор',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: isDark ? AppColors.neutral400 : AppColors.neutral600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessagesWithCustomScroll(BuildContext context, bool isDark) {
    final hasAppBar = Scaffold.maybeOf(context)?.hasAppBar ?? false;
    final appBarHeight =
        (hasAppBar || !widget.hideAppBar)
            ? (kToolbarHeight + MediaQuery.of(context).padding.top)
            : 0.0;

    return NotificationListener<ScrollNotification>(
      onNotification: (scrollNotification) {
        // Обрабатываем скролл без setState для лучшей производительности
        return false; // Позволяем другим виджетам обработать уведомления
      },
      child: CustomScrollView(
        controller: _scrollController,
        slivers: [
          // Динамический отступ в зависимости от позиции скролла
          SliverToBoxAdapter(
            child: SizedBox(
              height: 8.0, // Базовый отступ
            ),
          ),
          // Дополнительный отступ для первого сообщения
          SliverLayoutBuilder(
            builder: (context, constraints) {
              // Получаем информацию о скролле без setState
              final scrollOffset =
                  _scrollController.hasClients ? _scrollController.offset : 0.0;

              // Если мы близко к верху, добавляем дополнительный отступ
              final additionalPadding =
                  scrollOffset <= 100.0 ? appBarHeight : 0.0;

              return SliverToBoxAdapter(
                child: SizedBox(height: additionalPadding),
              );
            },
          ),
          // Список сообщений
          SliverList(
            delegate: SliverChildBuilderDelegate((context, index) {
              final message = messages[index];
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: ChatBubble(
                  message: message,
                  isMe: (message.senderId == chat.userId),
                ),
              );
            }, childCount: messages.length),
          ),
          // Нижний отступ
          SliverToBoxAdapter(child: const SizedBox(height: 8.0)),
        ],
      ),
    );
  }

  Widget _buildMessageInput(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.neutral800 : AppColors.neutral200,
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color:
                      isDark ? AppColors.darkSurface : AppColors.lightSurface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: isDark ? AppColors.neutral700 : AppColors.neutral200,
                  ),
                ),
                child: TextField(
                  controller: _messageController,
                  maxLines: null,
                  textInputAction: TextInputAction.newline,
                  decoration: InputDecoration(
                    hintText: 'Введите сообщение...',
                    hintStyle: TextStyle(
                      color:
                          isDark ? AppColors.neutral400 : AppColors.neutral500,
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                  ),
                  style: TextStyle(
                    color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.secondary],
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: SizedBox(
                width: 50,
                child: GlassmorphicButton(
                  onPressed: () => _sendMessage(),
                  prefixIcon: const HugeIcon(
                    icon: HugeIcons.strokeRoundedTelegram,
                    color: Colors.blue,
                    size: 20.0,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _sendMessage() async {
    final messageText = _messageController.text.trim();
    if (messageText.isEmpty || _token == null || _publicKey == null) return;

    try {
      _messageController.clear();

      // Подготавливаем получателей
      final recipients = <Recipient>[];

      // Добавляем себя
      recipients.add(Recipient(userId: chat.userId, publicKey: _publicKey!));

      // Добавляем собеседника, используя публичный ключ из чата
      try {
        final companionPubKey = Crypto.publicKeyFromString(
          chat.companionPubKey,
        );
        recipients.add(
          Recipient(userId: chat.companionId, publicKey: companionPubKey),
        );
      } catch (e) {
        logger.e('Ошибка парсинга публичного ключа собеседника: $e');
        // Продолжаем без собеседника, сообщение будет отправлено только себе
      }

      // Отправляем сообщение через WebSocket
      final success = await _webSocketProvider.sendMessage(
        messageText,
        recipients,
      );

      if (!success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка отправки сообщения'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      }
    } catch (error) {
      logger.e('Error sending message: $error');

      // Показать ошибку пользователю
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка отправки сообщения'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      }
    }
  }
}
