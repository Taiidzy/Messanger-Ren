import 'package:flutter/material.dart';

import 'package:Ren/ui/widgets/renlogo.dart';
import 'package:Ren/ui/widgets/animatedgradient.dart';

import 'package:Ren/ui/pages/auth/components/signin.dart';
import 'package:Ren/ui/pages/auth/components/signup.dart';
import 'package:Ren/ui/pages/auth/components/recovery.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({Key? key}) : super(key: key);

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with TickerProviderStateMixin {
  late AnimationController _backgroundController;
  late AnimationController _formController;
  late Animation<double> _backgroundAnimation;
  late Animation<double> _formAnimation;
  late AnimationController _solarSystemController;

  int _selectedTab = 0; // 0 - вход, 1 - регистрация, 2 - забыл пароль

  @override
  void initState() {
    super.initState();

    _backgroundController = AnimationController(
      duration: const Duration(seconds: 12),
      vsync: this,
    )..repeat();

    _formController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );

    _backgroundAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(_backgroundController);

    _formAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _formController, curve: Curves.easeOutCubic),
    );

    _solarSystemController = AnimationController(
      duration: const Duration(seconds: 15),
      vsync: this,
    )..repeat();

    _formController.forward();
  }

  @override
  void dispose() {
    _backgroundController.dispose();
    _formController.dispose();
    _solarSystemController.dispose();
    super.dispose();
  }

  void _changeTab(int tab) {
    if (tab != _selectedTab) {
      _formController.reverse().then((_) {
        setState(() {
          _selectedTab = tab;
        });
        _formController.forward();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: AnimatedBuilder(
        animation: _backgroundAnimation,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              gradient: AnimatedGradientUtils.buildAnimatedGradient(
                _backgroundAnimation.value,
                isDark,
              ),
            ),
            child: SafeArea(
              child: Builder(
                builder: (context) {
                  final media = MediaQuery.of(context);
                  // Более агрессивное определение необходимости скролла
                  final bool allowScroll =
                      media.viewInsets.bottom > 0 ||
                      media.size.height < 600; // Уменьшено с 700

                  final content = Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: size.width * 0.08,
                        vertical: 16, // Уменьшено с 20
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 400),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const SizedBox(height: 16), // Уменьшено с 20
                            _buildHeader(isDark),
                            const SizedBox(height: 30), // Уменьшено с 50
                            AnimatedBuilder(
                              animation: _formAnimation,
                              builder: (context, child) {
                                return Transform.translate(
                                  offset: Offset(
                                    0,
                                    (1 - _formAnimation.value) * 30,
                                  ),
                                  child: Opacity(
                                    opacity: _formAnimation.value,
                                    child: _buildMainCard(isDark),
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: 16), // Уменьшено с 20
                          ],
                        ),
                      ),
                    ),
                  );

                  if (allowScroll) {
                    return ScrollConfiguration(
                      behavior: const ScrollBehavior().copyWith(
                        overscroll: false,
                      ),
                      child: SingleChildScrollView(
                        padding: EdgeInsets.zero,
                        child: content,
                      ),
                    );
                  } else {
                    return content;
                  }
                },
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return Column(
      children: [
        // Адаптивный размер логотипа
        SizedBox(
          width: 120, // Уменьшено с 160
          height: 120, // Уменьшено с 160
          child: RenLogo(
            size: 120,
            controller: _solarSystemController,
            fontSize: 14, // Уменьшено с 16
            strokeWidth: 1.0, // Уменьшено с 1.2
            dotRadius: 2.5, // Уменьшено с 3.0
          ),
        ),
      ],
    );
  }

  Widget _buildMainCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20), // Уменьшено с 28
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        color:
            isDark
                ? Colors.white.withOpacity(0.08)
                : Colors.white.withOpacity(0.25),
        border: Border.all(
          color:
              isDark
                  ? Colors.white.withOpacity(0.15)
                  : Colors.white.withOpacity(0.4),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color:
                isDark
                    ? Colors.black.withOpacity(0.3)
                    : Colors.black.withOpacity(0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildTabBar(isDark),
          const SizedBox(height: 20), // Уменьшено с 32
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 8.0,
            ), // Уменьшено с 12
            child: _buildCurrentForm(),
          ),
          if (_selectedTab != 2) ...[
            const SizedBox(height: 16), // Уменьшено с 24
            _buildForgotPasswordButton(isDark),
          ],
        ],
      ),
    );
  }

  Widget _buildTabBar(bool isDark) {
    return Container(
      height: 46,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(23),
        color:
            isDark
                ? Colors.white.withOpacity(0.06)
                : Colors.white.withOpacity(0.15),
        border: Border.all(
          color:
              isDark
                  ? Colors.white.withOpacity(0.1)
                  : Colors.white.withOpacity(0.25),
          width: 0.5,
        ),
      ),
      child: Row(
        children: [
          _buildTabItem('Вход', 0, isDark),
          _buildTabItem('Регистрация', 1, isDark),
        ],
      ),
    );
  }

  Widget _buildTabItem(String title, int index, bool isDark) {
    final isSelected = _selectedTab == index;

    return Expanded(
      child: GestureDetector(
        onTap: () => _changeTab(index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            color:
                isSelected
                    ? (isDark
                        ? Colors.white.withOpacity(0.15)
                        : Colors.white.withOpacity(0.5))
                    : Colors.transparent,
            boxShadow:
                isSelected
                    ? [
                      BoxShadow(
                        color:
                            isDark
                                ? Colors.black.withOpacity(0.2)
                                : Colors.black.withOpacity(0.05),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                    : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w500 : FontWeight.w300,
                  color:
                      isDark
                          ? (isSelected ? Colors.white : Colors.white70)
                          : (isSelected ? Colors.black87 : Colors.black54),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentForm() {
    switch (_selectedTab) {
      case 0:
        return const SignInForm();
      case 1:
        return const SignUpForm();
      case 2:
        return const ForgotPasswordForm();
      default:
        return const SignInForm();
    }
  }

  Widget _buildForgotPasswordButton(bool isDark) {
    return GestureDetector(
      onTap: () => _changeTab(2),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
        child: Text(
          'Забыли пароль?',
          style: TextStyle(
            color: isDark ? Colors.white70 : Colors.black45,
            fontSize: 14,
            fontWeight: FontWeight.w300,
            decoration: TextDecoration.underline,
            decorationColor: isDark ? Colors.white30 : Colors.black38,
          ),
        ),
      ),
    );
  }
}
