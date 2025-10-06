import 'package:hugeicons/hugeicons.dart';
import 'package:flutter/material.dart';
import 'dart:ui';

class GlassmorphicButton extends StatelessWidget {
  final VoidCallback onPressed;
  final String? text;
  final HugeIcon? prefixIcon;

  const GlassmorphicButton({
    Key? key,
    required this.onPressed,
    this.text,
    this.prefixIcon,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: double.infinity,
      height: 50,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: isDark
            ? Colors.white.withOpacity(0.1)
            : Colors.white.withOpacity(0.3),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.15)
              : Colors.white.withOpacity(0.4),
          width: 0.5,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withOpacity(0.15)
                : Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onPressed,
              borderRadius: BorderRadius.circular(16),
              splashColor: isDark
                  ? Colors.white.withOpacity(0.08)
                  : Colors.white.withOpacity(0.2),
              highlightColor: isDark
                  ? Colors.white.withOpacity(0.03)
                  : Colors.white.withOpacity(0.1),
              child: Center(
                child: prefixIcon != null
                    ? HugeIcon(
                        icon: prefixIcon!.icon,
                        size: prefixIcon!.size,
                        color: isDark ? Colors.white : Colors.black87,
                      )
                    : Text(
                        text ?? '',
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.5,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
