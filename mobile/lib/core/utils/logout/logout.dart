import 'package:provider/provider.dart';
import 'package:flutter/material.dart';

import 'package:Ren/core/models/notification.dart';

import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/ui/pages/splash/splash_screen.dart';

class Logout {
  static Future<void> logout(BuildContext context, int type) async {
    late Color color;
    late String title;
    late String text;

    if (type == 401 || type == 403) {
      color = Color.fromARGB(255, 121, 50, 17);
      title = 'Ошибка';
      text = 'Вы не авторизованы';
    } else if (type == 0) {
      color = Color.fromARGB(255, 121, 105, 17);
      title = 'Успешный выход';
      text = 'Вы успешно вышли из аккаунта';
    } else {
      color = Color.fromARGB(255, 88, 36, 12);
      title = 'Ошибка';
      text = 'Произошла неизвестная ошибка';
    }

    await Provider.of<CryptoProvider>(context, listen: false).clearKeys();

    // Создаем объект с данными уведомления
    final notificationData = NotificationData(
      title: title,
      message: text,
      color: color,
      duration: const Duration(seconds: 4),
    );

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder:
            (context, animation, secondaryAnimation) =>
                SplashScreen(notificationData: notificationData),
        transitionDuration: const Duration(milliseconds: 800),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }
}
