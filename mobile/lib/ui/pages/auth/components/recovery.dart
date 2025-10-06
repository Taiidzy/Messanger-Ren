import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';

import 'package:Ren/ui/widgets/glassmorphictextfield.dart';
import 'package:Ren/ui/widgets/glassmorphicbutton.dart';

class ForgotPasswordForm extends StatefulWidget {
  const ForgotPasswordForm({Key? key}) : super(key: key);

  @override
  State<ForgotPasswordForm> createState() => _ForgotPasswordFormState();
}

class _ForgotPasswordFormState extends State<ForgotPasswordForm> {
  final _loginController = TextEditingController();
  final _keyController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      children: [
        Text(
          'Сброс пароля',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w300,
            color: isDark ? Colors.white : Colors.black87,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 32),
        Text(
          'Введите логин и ключ доступа, чтобы сбросить пароль.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13,
            color: isDark ? Colors.white60 : Colors.black54,
            height: 1.4,
            fontWeight: FontWeight.w300,
          ),
        ),
        const SizedBox(height: 32),
        GlassmorphicTextField(
          controller: _loginController,
          hintText: 'Логин',
          prefixIcon: HugeIcon(
            icon: HugeIcons.strokeRoundedUser,
            color: Colors.red,
            size: 20.0,
          ),
        ),
        const SizedBox(height: 32),
        GlassmorphicTextField(
          controller: _keyController,
          hintText: 'Ключ доступа',
          prefixIcon: HugeIcon(
            icon: HugeIcons.strokeRoundedLockKey,
            color: Colors.red,
            size: 20.0,
          ),
        ),
        const SizedBox(height: 32),
        GlassmorphicButton(
          onPressed: () {
            // Логика восстановления пароля
          },
          text: 'Далее',
        ),
      ],
    );
  }
}
