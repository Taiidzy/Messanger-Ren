import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:Ren/ui/theme/themes.dart';
import 'package:Ren/core/encryption/cryptoprovider.dart';
import 'package:Ren/ui/pages/splash/splash_screen.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => CryptoProvider(),
      child: MaterialApp(
        title: 'Ren',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system,
        home: const SplashScreen(),
      ),
    );
  }
}
