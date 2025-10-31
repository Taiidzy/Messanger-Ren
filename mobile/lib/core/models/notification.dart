import 'package:flutter/material.dart';

class NotificationData {
  final String title;
  final String message;
  final Color color;
  final Duration duration;

  NotificationData({
    required this.title,
    required this.message,
    required this.color,
    required this.duration,
  });
}
