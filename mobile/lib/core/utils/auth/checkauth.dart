import 'package:Ren/core/storage/securestorage.dart';
import 'package:Ren/core/api/verify/verify.dart';

import 'package:Ren/core/utils/logger/logger.dart';

import 'package:Ren/core/utils/constants/keys.dart';

class CheckAuth {
  /// Checks if there is a valid user session.
  ///
  /// This function checks if the user has a valid session by checking if there is a valid private key and a valid token in the secure storage.
  ///
  /// Returns true if the user has a valid session, false otherwise.
  static Future<bool> checkAuth() async {
    logger.d('Checking if the user is authenticated');
    final privateKey = await SecureStorage.readKey(Keys.PrivateKey);
    final publicKey = await SecureStorage.readKey(Keys.PublicKey);
    final token = await SecureStorage.readKey(Keys.Token);
    bool isNullOrEmpty(String? value) => value == null || value.isEmpty;


    if (isNullOrEmpty(privateKey) || isNullOrEmpty(publicKey) || isNullOrEmpty(token)) {
      logger.d('The user is not authenticated');
      await SecureStorage.deleteAllKeys();
      return false;
    }

    logger.d('The user is authenticated');

    final isValidToken = await Verify.verifyToken(token);
    if (!isValidToken) {
      logger.d('Token is not valid, clearing secure storage');
      logger.d(
        'Token: $token, isValidToken: $isValidToken, privateKey: $privateKey, publicKey: $publicKey',
      );
      await SecureStorage.deleteAllKeys();
      return false;
    }

    return true;
  }
}
