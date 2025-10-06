import 'package:http/http.dart' as http;

import 'package:Ren/core/utils/constants/apiurl.dart';

import 'package:Ren/core/utils/logger/logger.dart';

class Verify {
  /// Checks the validity of the token.
  ///
  /// Makes a GET request to '/auth/verify' with the given token in the Authorization header.
  ///
  /// Returns true if the token is valid, false if the token is not valid or if there is a server error.
  ///
  static Future<bool> verifyToken(token) async {
    logger.d("Verifying token validity");
    try {
      final response = await http.get(
        Uri.parse('${Apiurl.AUTH_SERVICE}/auth/verify'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      switch (response.statusCode) {
        case 200:
          logger.d("Token is valid");
          return true;
        case 401:
          logger.d("Token is invalid");
          return false;
        case 500:
          logger.e("Server error during verification");
          return false;
        default:
          logger.w("Unexpected response: ${response.statusCode}");
          return false;
      }
    } catch (e) {
      logger.e("Token verification error: ${e}");
      return false;
    }
  }
}
