import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static final storage = FlutterSecureStorage();

  /// Reads a key from the secure storage.
  ///
  /// If the key is not found, this function returns null.
  ///
  /// Throws a [PlatformException] if the platform does not support secure storage
  /// or if there is an IO error.
  static Future<String?> readKey(String key) async {
    return await storage.read(key: key);
  }

  /// Writes a key-value pair to the secure storage.
  ///
  /// Throws a [PlatformException] if the platform does not support secure storage
  /// or if there is an IO error.
  static Future<void> writeKey(String key, String value) async {
    await storage.write(key: key, value: value);
  }

  /// Deletes a key from the secure storage.
  ///
  /// Throws a [PlatformException] if the platform does not support secure storage
  /// or if there is an IO error.
  static Future<void> deleteKey(String key) async {
    await storage.delete(key: key);
  }

  /// Deletes all keys from the secure storage.
  ///
  /// Throws a [PlatformException] if the platform does not support secure storage
  /// or if there is an IO error.
  static Future<void> deleteAllKeys() async {
    await storage.deleteAll();
  }

  /// Retrieves all keys from the secure storage.
  ///
  /// Throws a [PlatformException] if the platform does not support secure storage
  /// or if there is an IO error.
  static Future<Map<String, String>> getAllKeys() async {
    return await storage.readAll();
  }

  /// Checks if a key exists in the secure storage.
  ///
  /// Throws a [PlatformException] if the platform does not support secure storage
  /// or if there is an IO error.
  static Future<bool> keyExists(String key) async {
    return await storage.read(key: key) != null;
  }
}
