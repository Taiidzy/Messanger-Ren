import 'package:hugeicons/hugeicons.dart';
import 'package:provider/provider.dart';
import 'package:flutter/material.dart';

import 'package:Ren/ui/widgets/glassmorphictextfield.dart';
import 'package:Ren/ui/widgets/glassmorphicbutton.dart';

import 'package:Ren/core/encryption/crypto.dart';
import 'package:Ren/core/encryption/cryptoprovider.dart';

import 'package:Ren/core/notifications/notifications.dart';

import 'package:Ren/ui/pages/splash/splash_screen.dart';

class SignInForm extends StatefulWidget {
  const SignInForm({Key? key}) : super(key: key);

  @override
  State<SignInForm> createState() => _SignInFormState();
}

class _SignInFormState extends State<SignInForm> with TickerProviderStateMixin {
  final _loginController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  late AnimationController _animationController;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _animation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
  }

  Future<void> _login() async {
    final login = _loginController.text.trim();
    final password = _passwordController.text;

    setState(() {
      _isLoading = true;
    });

    _animationController.repeat(reverse: true);

    if (login.isEmpty || password.isEmpty) {
      Notifications.showSystemNotification(
        'Ошибка входа',
        'Введите логин и пароль',
        context,
        Duration(seconds: 4),
        Color.fromARGB(255, 197, 83, 92),
      );
      setState(() {
        _isLoading = false;
      });
      return;
    }

    final passwordValidation = Crypto.validatePassword(password);
    if (!passwordValidation.isValid) {
      Notifications.showSystemNotification(
        'Ошибка данных',
        passwordValidation.message!,
        context,
        Duration(seconds: 4),
        Color.fromARGB(255, 243, 190, 93),
      );
      setState(() {
        _isLoading = false;
      });
      return;
    }

    try {
      if (!mounted) return;

      final cryptoProvider = Provider.of<CryptoProvider>(
        context,
        listen: false,
      );
      final result = await cryptoProvider.loadKeysOnLogin(login, password);

      if (result.status == 200) {
        _loginController.clear();
        _passwordController.clear();

        Navigator.of(context).pushReplacement(
          PageRouteBuilder(
            pageBuilder:
                (context, animation, secondaryAnimation) =>
                    SplashScreen(showLoginSuccess: true), // Передаем флаг
            transitionDuration: const Duration(milliseconds: 800),
            transitionsBuilder: (
              context,
              animation,
              secondaryAnimation,
              child,
            ) {
              return FadeTransition(opacity: animation, child: child);
            },
          ),
        );
      } else {
        Notifications.showSystemNotification(
          'Ошибка входа',
          result.message ?? 'Причина неизвестна',
          context,
          Duration(seconds: 4),
          Color.fromARGB(255, 87, 33, 37),
        );
      }
    } catch (error) {
      Notifications.showSystemNotification(
        'Ошибка',
        'Ошибка: ${error}',
        context,
        Duration(seconds: 4),
        Color.fromARGB(255, 87, 33, 37),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
      _animationController.stop(); // Останавливаем анимацию
    }
  }

  @override
  void dispose() {
    _loginController.dispose();
    _passwordController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      children: [
        GlassmorphicTextField(
          controller: _loginController,
          hintText: 'Логин',
          prefixIcon: HugeIcon(
            icon: HugeIcons.strokeRoundedUser,
            color: Colors.red,
            size: 20.0,
          ),
        ),
        const SizedBox(height: 16),
        GlassmorphicTextField(
          controller: _passwordController,
          hintText: 'Пароль',
          prefixIcon: HugeIcon(
            icon: HugeIcons.strokeRoundedSquareLock02,
            color: Colors.red,
            size: 20.0,
          ),
          obscureText: _obscurePassword,
          suffixIcon: IconButton(
            icon: Icon(
              _obscurePassword
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
              size: 20,
              color:
                  isDark
                      ? Colors.white.withOpacity(0.5)
                      : Colors.black.withOpacity(0.5),
            ),
            onPressed: () {
              setState(() {
                _obscurePassword = !_obscurePassword;
              });
            },
          ),
        ),
        const SizedBox(height: 32),
        _isLoading
            ? _buildLoadingAnimation(
              isDark,
            ) // Если идет загрузка, показываем анимацию
            : GlassmorphicButton(
              // Иначе, показываем кнопку
              onPressed: _login,
              text: 'Войти',
            ),
      ],
    );
  }

  Widget _buildLoadingAnimation(bool isDark) {
    // Контейнер-обертка, чтобы анимация занимала место кнопки
    return SizedBox(
      height: 50, // Высота, как у вашей кнопки
      width: double.infinity,
      child: AnimatedBuilder(
        animation: _animation,
        builder: (context, child) {
          // Чтобы анимация шла по всей ширине, рассчитаем максимальное смещение
          // Ширина контейнера (предположим 200) - ширина полоски (60) = 140
          // Лучше использовать LayoutBuilder для точных размеров, но для примера сойдет
          return LayoutBuilder(
            builder: (context, constraints) {
              final double travelDistance = constraints.maxWidth - 60;
              return Stack(
                alignment: Alignment.centerLeft,
                children: [
                  // Ваш код анимации, адаптированный
                  Positioned(
                    left: _animation.value * travelDistance,
                    child: Container(
                      width: 60,
                      height: 4,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        gradient: LinearGradient(
                          colors:
                              isDark
                                  ? [
                                    Colors.white.withOpacity(0.2),
                                    Colors.white.withOpacity(0.8),
                                    Colors.white.withOpacity(0.2),
                                  ]
                                  : [
                                    const Color(0xFF1A1B2E).withOpacity(0.2),
                                    const Color(0xFF1A1B2E).withOpacity(0.8),
                                    const Color(0xFF1A1B2E).withOpacity(0.2),
                                  ],
                          stops: const [0.0, 0.5, 1.0],
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
