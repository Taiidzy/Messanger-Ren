import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:Ren/core/encryption/cryptoprovider.dart';

import 'package:Ren/ui/pages/splash/splash_screen.dart';
import 'package:Ren/ui/theme/themes.dart';

void main() {
  runApp(const MessengerApp());
}

class MessengerApp extends StatelessWidget {
  const MessengerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => CryptoProvider(),
      child: MaterialApp(
        title: 'Ren',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system, // авто переключение
        home: const SplashScreen(),
      ),
    );
  }
}
