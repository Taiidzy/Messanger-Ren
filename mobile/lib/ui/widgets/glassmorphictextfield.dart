import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'dart:ui';

class GlassmorphicTextField extends StatefulWidget {
  final TextEditingController controller;
  final String hintText;
  final HugeIcon? prefixIcon;
  final bool obscureText;
  final Widget? suffixIcon;

  const GlassmorphicTextField({
    Key? key,
    required this.controller,
    required this.hintText,
    this.prefixIcon,
    this.obscureText = false,
    this.suffixIcon,
  }) : super(key: key);

  @override
  State<GlassmorphicTextField> createState() => _GlassmorphicTextFieldState();
}

class _GlassmorphicTextFieldState extends State<GlassmorphicTextField> {
  bool _isFocused = false;

  Color _getIconColor(bool isDark) {
    if (isDark) {
      return _isFocused
          ? const Color(0xFF8B5CF6) // Purple-500
          : Colors.white.withOpacity(0.6);
    } else {
      return _isFocused
          ? const Color(0xFFEC4899) // Pink-500
          : const Color(0xFF6B7280); // Gray-500
    }
  }

  Color _getBorderColor(bool isDark) {
    if (isDark) {
      return _isFocused
          ? const Color(0xFF8B5CF6).withOpacity(0.6) // Purple-500/60
          : Colors.white.withOpacity(0.2);
    } else {
      return _isFocused
          ? const Color(0xFFEC4899).withOpacity(0.6) // Pink-500/60
          : Colors.white.withOpacity(0.6);
    }
  }

  Color _getBackgroundColor(bool isDark) {
    if (isDark) {
      return _isFocused
          ? Colors.white.withOpacity(0.12)
          : Colors.white.withOpacity(0.08);
    } else {
      return _isFocused
          ? Colors.white.withOpacity(0.8)
          : Colors.white.withOpacity(0.6);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: _getBackgroundColor(isDark),
        border: Border.all(
          color: _getBorderColor(isDark),
          width: _isFocused ? 1.5 : 1,
        ),
        boxShadow: [
          if (_isFocused) ...[
            BoxShadow(
              color: isDark
                  ? const Color(0xFF8B5CF6).withOpacity(0.2)
                  : const Color(0xFFEC4899).withOpacity(0.2),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
          BoxShadow(
            color: isDark
                ? Colors.black.withOpacity(0.2)
                : Colors.black.withOpacity(0.05),
            blurRadius: _isFocused ? 8 : 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Focus(
            onFocusChange: (hasFocus) {
              setState(() {
                _isFocused = hasFocus;
              });
            },
            child: TextField(
              controller: widget.controller,
              obscureText: widget.obscureText,
              style: TextStyle(
                color: isDark
                    ? const Color(0xFFF9FAFB) // Очень светлый для читаемости
                    : const Color(0xFF1F2937), // Темно-серый для контраста
                fontSize: 15,
                fontWeight: FontWeight.w400,
              ),
              decoration: InputDecoration(
                hintText: widget.hintText,
                hintStyle: TextStyle(
                  color: isDark
                      ? Colors.white.withOpacity(0.5)
                      : const Color(0xFF6B7280), // Gray-500
                  fontSize: 15,
                  fontWeight: FontWeight.w300,
                ),
                prefixIcon: widget.prefixIcon != null
                    ? AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        child: HugeIcon(
                          icon: widget.prefixIcon!.icon,
                          size: widget.prefixIcon!.size,
                          color: _getIconColor(isDark),
                        ),
                      )
                    : null,
                suffixIcon: widget.suffixIcon != null
                    ? AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        child: widget.suffixIcon,
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 18, // Увеличена высота для лучшего UX
                ),
                filled: false,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
