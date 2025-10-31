import 'package:hugeicons/hugeicons.dart';
import 'package:provider/provider.dart';
import 'package:flutter/material.dart';

import 'package:Ren/core/models/message.dart';
import 'package:Ren/core/models/chat.dart';

import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/features/presence/presentation/online_status_controller.dart';

import 'package:Ren/features/chat/presentation/chat_screen.dart';
import 'package:Ren/ui/widgets/getinitials.dart';
import 'package:Ren/ui/theme/themes.dart';

import 'package:Ren/core/utils/constants/apiurl.dart';

class MobileHomeScreen extends StatefulWidget {
  final List<Chats> chats;
  final VoidCallback onLogout;

  const MobileHomeScreen({
    Key? key,
    required this.chats,
    required this.onLogout,
  }) : super(key: key);

  @override
  State<MobileHomeScreen> createState() => _MobileHomeScreenState();
}

class _MobileHomeScreenState extends State<MobileHomeScreen>
    with TickerProviderStateMixin {
  Chats? _selectedChat;
  late AnimationController _transitionController;
  late Animation<Offset> _chatViewAnimation;
  final OnlineStatusController _onlineStatusController = OnlineStatusController();

  @override
  void initState() {
    super.initState();
    _transitionController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );

    _chatViewAnimation = Tween<Offset>(
      begin: const Offset(1.0, 0.0),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _transitionController,
        curve: Curves.easeOutCubic,
      ),
    );

    // Инициализируем сервис онлайн статусов
    _initializeOnlineStatusService();
  }

  void _initializeOnlineStatusService() {
    final cryptoProvider = Provider.of<CryptoProvider>(context, listen: false);
    if (cryptoProvider.token != null) {
      // Получаем список ID собеседников из чатов
      final companionIds = widget.chats.map((chat) => chat.companionId).toList();
      if (companionIds.isNotEmpty) {
        _onlineStatusController.initialize(cryptoProvider.token!, companionIds);
      }
    }
  }

  @override
  void dispose() {
    _transitionController.dispose();
    _onlineStatusController.dispose();
    super.dispose();
  }

  Widget _buildCompactAvatar(Chats chat) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.neutral700 : AppColors.neutral300,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(13),
        child:
            chat.companionAvatar != null && chat.companionAvatar!.isNotEmpty
                ? Image.network(
                  '${Apiurl.API_URL}/storage/avatars/${chat.companionAvatar}',
                  fit: BoxFit.cover,
                  errorBuilder:
                      (context, error, stackTrace) =>
                          _buildInitialsAvatar(chat.companionUserName, isDark),
                )
                : _buildInitialsAvatar(chat.companionUserName, isDark),
      ),
    );
  }

  Widget _buildInitialsAvatar(String name, bool isDark) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors:
              isDark
                  ? [AppColors.neutral700, AppColors.neutral600]
                  : [AppColors.neutral300, AppColors.neutral400],
        ),
      ),
      child: Center(
        child: Text(
          getInitials(name),
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isDark ? AppColors.neutral100 : AppColors.neutral800,
          ),
        ),
      ),
    );
  }

  Widget _buildListAvatar(String name, bool isDark) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors:
              isDark
                  ? [AppColors.neutral700, AppColors.neutral600]
                  : [AppColors.neutral300, AppColors.neutral400],
        ),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: isDark ? AppColors.neutral100 : AppColors.neutral800,
          ),
        ),
      ),
    );
  }

  Widget _buildChatsList() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cryptoProvider = Provider.of<CryptoProvider>(context, listen: false);

    return StreamBuilder<Map<int, UserOnlineStatus>>(
      stream: _onlineStatusController.statusStream,
      builder: (context, snapshot) {
        return ListView.builder(
          padding: EdgeInsets.only(
            top: kToolbarHeight + MediaQuery.of(context).padding.top + 16,
            left: 16,
            right: 16,
            bottom: 16,
          ),
          itemCount: widget.chats.length,
          itemBuilder: (context, index) {
            final chat = widget.chats[index];
            final isOnline = _onlineStatusController.isUserOnline(chat.companionId);

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : AppColors.lightCard,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? AppColors.neutral800 : AppColors.neutral200,
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(isDark ? 0.1 : 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => _selectChat(chat),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    // Avatar с онлайн индикатором
                    Stack(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color:
                                  isDark
                                      ? AppColors.neutral700
                                      : AppColors.neutral300,
                              width: 1,
                            ),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(23),
                            child:
                                chat.companionAvatar != null &&
                                        chat.companionAvatar!.isNotEmpty
                                    ? Image.network(
                                      '${Apiurl.API_URL}/storage/avatars/${chat.companionAvatar}',
                                      fit: BoxFit.cover,
                                      errorBuilder:
                                          (context, error, stackTrace) =>
                                              _buildListAvatar(
                                                chat.companionUserName,
                                                isDark,
                                              ),
                                    )
                                    : _buildListAvatar(
                                      chat.companionUserName,
                                      isDark,
                                    ),
                          ),
                        ),
                        // Онлайн индикатор
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              color:
                                  isOnline
                                      ? AppColors.success
                                      : AppColors.neutral400,
                              borderRadius: BorderRadius.circular(7),
                              border: Border.all(
                                color:
                                    isDark
                                        ? AppColors.darkCard
                                        : AppColors.lightCard,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(width: 16),

                    // Информация о чате
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  chat.companionUserName,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                    color:
                                        isDark
                                            ? AppColors.neutral100
                                            : AppColors.neutral900,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Text(
                                _formatMessageTime(chat.lastMessage.createdAt),
                                style: Theme.of(
                                  context,
                                ).textTheme.bodySmall?.copyWith(
                                  color:
                                      isDark
                                          ? AppColors.neutral400
                                          : AppColors.neutral500,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 4),

                          Text(
                            _decryptMessage(chat.lastMessage, cryptoProvider),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(
                              context,
                            ).textTheme.bodyMedium?.copyWith(
                              color:
                                  isDark
                                      ? AppColors.neutral300
                                      : AppColors.neutral600,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
            );
          },
        );
      },
    );
  }

  Widget _buildChatView() {
    if (_selectedChat == null && _transitionController.isDismissed) {
      return const SizedBox.shrink();
    }

    return GestureDetector(
      onHorizontalDragUpdate: _handleSwipeUpdate,
      onHorizontalDragEnd: _handleSwipeEnd,
      child: SlideTransition(
        position: _chatViewAnimation,
        child: Container(
          decoration: BoxDecoration(
            gradient:
                Theme.of(context).brightness == Brightness.dark
                    ? AppGradients.darkBackground
                    : AppGradients.lightBackground,
          ),
          child: ChatScreen(chat: _selectedChat!, hideAppBar: true),
        ),
      ),
    );
  }

  String _formatMessageTime(DateTime? dateTime) {
    if (dateTime == null) return '';

    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays == 0) {
      return '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
    } else if (difference.inDays == 1) {
      return 'Вчера';
    } else if (difference.inDays < 7) {
      final weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      return weekdays[dateTime.weekday - 1];
    } else {
      return '${dateTime.day.toString().padLeft(2, '0')}.${dateTime.month.toString().padLeft(2, '0')}';
    }
  }

  void _selectChat(Chats chat) {
    setState(() {
      _selectedChat = chat;
    });
    _transitionController.forward();
  }

  void _goBackToList() {
    _transitionController.reverse().then((_) {
      if (mounted) {
        setState(() {
          _selectedChat = null;
        });
      }
    });
  }

  void _handleSwipeUpdate(DragUpdateDetails details) {
    final width = context.size?.width ?? MediaQuery.of(context).size.width;
    final delta = details.primaryDelta ?? 0.0;
    _transitionController.value -= delta / width;
  }

  void _handleSwipeEnd(DragEndDetails details) {
    final vx = details.velocity.pixelsPerSecond.dx;
    if (vx > 300 || _transitionController.value < 0.7) {
      _goBackToList();
    } else {
      _transitionController.forward();
    }
  }

  String _decryptMessage(Messages message, CryptoProvider cryptoProvider) {
    if (message.messageType != 'text') {
      return 'Файл';
    }

    // В новой структуре Messages поле message уже содержит расшифрованный текст
    if (message.message.isNotEmpty) {
      return message.message;
    }

    // Если сообщение пустое, возможно оно еще не расшифровано
    return 'Сообщение';
  }

  PreferredSizeWidget _buildAppBar(
    BuildContext context,
    bool isDark,
    bool isChatOpen,
  ) {
    return AppBar(
      automaticallyImplyLeading: false,
      elevation: 0,
      backgroundColor: (isDark
              ? AppColors.darkBackground
              : AppColors.lightBackground)
          .withOpacity(0.95),
      flexibleSpace: ClipRRect(
        child: Container(
          decoration: BoxDecoration(
            gradient: isDark ? AppGradients.glassDark : AppGradients.glassLight,
          ),
        ),
      ),
      leading:
          isChatOpen
              ? IconButton(
                icon: const Icon(Icons.arrow_back_ios_new, size: 20),
                onPressed: _goBackToList,
              )
              : null,
      title: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        transitionBuilder: (child, animation) {
          return FadeTransition(opacity: animation, child: child);
        },
        child:
            isChatOpen
                ? Row(
                  key: const ValueKey('chat_title'),
                  children: [
                    if (_selectedChat != null)
                      _buildCompactAvatar(_selectedChat!),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _selectedChat?.companionUserName ?? '',
                        style: Theme.of(
                          context,
                        ).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color:
                              isDark
                                  ? AppColors.neutral100
                                  : AppColors.neutral900,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                )
                : Row(
                  key: const ValueKey('app_title'),
                  children: [
                    Text(
                      'Чаты',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color:
                            isDark
                                ? AppColors.neutral100
                                : AppColors.neutral900,
                      ),
                    ),
                  ],
                ),
      ),
      actions: [
        Container(
          margin: const EdgeInsets.only(right: 8),
          child: IconButton(
            icon: HugeIcon(
              icon: HugeIcons.strokeRoundedLogoutSquare01,
              color: AppColors.warning,
            ),
            onPressed: widget.onLogout,
            tooltip: 'Выход',
            style: IconButton.styleFrom(
              backgroundColor:
                  isDark
                      ? AppColors.neutral800.withOpacity(0.3)
                      : AppColors.neutral200.withOpacity(0.3),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isChatOpen = _selectedChat != null;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: _buildAppBar(context, isDark, isChatOpen),
      body: Container(
        decoration: BoxDecoration(
          gradient:
              isDark
                  ? AppGradients.darkBackground
                  : AppGradients.lightBackground,
        ),
        child: Stack(children: [_buildChatsList(), _buildChatView()]),
      ),
    );
  }
}
