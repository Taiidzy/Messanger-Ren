import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:Ren/ui/theme/themes.dart';

class AnimatedGradientUtils {
  /// Создает современный анимированный градиент
  ///
  /// [animationValue] - значение анимации от 0.0 до 1.0
  /// [isDarkMode] - флаг темной темы
  ///
  /// Возвращает LinearGradient с плавными анимированными переходами
  static LinearGradient buildAnimatedGradient(
    double animationValue,
    bool isDarkMode,
  ) {
    final t = animationValue;

    if (isDarkMode) {
      // Темная тема: минималистичные переходы
      final baseColor1 = AppColors.darkBackground;
      final baseColor2 = AppColors.darkSurface;
      final accentColor = AppColors.primary.withOpacity(0.05);

      final color1 =
          Color.lerp(
            baseColor1,
            Color.lerp(baseColor2, accentColor, 0.3)!,
            (math.sin(t * math.pi * 0.8) * 0.1 + 0.5).clamp(0.0, 1.0),
          )!;

      final color2 =
          Color.lerp(
            baseColor2,
            Color.lerp(baseColor1, accentColor, 0.2)!,
            (math.cos(t * math.pi * 0.6) * 0.08 + 0.5).clamp(0.0, 1.0),
          )!;

      final color3 =
          Color.lerp(
            AppColors.darkCard.withOpacity(0.8),
            baseColor1,
            (math.sin(t * math.pi * 0.9 + math.pi * 0.5) * 0.12 + 0.5).clamp(
              0.0,
              1.0,
            ),
          )!;

      return LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [color1, color2, color3],
        stops: [
          0.0,
          (0.5 + math.sin(t * math.pi * 0.4) * 0.1).clamp(0.3, 0.7),
          1.0,
        ],
      );
    } else {
      // Светлая тема: чистые, минималистичные цвета
      final baseColor1 = AppColors.lightBackground;
      final baseColor2 = AppColors.lightSurface;
      final accentColor1 = AppColors.primary.withOpacity(0.03);
      final accentColor2 = AppColors.secondary.withOpacity(0.02);

      final color1 =
          Color.lerp(
            baseColor1,
            Color.lerp(baseColor1, accentColor1, 0.5)!,
            (math.sin(t * math.pi * 0.7) * 0.08 + 0.5).clamp(0.0, 1.0),
          )!;

      final color2 =
          Color.lerp(
            baseColor2,
            Color.lerp(AppColors.neutral50, accentColor2, 0.6)!,
            (math.cos(t * math.pi * 0.5) * 0.06 + 0.5).clamp(0.0, 1.0),
          )!;

      final color3 =
          Color.lerp(
            AppColors.neutral100.withOpacity(0.7),
            baseColor1,
            (math.sin(t * math.pi * 0.6 + math.pi * 0.3) * 0.1 + 0.5).clamp(
              0.0,
              1.0,
            ),
          )!;

      return LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [color1, color2, color3],
        stops: [
          0.0,
          (0.5 + math.cos(t * math.pi * 0.3) * 0.08).clamp(0.35, 0.65),
          1.0,
        ],
      );
    }
  }

  /// Создает статический градиент без анимации
  static LinearGradient buildStaticGradient(bool isDarkMode) {
    if (isDarkMode) {
      return LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          AppColors.darkBackground,
          AppColors.darkSurface,
          AppColors.darkCard.withOpacity(0.8),
        ],
        stops: const [0.0, 0.6, 1.0],
      );
    } else {
      return LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          AppColors.lightBackground,
          AppColors.lightSurface,
          AppColors.neutral50,
        ],
        stops: const [0.0, 0.5, 1.0],
      );
    }
  }

  /// Создает кастомный анимированный градиент с заданными цветами
  static LinearGradient buildCustomAnimatedGradient({
    required double animationValue,
    required List<Color> colors,
    Alignment begin = Alignment.topLeft,
    Alignment end = Alignment.bottomRight,
    double intensity =
        0.05, // Интенсивность анимации (уменьшена для минимализма)
  }) {
    final t = animationValue;

    // Генерируем очень плавные анимированные stops
    List<double> stops = [];
    for (int i = 0; i < colors.length; i++) {
      double baseStop = i / (colors.length - 1);
      // Минимальные изменения для плавности
      double offset = math.sin(t * math.pi * 0.6 + i * 0.8) * intensity;
      double smoothStop = (baseStop + offset).clamp(0.0, 1.0);
      stops.add(smoothStop);
    }

    // Обеспечиваем правильный порядок stops
    for (int i = 1; i < stops.length; i++) {
      if (stops[i] <= stops[i - 1]) {
        stops[i] = stops[i - 1] + 0.01;
      }
    }

    // Нормализуем последний stop
    if (stops.last > 1.0) {
      stops[stops.length - 1] = 1.0;
    }

    return LinearGradient(begin: begin, end: end, colors: colors, stops: stops);
  }

  /// Создает градиент для карточек с тонкой анимацией
  static LinearGradient buildCardGradient(
    double animationValue,
    bool isDarkMode, {
    bool isHovered = false,
  }) {
    final t = animationValue;

    if (isDarkMode) {
      final baseColor = AppColors.darkCard;
      final hoverColor = AppColors.primary.withOpacity(0.08);

      final color1 =
          Color.lerp(
            baseColor,
            isHovered ? Color.lerp(baseColor, hoverColor, 0.5)! : baseColor,
            (math.sin(t * math.pi * 0.4) * 0.05 + 0.5).clamp(0.0, 1.0),
          )!;

      final color2 =
          Color.lerp(
            AppColors.darkSurface,
            isHovered
                ? Color.lerp(AppColors.darkSurface, hoverColor, 0.3)!
                : AppColors.darkSurface,
            (math.cos(t * math.pi * 0.3) * 0.03 + 0.5).clamp(0.0, 1.0),
          )!;

      return LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [color1, color2],
      );
    } else {
      final baseColor = AppColors.lightCard;
      final hoverColor = AppColors.primary.withOpacity(0.04);

      final color1 =
          Color.lerp(
            baseColor,
            isHovered ? Color.lerp(baseColor, hoverColor, 0.6)! : baseColor,
            (math.sin(t * math.pi * 0.4) * 0.03 + 0.5).clamp(0.0, 1.0),
          )!;

      final color2 =
          Color.lerp(
            AppColors.neutral50,
            isHovered
                ? Color.lerp(AppColors.neutral50, hoverColor, 0.4)!
                : AppColors.neutral50,
            (math.cos(t * math.pi * 0.3) * 0.02 + 0.5).clamp(0.0, 1.0),
          )!;

      return LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [color1, color2],
      );
    }
  }

  /// Создает очень тонкий, едва заметный анимированный градиент
  static LinearGradient buildSubtleAnimatedGradient(
    double animationValue,
    bool isDarkMode,
  ) {
    final t = animationValue;

    if (isDarkMode) {
      // Очень тонкие изменения для темной темы
      final baseColor = AppColors.darkBackground;
      final variation = AppColors.primary.withOpacity(0.015);

      final color1 =
          Color.lerp(
            baseColor,
            Color.lerp(baseColor, variation, 0.8)!,
            (math.sin(t * math.pi * 0.3) * 0.02 + 0.5).clamp(0.0, 1.0),
          )!;

      return LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [color1, baseColor],
        stops: const [0.0, 1.0],
      );
    } else {
      // Очень тонкие изменения для светлой темы
      final baseColor = AppColors.lightBackground;
      final variation = AppColors.secondary.withOpacity(0.01);

      final color1 =
          Color.lerp(
            baseColor,
            Color.lerp(baseColor, variation, 0.9)!,
            (math.sin(t * math.pi * 0.25) * 0.015 + 0.5).clamp(0.0, 1.0),
          )!;

      return LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [color1, baseColor],
        stops: const [0.0, 1.0],
      );
    }
  }
}
