import 'package:flutter/material.dart';

import 'package:Ren/core/utils/logout/logout.dart';

import 'package:Ren/core/models/user.chats.model.dart';

import 'package:Ren/ui/widgets/desktop/desktop_home_screen.dart';
import 'package:Ren/ui/widgets/mobile/mobile_home_screen.dart';
import 'package:Ren/ui/widgets/animatedgradient.dart';

class HomeScreen extends StatefulWidget {
  final List<Chats> chats;
  const HomeScreen({Key? key, required this.chats}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  late AnimationController _backgroundController;
  late AnimationController _fadeController;
  late Animation<double> _backgroundAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();

    // Контроллер для анимации фона
    _backgroundController = AnimationController(
      duration: const Duration(seconds: 8),
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
  }

  @override
  void dispose() {
    _backgroundController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedBuilder(
        animation: Listenable.merge([_backgroundAnimation, _fadeAnimation]),
        builder: (context, child) {
          return Container(
            width: double.infinity,
            height: double.infinity,
            decoration: BoxDecoration(
              gradient: AnimatedGradientUtils.buildAnimatedGradient(
                _backgroundAnimation.value,
                Theme.of(context).brightness == Brightness.dark,
              ),
            ),
            child: FadeTransition(opacity: _fadeAnimation, child: child),
          );
        },
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth > 720) {
              return DesktopHomeScreen(
                chats: widget.chats,
                onLogout: () => Logout.logout(context, 0),
              );
            } else {
              return MobileHomeScreen(
                chats: widget.chats,
                onLogout: () => Logout.logout(context, 0),
              );
            }
          },
        ),
      ),
    );
  }
}
