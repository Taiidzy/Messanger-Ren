import 'package:flutter/material.dart';

import 'package:Ren/core/models/message.dart';
import 'package:Ren/ui/theme/themes.dart';

class ChatBubble extends StatelessWidget {
  final Messages message;
  final bool isMe;

  const ChatBubble({Key? key, required this.message, required this.isMe}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final displayText = message.message; // текст уже расшифрован на уровне сервисов

    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
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
                crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
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
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayText.isNotEmpty ? displayText : (message.messageType == 'file' ? 'Файл' : 'Сообщение'),
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: _getMessageTextColor(isDark),
                                  fontWeight: FontWeight.w400,
                                  height: 1.4,
                                ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Text(
                                _formatTime(message.createdAt),
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
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
          colors: isDark ? [AppColors.darkCard, AppColors.neutral800] : [AppColors.lightCard, AppColors.neutral100],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? AppColors.neutral700 : AppColors.neutral200, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Icon(isMe ? Icons.person : Icons.person_outline, size: 16, color: isDark ? AppColors.neutral300 : AppColors.neutral600),
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
    return Icons.check;
  }

  String _two(int n) => n.toString().padLeft(2, '0');
  String _formatTime(DateTime? dt) {
    if (dt == null) return '';
    return '${_two(dt.day)}.${_two(dt.month)} ${_two(dt.hour)}:${_two(dt.minute)}';
  }
}
