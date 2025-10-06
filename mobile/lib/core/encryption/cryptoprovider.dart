import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:pointycastle/export.dart';

import 'package:Ren/core/storage/securestorage.dart';
import 'package:Ren/core/utils/constants/keys.dart';
import 'package:Ren/core/encryption/crypto.dart';
import 'package:Ren/core/api/auth/auth.dart'; // Замените на ваш API логина

class LoginResult {
  final int status;
  final String? message;

  LoginResult({required this.status, this.message});
}

// Эта функция будет выполняться в отдельном изоляте.
// Параметр — простой Map<String, String>, т.к. compute требует сериализуемый аргумент.
// helper — топ-левел функция (compute требует top-level или static)
String _deriveAndDecryptInIsolate(Map<String, String> params) {
  final masterKey = Crypto.deriveKeyFromPassword(
    params['password']!,
    params['salt']!,
  );

  final encrypted = params['encryptedPrivateKey']!;

  // логика парсинга/декодинга как раньше...
  try {
    final parsed = jsonDecode(encrypted);
    if (parsed is Map) {
      final ciphertext = parsed['ciphertext'] as String?;
      final iv = parsed['nonce'] as String? ?? parsed['iv'] as String?;
      if (ciphertext != null && iv != null) {
        return Crypto.decryptData(ciphertext, masterKey, iv);
      } else if (ciphertext != null) {
        final bytes = base64.decode(ciphertext);
        if (bytes.length > 12) {
          final ivBytes = bytes.sublist(0, 12);
          final cipherBytes = bytes.sublist(12);
          final ivB64 = base64.encode(ivBytes);
          final cipherB64 = base64.encode(cipherBytes);
          return Crypto.decryptData(cipherB64, masterKey, ivB64);
        } else {
          return Crypto.decryptData(ciphertext, masterKey, '');
        }
      }
    }
  } catch (_) {}

  try {
    final bytes = base64.decode(encrypted);
    if (bytes.length > 12) {
      final ivBytes = bytes.sublist(0, 12);
      final cipherBytes = bytes.sublist(12);
      final ivB64 = base64.encode(ivBytes);
      final cipherB64 = base64.encode(cipherBytes);
      return Crypto.decryptData(cipherB64, masterKey, ivB64);
    } else {
      return Crypto.decryptData(encrypted, masterKey, '');
    }
  } catch (e) {
    throw Exception('Failed to parse encryptedPrivateKey in isolate: $e');
  }
}

class CryptoProvider extends ChangeNotifier {
  ECPrivateKey? _privateKey;
  ECPublicKey? _publicKey;
  String? _token;
  int? _userId;
  bool _isAuthenticated = false;
  bool _isLoadingKeys = false;

  // Getters
  ECPrivateKey? get privateKey => _privateKey;
  ECPublicKey? get publicKey => _publicKey;
  String? get token => _token;
  int? get userId => _userId;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoadingKeys => _isLoadingKeys;

  // Сохранение ключей в ваше защищенное хранилище
  Future<void> _saveKeysToStorage(
    ECPrivateKey privateKey,
    ECPublicKey publicKey,
    String token,
    int userId,
  ) async {
    try {
      final privateKeyString = Crypto.privateKeyToString(privateKey);
      final publicKeyString = Crypto.publicKeyToString(publicKey);

      await SecureStorage.writeKey(Keys.PrivateKey, privateKeyString);
      await SecureStorage.writeKey(Keys.PublicKey, publicKeyString);
      await SecureStorage.writeKey(Keys.Token, token);
      await SecureStorage.writeKey(Keys.UserId, userId.toString());
    } catch (error) {
      debugPrint('Error saving keys to secure storage: $error');
      rethrow;
    }
  }

  // Загрузка ключей из вашего защищенного хранилища
  Future<bool> _loadKeysFromStorage() async {
    try {
      final privateKeyString = await SecureStorage.readKey(Keys.PrivateKey);
      final publicKeyString = await SecureStorage.readKey(Keys.PublicKey);
      final token = await SecureStorage.readKey(Keys.Token);
      final userId = await SecureStorage.readKey(Keys.UserId);

      if (privateKeyString != null && publicKeyString != null) {
        _privateKey = Crypto.privateKeyFromString(privateKeyString);
        _publicKey = Crypto.publicKeyFromString(publicKeyString);
        _token = token;
        _userId = int.tryParse(userId ?? '0') ?? 0;
        return true;
      }
      return false;
    } catch (error) {
      debugPrint('Error loading keys from secure storage: $error');
      return false;
    }
  }

  // Очистка ключей (используем ваш метод)
  Future<void> _clearKeysFromStorage() async {
    try {
      await SecureStorage.deleteAllKeys();
    } catch (error) {
      debugPrint('Error deleting keys from secure storage: $error');
    }
  }

  // Установка ключей и сохранение их в хранилище
  Future<void> setKeys(
    ECPrivateKey privateKey,
    ECPublicKey publicKey,
    String token,
    int userId,
  ) async {
    _privateKey = privateKey;
    _publicKey = publicKey;
    _token = token;
    _userId = userId;
    _isAuthenticated = true;

    await _saveKeysToStorage(privateKey, publicKey, token, userId);
    notifyListeners();
  }

  // Очистка ключей
  Future<void> clearKeys() async {
    _privateKey = null;
    _publicKey = null;
    _isAuthenticated = false;
    _token = null;
    _userId = null;

    await _clearKeysFromStorage();
    notifyListeners();
  }

  // Загрузка ключей при логине
  Future<LoginResult> loadKeysOnLogin(String login, String password) async {
    _isLoadingKeys = true;
    notifyListeners();

    try {
      // Здесь должен быть вызов вашего API для логина
      final result = await AuthApi.login(login, password);

      if (result['status'] == 401) {
        return LoginResult(
          status: result['status'],
          message: result['message'],
        );
      }

      if (result['access_token'] != null &&
          result['encryptedPrivateKeyByUser'] != null &&
          result['salt'] != null &&
          result['publicKey'] != null) {
        // Сохраняем токен в ваше secure storage
        await SecureStorage.writeKey(Keys.Token, result['access_token']);

        // prepare map for isolate (compute)
        final params = <String, String>{
          'password': password,
          'salt': result['salt'] as String,
          'encryptedPrivateKey': result['encryptedPrivateKeyByUser'] as String,
        };

        final privateKeyString = await compute<Map<String, String>, String>(
          _deriveAndDecryptInIsolate,
          params,
        );

        // Импортируем ключи
        final privateKeyObj = Crypto.privateKeyFromString(privateKeyString);
        final publicKeyObj = Crypto.publicKeyFromString(result['publicKey']);

        await setKeys(
          privateKeyObj,
          publicKeyObj,
          result['access_token'],
          result['user_id'],
        );

        return LoginResult(status: 200, message: "Вы успешно вошли в аккаунт.");
      } else {
        return LoginResult(
          status: result['status'] ?? 500,
          message: result['message'] ?? "Неизвестная ошибка",
        );
      }
    } catch (error) {
      debugPrint('Error loading keys on login: $error');
      return LoginResult(status: 0, message: error.toString());
    } finally {
      _isLoadingKeys = false;
      notifyListeners();
    }
  }

  // Инициализация провайдера (загрузка сохраненных ключей)
  Future<void> initialize() async {
    _isLoadingKeys = true;
    // Не вызываем notifyListeners() сразу, так как это может быть в фазе билда

    try {
      final keysLoaded = await _loadKeysFromStorage();

      if (keysLoaded) {
        _isAuthenticated = true;
      }
      // Не очищаем токен здесь - это сделает CheckAuth при необходимости
    } catch (error) {
      debugPrint('Error initializing crypto provider: $error');
    } finally {
      _isLoadingKeys = false;
      // Вызываем notifyListeners() только один раз в конце
      notifyListeners();
    }
  }

  // Получение токена из хранилища
  Future<String?> getToken() async {
    return await SecureStorage.readKey(Keys.Token);
  }

  // Метод для получения приватного ключа в виде строки
  String? get privateKeyString {
    return _privateKey != null ? Crypto.privateKeyToString(_privateKey!) : null;
  }

  // Метод для получения публичного ключа в виде строки
  String? get publicKeyString {
    return _publicKey != null ? Crypto.publicKeyToString(_publicKey!) : null;
  }
}
