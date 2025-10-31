import 'package:hugeicons/hugeicons.dart';
import 'package:provider/provider.dart';
import 'package:flutter/material.dart';

import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/core/services/online_status_service.dart';

import 'package:Ren/core/models/message.dart';
import 'package:Ren/core/models/chat.dart';

import 'package:Ren/core/utils/constants/apiurl.dart';

import 'package:Ren/features/chat/presentation/chat_screen.dart';
import 'package:Ren/ui/theme/themes.dart';

// Удалён legacy decryptmesseg; тексты приходят расшифрованными


class DesktopHomeScreen extends StatefulWidget {
  final List<Chats> chats;
  final VoidCallback onLogout;

  const DesktopHomeScreen({
    Key? key,
    required this.chats,
    required this.onLogout,
  }) : super(key: key);

  @override
  State<DesktopHomeScreen> createState() => _DesktopHomeScreenState();
}

class _DesktopHomeScreenState extends State<DesktopHomeScreen> {
  int? _selectedChatId;
  late TextEditingController _searchController;
  late List<Chats> _filteredChats;
  final OnlineStatusService _onlineStatusService = OnlineStatusService();

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _filteredChats = widget.chats;
    // слушаем изменения поля поиска
    _searchController.addListener(() {
      _filterChats(_searchController.text);
    });

    // Инициализируем сервис онлайн-статусов
    _initializeOnlineStatusService();
  }

  @override
  void didUpdateWidget(covariant DesktopHomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    // если пришёл новый список чатов — обновляем и пересчитаем фильтр
    if (oldWidget.chats != widget.chats) {
      _filteredChats = widget.chats;
      _filterChats(_searchController.text);

      // Обновляем список контактов для сервиса статусов
      final companionIds = widget.chats.map((c) => c.companionId).toList();
      _onlineStatusService.updateContacts(companionIds);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _onlineStatusService.dispose();
    super.dispose();
  }

  void _initializeOnlineStatusService() {
    final cryptoProvider = Provider.of<CryptoProvider>(context, listen: false);
    if (cryptoProvider.token != null) {
      final companionIds = widget.chats.map((c) => c.companionId).toList();
      if (companionIds.isNotEmpty) {
        _onlineStatusService.initialize(cryptoProvider.token!, companionIds);
      }
    }
  }

  String _decryptMessage(Messages message, CryptoProvider cryptoProvider) {
    if (message.messageType != 'text') return 'Файл';
    return message.message.isNotEmpty ? message.message : 'Сообщение';
  }

  // Фильтрация чатов по имени и по расшифрованному тексту последнего сообщения
  void _filterChats(String query) {
    final q = query.trim().toLowerCase();

    setState(() {
      if (q.isEmpty) {
        _filteredChats = widget.chats;
        return;
      }

      final cryptoProvider =
          Provider.of<CryptoProvider>(context, listen: false);

      _filteredChats = widget.chats.where((chat) {
        final name = chat.companionUserName.toLowerCase();
        final nameMatch = name.contains(q);

        String preview = '';
        if (chat.lastMessage.messageType == 'text') {
          preview = _decryptMessage(chat.lastMessage, cryptoProvider).toLowerCase();
        }
        final messageMatch = preview.contains(q);

        return nameMatch || messageMatch;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final selectedChat =
        _selectedChatId == null
            ? null
            : widget.chats.firstWhere(
              (chat) => chat.chatId == _selectedChatId,
              orElse: () => widget.chats.first,
            );

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: BoxDecoration(
          gradient:
              isDark
                  ? AppGradients.darkBackground
                  : AppGradients.lightBackground,
        ),
        child: SafeArea(
          child: Row(
            children: [
              // Левая панель с чатами
              Container(
                width: 380,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkCard : AppColors.lightCard,
                  border: Border(
                    right: BorderSide(
                      color:
                          isDark ? AppColors.neutral800 : AppColors.neutral200,
                      width: 1,
                    ),
                  ),
                ),
                child: _buildChatsPanel(isDark),
              ),

              // Правая панель с чатом
              Expanded(child: _buildChatPanel(selectedChat, isDark)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChatsPanel(bool isDark) {
    return Column(
      children: [
        // Заголовок панели
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isDark ? AppColors.neutral800 : AppColors.neutral200,
                width: 1,
              ),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Чаты',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                  ),
                ),
              ),
              Container(
                decoration: BoxDecoration(
                  color: isDark ? AppColors.neutral800 : AppColors.neutral200,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: IconButton(
                  icon: HugeIcon(
                    icon: HugeIcons.strokeRoundedLogoutSquare01,
                    color: AppColors.warning,
                  ),
                  onPressed: widget.onLogout,
                  tooltip: 'Выход',
                  color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                ),
              ),
            ],
          ),
        ),

        // Поиск
        Container(
          padding: const EdgeInsets.all(16),
          child: Container(
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark ? AppColors.neutral700 : AppColors.neutral200,
              ),
            ),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Поиск чатов...',
                prefixIcon: Icon(
                  Icons.search_rounded,
                  color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                  size: 20,
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                hintStyle: TextStyle(
                  color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                  fontSize: 14,
                ),
              ),
              style: TextStyle(
                color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                fontSize: 14,
              ),
              onChanged: (v) => _filterChats(v),
            ),
          ),
        ),

        // Список чатов (фильтрованный)
        Expanded(
          child: StreamBuilder<Map<int, UserOnlineStatus>>(
            stream: _onlineStatusService.statusStream,
            builder: (context, snapshot) {
              return ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _filteredChats.length,
                itemBuilder: (context, index) {
                  final chat = _filteredChats[index];
                  final isSelected = chat.chatId == _selectedChatId;
                  final cryptoProvider =
                      Provider.of<CryptoProvider>(context, listen: false);
                  final isOnline =
                      _onlineStatusService.isUserOnline(chat.companionId);

                  return Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? (isDark
                              ? AppColors.primary.withOpacity(0.1)
                              : AppColors.primary.withOpacity(0.08))
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                      border: isSelected
                          ? Border.all(
                              color: AppColors.primary.withOpacity(0.3),
                              width: 1,
                            )
                          : null,
                    ),
                    child: Material(
                      color: Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          setState(() {
                            _selectedChatId = chat.chatId;
                          });
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              // Avatar с онлайн индикатором
                              Stack(
                                children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(22),
                                      border: Border.all(
                                        color: isSelected
                                            ? AppColors.primary
                                                .withOpacity(0.3)
                                            : (isDark
                                                ? AppColors.neutral700
                                                : AppColors.neutral300),
                                        width: 1,
                                      ),
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(21),
                                      child: chat.companionAvatar != null &&
                                              chat.companionAvatar!.isNotEmpty
                                          ? Image.network(
                                              '${Apiurl.API_URL}/storage/avatars/${chat.companionAvatar}',
                                              fit: BoxFit.cover,
                                              errorBuilder:
                                                  (context, error, stackTrace) =>
                                                      _buildAvatar(
                                                        chat
                                                            .companionUserName,
                                                        isDark,
                                                      ),
                                            )
                                          : _buildAvatar(
                                              chat.companionUserName,
                                              isDark,
                                            ),
                                    ),
                                  ),
                                  // Онлайн индикатор
                                  Positioned(
                                    right: 2,
                                    bottom: 2,
                                    child: Container(
                                      width: 12,
                                      height: 12,
                                      decoration: BoxDecoration(
                                        color: isOnline
                                            ? AppColors.success
                                            : AppColors.neutral400,
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: isDark
                                              ? AppColors.darkCard
                                              : AppColors.lightCard,
                                          width: 2,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),

                              const SizedBox(width: 12),

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
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium
                                                ?.copyWith(
                                                  fontWeight: isSelected
                                                      ? FontWeight.w600
                                                      : FontWeight.w500,
                                                  color: isSelected
                                                      ? AppColors.primary
                                                      : (isDark
                                                          ? AppColors
                                                              .neutral100
                                                          : AppColors
                                                              .neutral900),
                                                ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        Text(
                                          _formatTime(
                                              chat.lastMessage.createdAt),
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall
                                              ?.copyWith(
                                                color: isSelected
                                                    ? AppColors.primary
                                                        .withOpacity(0.8)
                                                    : (isDark
                                                        ? AppColors.neutral400
                                                        : AppColors
                                                            .neutral500),
                                                fontSize: 11,
                                              ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _decryptMessage(
                                        chat.lastMessage,
                                        cryptoProvider,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: isDark
                                                ? AppColors.neutral400
                                                : AppColors.neutral600,
                                            fontSize: 13,
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
          ),
        ),
      ],
    );
  }

  Widget _buildAvatar(String name, bool isDark) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? [AppColors.neutral700, AppColors.neutral600]
              : [AppColors.neutral300, AppColors.neutral400],
        ),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: isDark ? AppColors.neutral100 : AppColors.neutral800,
          ),
        ),
      ),
    );
  }

  Widget _buildChatPanel(Chats? selectedChat, bool isDark) {
    if (selectedChat == null) {
      return Container(
        decoration: BoxDecoration(
          gradient:
              isDark
                  ? AppGradients.darkBackground
                  : AppGradients.lightBackground,
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkCard : AppColors.lightCard,
                  borderRadius: BorderRadius.circular(60),
                  border: Border.all(
                    color: isDark ? AppColors.neutral800 : AppColors.neutral200,
                  ),
                ),
                child: Icon(
                  Icons.chat_bubble_outline_rounded,
                  size: 48,
                  color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Выберите чат',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Выберите чат из списка, чтобы начать общение',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        gradient:
            isDark ? AppGradients.darkBackground : AppGradients.lightBackground,
      ),
      child: ChatScreen(hideAppBar: true, chat: selectedChat),
    );
  }

  String _formatTime(DateTime? dateTime) {
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
      return '${dateTime.day}.${dateTime.month}';
    }
  }
}
