import 'package:flutter/material.dart';
import 'dart:math' as math;

/// Виджет логотипа Ren с анимацией орбитальных путей
class RenLogo extends StatefulWidget {
  /// Размер логотипа
  final double size;

  /// Продолжительность анимации орбит
  final Duration animationDuration;

  /// Размер текста "Ren"
  final double fontSize;

  /// Толщина орбитальных линий
  final double strokeWidth;

  /// Радиус точек на орбитах
  final double dotRadius;

  /// Включить/выключить автоматическую анимацию
  final bool autoAnimate;

  /// Кастомный контроллер анимации (опционально)
  final AnimationController? controller;

  const RenLogo({
    Key? key,
    this.size = 200.0,
    this.animationDuration = const Duration(seconds: 12),
    this.fontSize = 32.0,
    this.strokeWidth = 1.5,
    this.dotRadius = 3.5,
    this.autoAnimate = true,
    this.controller,
  }) : super(key: key);

  @override
  State<RenLogo> createState() => _RenLogoState();
}

class _RenLogoState extends State<RenLogo> with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _rotationAnimation;
  bool _isControllerLocal = false;

  @override
  void initState() {
    super.initState();
    _initializeAnimation();
  }

  void _initializeAnimation() {
    if (widget.controller != null) {
      _controller = widget.controller!;
      _isControllerLocal = false;
    } else {
      _controller = AnimationController(
        duration: widget.animationDuration,
        vsync: this,
      );
      _isControllerLocal = true;

      if (widget.autoAnimate) {
        _controller.repeat();
      }
    }

    _rotationAnimation = Tween<double>(
      begin: 0.0,
      end: 2 * math.pi,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.linear));
  }

  @override
  void didUpdateWidget(RenLogo oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Если изменился контроллер или настройки анимации
    if (oldWidget.controller != widget.controller ||
        oldWidget.animationDuration != widget.animationDuration ||
        oldWidget.autoAnimate != widget.autoAnimate) {
      if (_isControllerLocal) {
        _controller.dispose();
      }

      _initializeAnimation();
    }
  }

  @override
  void dispose() {
    if (_isControllerLocal) {
      _controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _rotationAnimation,
        builder: (context, child) {
          return CustomPaint(
            painter: RenLogoPainter(
              animation: _rotationAnimation.value,
              isDarkMode: Theme.of(context).brightness == Brightness.dark,
              fontSize: widget.fontSize,
              strokeWidth: widget.strokeWidth,
              dotRadius: widget.dotRadius,
            ),
          );
        },
      ),
    );
  }
}

/// Painter для рисования логотипа Ren
class RenLogoPainter extends CustomPainter {
  final double animation;
  final bool isDarkMode;
  final double fontSize;
  final double strokeWidth;
  final double dotRadius;

  RenLogoPainter({
    required this.animation,
    required this.isDarkMode,
    this.fontSize = 32.0,
    this.strokeWidth = 1.5,
    this.dotRadius = 3.5,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final baseRadius = size.width * 0.35;

    // Цвета для орбит и точек
    final orbitalColor = isDarkMode
        ? Colors.white.withOpacity(0.8)
        : const Color(0xFF1A1B2E).withOpacity(0.8);

    final dotColor = isDarkMode ? Colors.white : const Color(0xFF1A1B2E);

    // Настройки для орбит
    final orbitalPaint = Paint()
      ..color = orbitalColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    final dotPaint = Paint()
      ..color = dotColor
      ..style = PaintingStyle.fill;

    // Рисуем 2 пересекающиеся орбиты (как знак бесконечности)
    canvas.save();
    canvas.translate(center.dx, center.dy);

    // Первая орбита (наклонена влево)
    _drawOrbit(
      canvas,
      orbitalPaint,
      dotPaint,
      baseRadius,
      -math.pi / 4, // Наклон -45 градусов
      animation * 1 * math.pi,
      dotColor,
    );

    // Вторая орбита (наклонена вправо)
    _drawOrbit(
      canvas,
      orbitalPaint,
      dotPaint,
      baseRadius,
      math.pi / 4, // Наклон +45 градусов
      -animation * 0.75 * math.pi, // Другая скорость и направление
      dotColor,
    );

    canvas.restore();

    // Рисуем центральный текст "Ren"
    _drawCenterText(canvas, center, dotColor);

    // Добавляем пульсирующее свечение вокруг текста
    _drawGlow(canvas, center, dotColor);
  }

  void _drawOrbit(
    Canvas canvas,
    Paint orbitalPaint,
    Paint dotPaint,
    double baseRadius,
    double rotation,
    double dotAngle,
    Color dotColor,
  ) {
    canvas.save();
    canvas.rotate(rotation);

    final rect = Rect.fromCenter(
      center: Offset.zero,
      width: baseRadius * 2,
      height: baseRadius * 0.6,
    );

    canvas.drawOval(rect, orbitalPaint);

    // Точки на орбите
    final dotX = (baseRadius * 0.9) * math.cos(dotAngle);
    final dotY = (baseRadius * 0.25) * math.sin(dotAngle);

    // Основная точка
    canvas.drawCircle(Offset(dotX, dotY), dotRadius, dotPaint);

    // Вторая точка на противоположной стороне орбиты
    canvas.drawCircle(
      Offset(-dotX, -dotY),
      dotRadius * 0.7,
      dotPaint..color = dotColor.withOpacity(0.6),
    );

    canvas.restore();
  }

  void _drawCenterText(Canvas canvas, Offset center, Color textColor) {
    final textPainter = TextPainter(
      text: TextSpan(
        text: 'Ren',
        style: TextStyle(
          color: textColor,
          fontSize: fontSize,
          fontWeight: FontWeight.w300,
          letterSpacing: 2,
        ),
      ),
      textDirection: TextDirection.ltr,
    );

    textPainter.layout();

    final textOffset = Offset(
      center.dx - textPainter.width / 2,
      center.dy - textPainter.height / 2,
    );

    textPainter.paint(canvas, textOffset);
  }

  void _drawGlow(Canvas canvas, Offset center, Color glowColor) {
    final glowPaint = Paint()
      ..color = glowColor.withOpacity(
        0.1 + 0.1 * math.sin(animation * 4 * math.pi),
      )
      ..style = PaintingStyle.fill
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10);

    final glowRadius = 40 + 5 * math.sin(animation * 3 * math.pi);
    canvas.drawCircle(center, glowRadius, glowPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

/// Расширенная версия логотипа с дополнительными настройками стиля
class RenLogoStyled extends StatelessWidget {
  final double size;
  final Duration animationDuration;
  final Color? primaryColor;
  final Color? secondaryColor;
  final double fontSize;
  final String text;
  final bool showGlow;
  final AnimationController? controller;

  const RenLogoStyled({
    Key? key,
    this.size = 200.0,
    this.animationDuration = const Duration(seconds: 12),
    this.primaryColor,
    this.secondaryColor,
    this.fontSize = 32.0,
    this.text = 'Ren',
    this.showGlow = true,
    this.controller,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: RenLogoStyledPainter(
          animation: controller?.value ?? 0.0,
          primaryColor:
              primaryColor ??
              (Theme.of(context).brightness == Brightness.dark
                  ? Colors.white
                  : const Color(0xFF1A1B2E)),
          secondaryColor: secondaryColor,
          fontSize: fontSize,
          text: text,
          showGlow: showGlow,
        ),
      ),
    );
  }
}

/// Кастомный painter для стилизованной версии
class RenLogoStyledPainter extends CustomPainter {
  final double animation;
  final Color primaryColor;
  final Color? secondaryColor;
  final double fontSize;
  final String text;
  final bool showGlow;

  RenLogoStyledPainter({
    required this.animation,
    required this.primaryColor,
    this.secondaryColor,
    this.fontSize = 32.0,
    this.text = 'Ren',
    this.showGlow = true,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final baseRadius = size.width * 0.35;

    // Орбитальные линии
    final orbitalPaint = Paint()
      ..color = primaryColor.withOpacity(0.8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final dotPaint = Paint()
      ..color = primaryColor
      ..style = PaintingStyle.fill;

    canvas.save();
    canvas.translate(center.dx, center.dy);

    // Рисуем орбиты и точки (аналогично основному painter'у)
    _drawStyledOrbit(
      canvas,
      orbitalPaint,
      dotPaint,
      baseRadius,
      -math.pi / 4,
      animation * 2 * math.pi,
    );
    _drawStyledOrbit(
      canvas,
      orbitalPaint,
      dotPaint,
      baseRadius,
      math.pi / 4,
      -animation * 1.5 * math.pi,
    );

    canvas.restore();

    // Центральный текст
    final textPainter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: primaryColor,
          fontSize: fontSize,
          fontWeight: FontWeight.w300,
          letterSpacing: 2,
        ),
      ),
      textDirection: TextDirection.ltr,
    );

    textPainter.layout();
    final textOffset = Offset(
      center.dx - textPainter.width / 2,
      center.dy - textPainter.height / 2,
    );
    textPainter.paint(canvas, textOffset);

    // Опциональное свечение
    if (showGlow) {
      final glowPaint = Paint()
        ..color = primaryColor.withOpacity(
          0.1 + 0.1 * math.sin(animation * 4 * math.pi),
        )
        ..style = PaintingStyle.fill
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10);

      final glowRadius = 40 + 5 * math.sin(animation * 3 * math.pi);
      canvas.drawCircle(center, glowRadius, glowPaint);
    }
  }

  void _drawStyledOrbit(
    Canvas canvas,
    Paint orbitalPaint,
    Paint dotPaint,
    double baseRadius,
    double rotation,
    double dotAngle,
  ) {
    canvas.save();
    canvas.rotate(rotation);

    final rect = Rect.fromCenter(
      center: Offset.zero,
      width: baseRadius * 2,
      height: baseRadius * 0.6,
    );

    canvas.drawOval(rect, orbitalPaint);

    final dotX = (baseRadius * 0.9) * math.cos(dotAngle);
    final dotY = (baseRadius * 0.25) * math.sin(dotAngle);

    canvas.drawCircle(Offset(dotX, dotY), 3.5, dotPaint);
    canvas.drawCircle(
      Offset(-dotX, -dotY),
      2.5,
      dotPaint..color = primaryColor.withOpacity(0.6),
    );

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
