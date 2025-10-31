import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import 'dart:math' as math;

import 'package:Ren/core/api/user/chats.dart';

import 'package:Ren/core/models/notification.dart';
import 'package:Ren/core/models/chat.dart';

import 'package:Ren/core/notifications/notifications.dart';

import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/core/utils/auth/checkauth.dart';
import 'package:Ren/core/crypto/message_cipher_service.dart';

import 'package:Ren/ui/pages/home/home_screen.dart';
import 'package:Ren/ui/pages/auth/auth_screen.dart';

import 'package:Ren/ui/widgets/renlogo.dart';
import 'package:Ren/ui/widgets/animatedgradient.dart';

class SplashScreen extends StatefulWidget {
  final bool showLoginSuccess;
  final NotificationData? notificationData;

  const SplashScreen({
    Key? key,
    this.showLoginSuccess = false,
    this.notificationData,
  }) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _backgroundController;
  late AnimationController _solarSystemController;
  late AnimationController _fadeController;

  late Animation<double> _backgroundAnimation;
  late Animation<double> _fadeAnimation;

  late Chats chat;

  @override
  void initState() {
    super.initState();

    // Контроллер для анимации фона
    _backgroundController = AnimationController(
      duration: const Duration(seconds: 8),
      vsync: this,
    )..repeat();

    // Контроллер для анимации солнечной системы
    _solarSystemController = AnimationController(
      duration: const Duration(seconds: 12),
      vsync: this,
    )..repeat();

    // Контроллер для fade-in анимации
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );

    _backgroundAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _backgroundController, curve: Curves.easeInOut),
    );

    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _fadeController, curve: Curves.easeIn));

    // Запускаем fade-in анимацию
    _fadeController.forward();

    // Показываем уведомление об успешном входе, если нужно
    if (widget.showLoginSuccess) {
      _showLoginSuccessNotification();
    }

    if (widget.notificationData != null) {
      _showPassedNotification();
    }

    // Инициализируем криптографию и проверяем аутентификацию после завершения билда
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeAppWithCrypto();
    });
  }

  Future<void> _showLoginSuccessNotification() async {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          Notifications.showSystemNotification(
            'Успешный вход',
            'Вы успешно вошли в аккаунт',
            context,
            Duration(seconds: 3),
            Color.fromARGB(255, 64, 130, 109),
          );
        }
      });
    });
  }

  Future<void> _showPassedNotification() async {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted && widget.notificationData != null) {
          Notifications.showSystemNotification(
            widget.notificationData!.title,
            widget.notificationData!.message,
            context,
            widget.notificationData!.duration,
            widget.notificationData!.color,
          );
        }
      });
    });
  }

  Future<void> _initializeAppWithCrypto() async {
    try {
      late List<Chats> chats;
      // Инициализируем CryptoProvider (загружаем ключи из storage если есть)
      final cryptoProvider = Provider.of<CryptoProvider>(
        context,
        listen: false,
      );
      await cryptoProvider.initialize();

      // Ждем минимум 3 секунды для показа анимации
      await Future.delayed(const Duration(seconds: 3));

      if (!mounted) return;

      // Используем ваш CheckAuth для полной проверки аутентификации
      // (он проверяет наличие ключей, токена и валидирует токен через API)
      final isAuthenticated = await CheckAuth.checkAuth();

      if (isAuthenticated) {
        final String token = cryptoProvider.token as String;

        chats = await ChatsAPI.getChats(token, context);
        
        // Инициализируем сервис шифрования/дешифрования
        const cipher = MessageCipherService();
        
        // Дешифровываем последние сообщения в чатах, если они зашифрованы
        if (cryptoProvider.privateKey != null && cryptoProvider.userId != null) {
          for (int i = 0; i < chats.length; i++) {
            final chat = chats[i];
            final lastMessage = chat.lastMessage;
            
            // Проверяем, нужно ли дешифровать сообщение
            // Если сообщение пустое или уже расшифровано, пропускаем
            if (lastMessage.message.isNotEmpty && 
                !lastMessage.message.startsWith('-----BEGIN') && // Не зашифрованное
                lastMessage.envelopes == null) {
              continue; // Сообщение уже расшифровано
            }
            
            // Если есть envelopes, значит сообщение зашифровано
            if (lastMessage.envelopes != null && lastMessage.envelopes!.isNotEmpty) {
              try {
                // Ищем nonce в metadata или создаем структуру для дешифровки
                String? nonce;
                if (lastMessage.metadata != null && lastMessage.metadata!.isNotEmpty) {
                  nonce = lastMessage.metadata!.first.nonce;
                }
                
                final messageData = {
                  'id': lastMessage.id,
                  'chat_id': lastMessage.chatId,
                  'sender_id': lastMessage.senderId,
                  'message_type': lastMessage.messageType,
                  'created_at': lastMessage.createdAt.toIso8601String(),
                  'edited_at': lastMessage.editedAt?.toIso8601String(),
                  'is_read': lastMessage.isRead,
                  'ciphertext': lastMessage.message.isNotEmpty ? lastMessage.message : '',
                  'nonce': nonce ?? '',
                  'envelopes': lastMessage.envelopes!.map((k, v) => MapEntry(k, v.toJson())),
                  'metadata': lastMessage.metadata?.map((m) => m.toJson()).toList(),
                };
                
                final decryptedMessage = await cipher.decryptWebSocketMessage(
                  messageData,
                  cryptoProvider.privateKey!,
                  cryptoProvider.userId!,
                );
                
                if (decryptedMessage != null && decryptedMessage.message.isNotEmpty) {
                  // Обновляем сообщение в чате
                  chats[i] = Chats(
                    chatId: chat.chatId,
                    userId: chat.userId,
                    companionId: chat.companionId,
                    createdAt: chat.createdAt,
                    companionAvatar: chat.companionAvatar,
                    companionUserName: chat.companionUserName,
                    companionPubKey: chat.companionPubKey,
                    lastMessage: decryptedMessage,
                  );
                  
                  debugPrint('Успешно дешифровано сообщение для чата ${chat.chatId}: ${decryptedMessage.message}');
                }
              } catch (e) {
                debugPrint('Не удалось дешифровать последнее сообщение для чата ${chat.chatId}: $e');
                // Оставляем сообщение как есть, но очищаем зашифрованный текст
                if (lastMessage.message.startsWith('-----BEGIN') || lastMessage.message.contains('ENCRYPTED')) {
                  final clearedMessage = lastMessage.copyWith(message: 'Зашифрованное сообщение');
                  chats[i] = Chats(
                    chatId: chat.chatId,
                    userId: chat.userId,
                    companionId: chat.companionId,
                    createdAt: chat.createdAt,
                    companionAvatar: chat.companionAvatar,
                    companionUserName: chat.companionUserName,
                    companionPubKey: chat.companionPubKey,
                    lastMessage: clearedMessage,
                  );
                }
              }
            }
          }
        }
      }

      final targetScreen =
          isAuthenticated ? HomeScreen(chats: chats) : const AuthScreen();

      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) => targetScreen,
          transitionDuration: const Duration(milliseconds: 800),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(opacity: animation, child: child);
          },
        ),
      );
    } catch (error) {
      // В случае ошибки инициализации переходим на экран авторизации
      debugPrint('Error during initialization: $error');

      if (!mounted) return;

      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder:
              (context, animation, secondaryAnimation) => const AuthScreen(),
          transitionDuration: const Duration(milliseconds: 800),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(opacity: animation, child: child);
          },
        ),
      );
    }
  }

  @override
  void dispose() {
    _backgroundController.dispose();
    _solarSystemController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: AnimatedBuilder(
        animation: Listenable.merge([_backgroundAnimation, _fadeAnimation]),
        builder: (context, child) {
          return Container(
            width: double.infinity,
            height: double.infinity,
            decoration: BoxDecoration(
              // Используем утилитный класс для создания градиента
              gradient: AnimatedGradientUtils.buildAnimatedGradient(
                _backgroundAnimation.value,
                isDarkMode,
              ),
            ),
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Используем новый виджет логотипа
                  RenLogo(
                    size: 200,
                    controller: _solarSystemController,
                    fontSize: 32,
                    strokeWidth: 1.5,
                    dotRadius: 3.5,
                  ),

                  const SizedBox(height: 40),

                  // Анимированный прогресс-бар
                  Container(
                    width: 200,
                    height: 4,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(2),
                      color:
                          isDarkMode
                              ? Colors.white.withOpacity(0.1)
                              : Colors.black.withOpacity(0.1),
                    ),
                    child: Stack(
                      children: [
                        // Движущаяся полоска
                        AnimatedBuilder(
                          animation: _backgroundAnimation,
                          builder: (context, child) {
                            final position =
                                math.sin(
                                      _backgroundAnimation.value * 4 * math.pi,
                                    ) *
                                    0.5 +
                                0.5;

                            return Positioned(
                              left: position * 140, // 200 - 60 (ширина полоски)
                              child: Container(
                                width: 60,
                                height: 4,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(2),
                                  gradient: LinearGradient(
                                    colors:
                                        isDarkMode
                                            ? [
                                              Colors.white.withOpacity(0.2),
                                              Colors.white.withOpacity(0.8),
                                              Colors.white.withOpacity(0.2),
                                            ]
                                            : [
                                              const Color(
                                                0xFF1A1B2E,
                                              ).withOpacity(0.2),
                                              const Color(
                                                0xFF1A1B2E,
                                              ).withOpacity(0.8),
                                              const Color(
                                                0xFF1A1B2E,
                                              ).withOpacity(0.2),
                                            ],
                                    stops: const [0.0, 0.5, 1.0],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
