import 'package:provider/provider.dart';
import 'package:flutter/material.dart';
import 'dart:ui';

import 'package:Ren/core/models/user.messages.model.dart';

import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/core/encryption/decryptMesseg.dart';

import 'package:Ren/ui/theme/themes.dart';

class ChatBubble extends StatelessWidget {
  final Messages message;
  final bool isMe;

  const ChatBubble({Key? key, required this.message, required this.isMe})
    : super(key: key);

  String _decryptMessage(Messages message, CryptoProvider cryptoProvider) {
    final currentUserId = cryptoProvider.userId!;
    final privateKey = cryptoProvider.privateKey!;

    return DecryptMessage().decryptMessage(
      message,
      currentUserId.toString(),
      privateKey,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cryptoProvider = Provider.of<CryptoProvider>(context, listen: false);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final displayText = _decryptMessage(message, cryptoProvider);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isMe) ...[
            _buildAvatar(context, isDark),
            const SizedBox(width: 12),
          ],

          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
                minWidth: 80,
              ),
              child: Column(
                crossAxisAlignment:
                    isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      gradient: _getMessageGradient(isDark),
                      borderRadius: _getBorderRadius(),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(isDark ? 0.2 : 0.08),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                          spreadRadius: 0,
                        ),
                      ],
                    ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Текст сообщения
                          Text(
                            displayText,
                            style: Theme.of(
                              context,
                            ).textTheme.bodyMedium?.copyWith(
                              color: _getMessageTextColor(isDark),
                              fontWeight: FontWeight.w400,
                              height: 1.4,
                            ),
                          ),

                          const SizedBox(height: 6),

                          // Время и статус
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Text(
                                formatTime(message.createdAt),
                                style: Theme.of(
                                  context,
                                ).textTheme.bodySmall?.copyWith(
                                  color: _getTimeTextColor(isDark),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w400,
                                ),
                              ),

                              if (isMe) ...[
                                const SizedBox(width: 6),
                                Icon(
                                  _getMessageStatusIcon(),
                                  size: 14,
                                  color: _getTimeTextColor(isDark),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          if (isMe) ...[
            const SizedBox(width: 12),
            _buildAvatar(context, isDark),
          ],
        ],
      ),
    );
  }

  Widget _buildAvatar(BuildContext context, bool isDark) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors:
              isDark
                  ? [AppColors.darkCard, AppColors.neutral800]
                  : [AppColors.lightCard, AppColors.neutral100],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.neutral700 : AppColors.neutral200,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Icon(
        isMe ? Icons.person : Icons.person_outline,
        size: 16,
        color: isDark ? AppColors.neutral300 : AppColors.neutral600,
      ),
    );
  }

  Gradient _getMessageGradient(bool isDark) {
    if (isDark) {
      return isMe ? AppGradients.messageMeDark : AppGradients.messageYouDark;
    } else {
      return isMe ? AppGradients.messageMeLight : AppGradients.messageYouLight;
    }
  }

  Color _getMessageTextColor(bool isDark) {
    if (isDark) {
      return isMe ? Colors.white : AppColors.neutral100;
    } else {
      return isMe ? Colors.white : AppColors.neutral900;
    }
  }

  Color _getTimeTextColor(bool isDark) {
    if (isDark) {
      return isMe ? Colors.white.withOpacity(0.7) : AppColors.neutral400;
    } else {
      return isMe ? Colors.white.withOpacity(0.8) : AppColors.neutral500;
    }
  }

  BorderRadius _getBorderRadius() {
    const radius = Radius.circular(18);
    const smallRadius = Radius.circular(4);

    if (isMe) {
      return const BorderRadius.only(
        topLeft: radius,
        topRight: radius,
        bottomLeft: radius,
        bottomRight: smallRadius,
      );
    } else {
      return const BorderRadius.only(
        topLeft: radius,
        topRight: radius,
        bottomLeft: smallRadius,
        bottomRight: radius,
      );
    }
  }

  IconData _getMessageStatusIcon() {
    // Можно добавить логику для разных статусов сообщений
    return Icons.check;
  }

  String formatTime(DateTime? dateTime) {
    if (dateTime == null) return '';

    try {
      final now = DateTime.now();

      // дробные часы, как в TS: (now - date) / (1000*60*60)
      final diffInHours =
          now.difference(dateTime).inMilliseconds / (1000 * 60 * 60);

      bool sameCalendarDay(DateTime a, DateTime b) =>
          a.year == b.year && a.month == b.month && a.day == b.day;

      String two(int n) => n.toString().padLeft(2, '0');

      // Сегодня (и прошло меньше 24 часов)
      if (diffInHours < 24 && sameCalendarDay(dateTime, now)) {
        return '${two(dateTime.hour)}:${two(dateTime.minute)}';
      }

      // Вчера
      final yesterday = now.subtract(Duration(days: 1));
      if (sameCalendarDay(dateTime, yesterday)) {
        return 'Вчера ${two(dateTime.hour)}:${two(dateTime.minute)}';
      }

      // Иначе — показать день, месяц, часы и минуты (двузначные)
      return '${two(dateTime.day)}.${two(dateTime.month)} ${two(dateTime.hour)}:${two(dateTime.minute)}';
    } catch (e) {
      // В TS в catch возвращается исходная строка; здесь возвращаем toString() объекта
      return dateTime.toString();
    }
  }
}
