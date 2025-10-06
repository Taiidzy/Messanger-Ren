import 'dart:convert';
import 'package:http/http.dart' as http;

import 'package:Ren/core/utils/constants/apiurl.dart';

import 'package:Ren/core/utils/logger/logger.dart';

class AuthApi {
  static Future<Map<String, dynamic>> login(
    String login,
    String password,
  ) async {
    logger.d("Logging in");
    final response = await http.post(
      Uri.parse('${Apiurl.AUTH_SERVICE}/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'login': login, 'password': password}),
    );

    if (response.statusCode == 200) {
      logger.d("Login successful");
      return json.decode(response.body);
    } else {
      // Парсим сообщение об ошибке из JSON
      final errorResponse = json.decode(response.body);
      final errorMessage = errorResponse['detail'] ?? 'Login failed';

      logger.e(
        "Login failed with status code ${response.statusCode}, body: ${response.body}",
      );

      // Возвращаем статус и сообщение об ошибке
      return {
        'status': response.statusCode,
        'message': errorMessage, // Используем сообщение от сервера
        'isError': true, // Добавляем флаг ошибки для удобства
      };
    }
  }
}
