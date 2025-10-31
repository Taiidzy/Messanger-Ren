import 'dart:async';

import 'package:Ren/core/services/online_status_service.dart';

/// Контроллер онлайн-статусов. Инкапсулирует логику сервиса от UI.
class OnlineStatusController {
  final OnlineStatusService _service;

  OnlineStatusController({OnlineStatusService? service})
      : _service = service ?? OnlineStatusService();

  Stream<Map<int, UserOnlineStatus>> get statusStream => _service.statusStream;

  bool isUserOnline(int userId) => _service.isUserOnline(userId);

  void initialize(String token, List<int> companionIds) {
    if (token.isEmpty || companionIds.isEmpty) return;
    _service.initialize(token, companionIds);
  }

  void dispose() {
    _service.dispose();
  }
}
