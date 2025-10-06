import 'package:flutter/material.dart';
import 'package:another_flushbar/flushbar.dart';

class Notifications {
  static void showSystemNotification(
    String title,
    String message,
    BuildContext context,
    Duration duration,
    Color color,
  ) {
    Flushbar(
      title: title,
      titleColor: Colors.white,
      message: message,
      flushbarPosition: FlushbarPosition.TOP,
      margin: EdgeInsets.all(8),
      borderRadius: BorderRadius.circular(8),
      flushbarStyle: FlushbarStyle.FLOATING,
      reverseAnimationCurve: Curves.decelerate,
      forwardAnimationCurve: Curves.elasticOut,
      backgroundColor: color,
      duration: Duration(seconds: duration.inSeconds),
    ).show(context);
  }
}
