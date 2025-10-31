import 'package:flutter/material.dart';

// Базовый роутер на Navigator. Можем расширять по мере необходимости.
class AppRouter {
  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    // Пока вся навигация вручную через MaterialPageRoute там, где нужно
    return MaterialPageRoute(builder: (_) => const SizedBox());
  }
}
