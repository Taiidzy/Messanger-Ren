import 'package:hugeicons/hugeicons.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/core/models/message.dart';
import 'package:Ren/core/models/chat.dart';

import 'package:Ren/core/api/chat_api.dart';
import 'package:Ren/core/crypto/message_cipher_service.dart';
import 'package:Ren/features/chat/data/chat_repository.dart';
import 'package:Ren/core/providers/websocket_provider.dart';

import 'package:Ren/core/utils/logger/logger.dart';

import 'package:Ren/ui/theme/themes.dart';

import 'package:Ren/ui/widgets/glassmorphicbutton.dart';
import 'package:Ren/features/chat/presentation/widgets/chat_bubble.dart';
import 'package:Ren/ui/widgets/renlogo.dart';
import 'package:Ren/features/chat/presentation/chat_controller.dart';

class ChatScreen extends StatefulWidget {
  final bool hideAppBar;
  final Chats chat;

  const ChatScreen({Key? key, this.hideAppBar = false, required this.chat}) : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late Chats chat;
  List<Messages> messages = [];
  bool _isLoading = true;
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  // Контроллер чата (содержит бизнес-логику)
  late ChatController _controller;
  late VoidCallback _controllerListener;

  @override
  void initState() {
    super.initState();
    chat = widget.chat;
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
      _controller.init(chat);
    }
  }

  Future<void> _initializeData() async {
    try {
      final cryptoProvider = Provider.of<CryptoProvider>(context, listen: false);

      // Инициализируем контроллер с зависимостями
      _controller = ChatController(
        repository: ChatRepository(
          chatApi: const ChatApi(),
          cipher: const MessageCipherService(),
        ),
        wsProvider: WebSocketProvider(),
        crypto: cryptoProvider,
      );

      // Подписываемся на изменения контроллера
      _controllerListener = () {
        if (!mounted) return;
        setState(() {
          messages = _controller.messages;
          _isLoading = _controller.isLoading;
        });
        _scrollToBottom();
      };
      _controller.addListener(_controllerListener);

      await _controller.init(chat);
    } catch (error) {
      logger.e('Error initializing chat: $error');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
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
    _controller.removeListener(_controllerListener);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasAppBar = Scaffold.maybeOf(context)?.hasAppBar ?? false;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: Colors.transparent,
      appBar: (hasAppBar || widget.hideAppBar) ? null : _buildModernAppBar(context, isDark),
      body: Container(
        decoration: BoxDecoration(
          gradient: isDark ? AppGradients.darkBackground : AppGradients.lightBackground,
        ),
        child: Column(
          children: [
            Expanded(
              child: _isLoading
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
      backgroundColor: (isDark ? AppColors.darkBackground : AppColors.lightBackground).withOpacity(0.95),
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
            color: isDark ? AppColors.neutral800.withOpacity(0.3) : AppColors.neutral200.withOpacity(0.3),
            borderRadius: BorderRadius.circular(12),
          ),
          child: IconButton(
            onPressed: () {},
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
          border: Border.all(color: isDark ? AppColors.neutral800 : AppColors.neutral200, width: 1),
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
    final appBarHeight = (hasAppBar || !widget.hideAppBar) ? (kToolbarHeight + MediaQuery.of(context).padding.top) : 0.0;

    return NotificationListener<ScrollNotification>(
      onNotification: (scrollNotification) {
        return false;
      },
      child: CustomScrollView(
        controller: _scrollController,
        slivers: [
          const SliverToBoxAdapter(child: SizedBox(height: 8.0)),
          SliverLayoutBuilder(
            builder: (context, constraints) {
              final scrollOffset = _scrollController.hasClients ? _scrollController.offset : 0.0;
              final additionalPadding = scrollOffset <= 100.0 ? appBarHeight : 0.0;
              return SliverToBoxAdapter(child: SizedBox(height: additionalPadding));
            },
          ),
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
          const SliverToBoxAdapter(child: SizedBox(height: 8.0)),
        ],
      ),
    );
  }

  Widget _buildMessageInput(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        border: Border(top: BorderSide(color: isDark ? AppColors.neutral800 : AppColors.neutral200, width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: isDark ? AppColors.neutral700 : AppColors.neutral200),
                ),
                child: TextField(
                  controller: _messageController,
                  maxLines: null,
                  textInputAction: TextInputAction.newline,
                  decoration: InputDecoration(
                    hintText: 'Введите сообщение...',
                    hintStyle: TextStyle(color: isDark ? AppColors.neutral400 : AppColors.neutral500),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  ),
                  style: TextStyle(color: isDark ? AppColors.neutral100 : AppColors.neutral900, fontSize: 15),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [AppColors.primary, AppColors.secondary]),
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
    if (messageText.isEmpty) return;

    try {
      _messageController.clear();
      final success = await _controller.sendMessage(messageText);
      if (!success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка отправки сообщения'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (error) {
      logger.e('Error sending message: $error');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка отправки сообщения'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    }
  }
}
