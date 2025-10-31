import 'dart:convert';
import 'dart:typed_data';
import 'dart:math';
import 'package:pointycastle/export.dart';

// Интерфейсы для результатов шифрования
class EncryptedMessage {
  final String ciphertext;
  final String nonce;

  EncryptedMessage({required this.ciphertext, required this.nonce});

  Map<String, dynamic> toJson() => {'ciphertext': ciphertext, 'nonce': nonce};

  factory EncryptedMessage.fromJson(Map<String, dynamic> json) =>
      EncryptedMessage(ciphertext: json['ciphertext'], nonce: json['nonce']);
}

class EncryptedFile {
  final String ciphertext;
  final String nonce;
  final String filename;
  final String mimetype;

  EncryptedFile({
    required this.ciphertext,
    required this.nonce,
    required this.filename,
    required this.mimetype,
  });

  Map<String, dynamic> toJson() => {
    'ciphertext': ciphertext,
    'nonce': nonce,
    'filename': filename,
    'mimetype': mimetype,
  };

  factory EncryptedFile.fromJson(Map<String, dynamic> json) => EncryptedFile(
    ciphertext: json['ciphertext'],
    nonce: json['nonce'],
    filename: json['filename'],
    mimetype: json['mimetype'],
  );
}

class EncryptedFileWithMessage {
  final EncryptedFile encFile;
  final String ciphertext;
  final String nonce;
  final String filename;
  final String mimetype;

  EncryptedFileWithMessage({
    required this.encFile,
    required this.ciphertext,
    required this.nonce,
    required this.filename,
    required this.mimetype,
  });

  Map<String, dynamic> toJson() => {
    'encFile': encFile.toJson(),
    'ciphertext': ciphertext,
    'nonce': nonce,
    'filename': filename,
    'mimetype': mimetype,
  };

  factory EncryptedFileWithMessage.fromJson(Map<String, dynamic> json) =>
      EncryptedFileWithMessage(
        encFile: EncryptedFile.fromJson(json['encFile']),
        ciphertext: json['ciphertext'],
        nonce: json['nonce'],
        filename: json['filename'],
        mimetype: json['mimetype'],
      );
}

class DecryptedFileWithMessage {
  final Uint8List fileData;
  final String message;

  DecryptedFileWithMessage({required this.fileData, required this.message});
}

class KeyPair {
  final ECPrivateKey privateKey;
  final ECPublicKey publicKey;

  KeyPair({required this.privateKey, required this.publicKey});
}

class WrappedKeyResult {
  final String wrappedKey;
  final String ephemeralPublicKey;
  final String iv;

  WrappedKeyResult({
    required this.wrappedKey,
    required this.ephemeralPublicKey,
    required this.iv,
  });
}

class PasswordValidationResult {
  final bool isValid;
  final String? message;

  PasswordValidationResult({required this.isValid, this.message});
}

class Crypto {
  static final _secureRandom = SecureRandom('Fortuna')..seed(
    KeyParameter(
      Uint8List.fromList(
        List.generate(32, (i) => Random.secure().nextInt(256)),
      ),
    ),
  );

  // Вспомогательные функции для Base64
  static String uint8ListToBase64(Uint8List data) {
    return base64.encode(data);
  }

  static Uint8List base64ToUint8List(String base64String) {
    return base64.decode(base64String);
  }

  // Генерация соли
  static String generateSalt([int length = 16]) {
    final bytes = _generateRandomBytes(length);
    return uint8ListToBase64(bytes);
  }

  static Uint8List _generateRandomBytes(int length) {
    final b = Uint8List(length);
    for (int i = 0; i < length; i++) {
      b[i] = Random.secure().nextInt(256);
    }
    return b;
  }

  // Генерация пары ключей ECDH (P-256)
  static KeyPair generateKeyPair() {
    final keyGen = ECKeyGenerator();
    final params = ECKeyGeneratorParameters(ECCurve_secp256r1());
    keyGen.init(ParametersWithRandom(params, _secureRandom));

    final keyPair = keyGen.generateKeyPair();
    return KeyPair(
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    );
  }

  // Преобразование публичного ключа в строку для хранения/передачи (SPKI)
  static String publicKeyToString(ECPublicKey publicKey) {
    final x = publicKey.Q!.x!.toBigInteger();
    final y = publicKey.Q!.y!.toBigInteger();

    final xBytes = _bigIntToBytes(x!, 32);
    final yBytes = _bigIntToBytes(y!, 32);

    // Создаем SPKI структуру вручную для P-256
    final pointBytes = Uint8List(65);
    pointBytes[0] = 0x04; // Uncompressed point prefix
    pointBytes.setRange(1, 33, xBytes);
    pointBytes.setRange(33, 65, yBytes);

    // SPKI заголовок для P-256 (secp256r1)
    final spkiHeader = [
      0x30, 0x59, // SEQUENCE, length 89
      0x30, 0x13, // SEQUENCE, length 19
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID: ecPublicKey
      0x06,
      0x08,
      0x2a,
      0x86,
      0x48,
      0xce,
      0x3d,
      0x03,
      0x01,
      0x07, // prime256v1
      0x03,
      0x42,
      0x00, // BIT STRING length 66, unused bits=0
    ];

    final spkiBytes = Uint8List(spkiHeader.length + pointBytes.length);
    spkiBytes.setRange(0, spkiHeader.length, spkiHeader);
    spkiBytes.setRange(spkiHeader.length, spkiBytes.length, pointBytes);

    return uint8ListToBase64(spkiBytes);
  }

  // Преобразование приватного ключа в строку для хранения
  // Теперь экспортируем PKCS#8 DER (base64), совместимый с WebCrypto exportKey('pkcs8').
  static String privateKeyToString(ECPrivateKey privateKey) {
    // Экспортируем приватный ключ в PKCS#8 DER, чтобы соответствовать WebCrypto `exportKey('pkcs8')`.
    final d = privateKey.d!;
    final dBytes = _bigIntToBytes(d, 32);

    // Формируем ECPrivateKey ::= SEQUENCE { version INTEGER, privateKey OCTET STRING }
    final ecPrivSeq = <int>[];
    // version (INTEGER 1)
    ecPrivSeq.addAll([0x02, 0x01, 0x01]);
    // privateKey OCTET STRING (32 bytes)
    ecPrivSeq.addAll([0x04, 0x20]);
    ecPrivSeq.addAll(dBytes);

    // Обернём ECPrivateKey в SEQUENCE
    final ecPrivSeqBytes = _wrapAsSequence(Uint8List.fromList(ecPrivSeq));

    // AlgorithmIdentifier for ecPublicKey with namedCurve prime256v1 (OID 1.2.840.10045.3.1.7)
    final algId = <int>[
      0x30, 0x13,
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // ecPublicKey OID
      0x06,
      0x08,
      0x2a,
      0x86,
      0x48,
      0xce,
      0x3d,
      0x03,
      0x01,
      0x07, // prime256v1 OID
    ];

    // privateKey OCTET STRING wrapping ECPrivateKey
    final privKeyOctetString =
        <int>[0x04] + _encodeLength(ecPrivSeqBytes.length) + ecPrivSeqBytes;

    // PrivateKeyInfo ::= SEQUENCE { version INTEGER(0), algorithm AlgorithmIdentifier, privateKey OCTET STRING }
    final pkiBody = <int>[];
    // version 0
    pkiBody.addAll([0x02, 0x01, 0x00]);
    // algorithm
    pkiBody.addAll(algId);
    // privateKey
    pkiBody.addAll(privKeyOctetString);

    final pkiSeq = _wrapAsSequence(Uint8List.fromList(pkiBody));

    return uint8ListToBase64(Uint8List.fromList(pkiSeq));
  }

  // Восстановление публичного ключа из строки (поддерживает raw (65 bytes), SPKI/DER и PEM)
  static ECPublicKey publicKeyFromString(String publicKeyString) {
    // Удаляем PEM-заголовки при необходимости
    if (publicKeyString.contains('-----BEGIN')) {
      final lines =
          publicKeyString
              .split(RegExp(r'\r?\n'))
              .where((l) => !l.startsWith('-----'))
              .join();
      publicKeyString = lines;
    }

    final keyBytes = base64ToUint8List(publicKeyString);

    // Случай: raw uncompressed point (65 bytes)
    if (keyBytes.length == 65 && keyBytes[0] == 0x04) {
      final x = _bytesToBigInt(Uint8List.fromList(keyBytes.sublist(1, 33)));
      final y = _bytesToBigInt(Uint8List.fromList(keyBytes.sublist(33, 65)));
      final curve = ECCurve_secp256r1();
      final point = curve.curve.createPoint(x, y);
      return ECPublicKey(point, curve);
    }

    // Ищем BIT STRING (0x03) содержащий uncompressed point
    for (int i = 0; i < keyBytes.length - 2; i++) {
      if (keyBytes[i] == 0x03) {
        try {
          final lenInfo = _readAsn1Length(keyBytes, i + 1);
          final lenVal = lenInfo[0];
          final lenBytes = lenInfo[1];
          final contentStart = i + 1 + lenBytes;
          final contentEnd = contentStart + lenVal;
          if (contentEnd > keyBytes.length) continue;

          if (lenVal < 1) continue;
          // Первый байт в содержимом BIT STRING — number of unused bits (обычно 0)
          final pointStart = contentStart + 1;
          if (pointStart < keyBytes.length && keyBytes[pointStart] == 0x04) {
            // Проверяем длину точки: ожидаем >=65 (1 + 32 + 32)
            if (pointStart + 65 <= keyBytes.length) {
              final pointBytes = keyBytes.sublist(pointStart, pointStart + 65);
              final x = _bytesToBigInt(
                Uint8List.fromList(pointBytes.sublist(1, 33)),
              );
              final y = _bytesToBigInt(
                Uint8List.fromList(pointBytes.sublist(33, 65)),
              );
              final curve = ECCurve_secp256r1();
              final point = curve.curve.createPoint(x, y);
              return ECPublicKey(point, curve);
            }
          }
        } on FormatException {
          continue;
        }
      }
    }

    // Также пробуем искать raw point внутри произвольной DER структуры (иногда публикуют point ближе к концу)
    for (int i = 0; i < keyBytes.length - 65; i++) {
      if (keyBytes[i] == 0x04 && i + 65 <= keyBytes.length) {
        final maybePoint = keyBytes.sublist(i, i + 65);
        // Простая проверка, что это валидная точка (первый байт 0x04)
        if (maybePoint[0] == 0x04) {
          final x = _bytesToBigInt(
            Uint8List.fromList(maybePoint.sublist(1, 33)),
          );
          final y = _bytesToBigInt(
            Uint8List.fromList(maybePoint.sublist(33, 65)),
          );
          final curve = ECCurve_secp256r1();
          final point = curve.curve.createPoint(x, y);
          return ECPublicKey(point, curve);
        }
      }
    }

    throw FormatException(
      'Unsupported public key format or failed to parse publicKey (length=${keyBytes.length})',
    );
  }

  // Восстановление приватного ключа из строки
  static ECPrivateKey privateKeyFromString(String privateKeyString) {
    if (privateKeyString.contains('-----BEGIN')) {
      final lines =
          privateKeyString
              .split(RegExp(r'\r?\n'))
              .where((l) => !l.startsWith('-----'))
              .join();
      privateKeyString = lines;
    }

    final keyBytes = base64ToUint8List(privateKeyString);

    // Если raw scalar 32 байта
    if (keyBytes.length == 32) {
      final d = _bytesToBigInt(Uint8List.fromList(keyBytes));
      final curve = ECCurve_secp256r1();
      return ECPrivateKey(d, curve);
    }

    // Попробуем найти OCTET STRING длиной 32 байта (часто приватный скаляр находится внутри PKCS#8/SEC1)
    final extracted = _tryExtractOctetString(keyBytes, 32);
    if (extracted != null) {
      final d = _bytesToBigInt(Uint8List.fromList(extracted));
      final curve = ECCurve_secp256r1();
      return ECPrivateKey(d, curve);
    }

    // Иногда PKCS#8 содержит структуру, где приватный ключ вложен глубже; попробуем также искать INTEGER (02) с длиной <=32
    for (int i = 0; i < keyBytes.length - 2; i++) {
      if (keyBytes[i] == 0x02) {
        try {
          final lenInfo = _readAsn1Length(keyBytes, i + 1);
          final lenVal = lenInfo[0];
          final lenBytes = lenInfo[1];
          final contentStart = i + 1 + lenBytes;
          final contentEnd = contentStart + lenVal;
          if (contentEnd > keyBytes.length) continue;
          // Преобразуем INTEGER (big-endian) в BigInt и проверим, что не нулевой
          final candidate = keyBytes.sublist(contentStart, contentEnd);
          if (candidate.length <= 33) {
            // приводим к 32 байтам (выровнять справа)
            final bytes32 = Uint8List(32);
            final start = 32 - candidate.length;
            bytes32.setRange(start, 32, candidate);
            final d = _bytesToBigInt(bytes32);
            final curve = ECCurve_secp256r1();
            return ECPrivateKey(d, curve);
          }
        } on FormatException {
          continue;
        }
      }
    }

    throw FormatException(
      'Unsupported private key format or failed to parse privateKey (length=${keyBytes.length})',
    );
  }

  // Деривация ключа из пароля с помощью PBKDF2
  static Uint8List deriveKeyFromPassword(String password, String salt) {
    final saltBytes = base64ToUint8List(salt);
    final passwordBytes = utf8.encode(password);

    final pbkdf2 = PBKDF2KeyDerivator(HMac(SHA256Digest(), 64));
    pbkdf2.init(Pbkdf2Parameters(saltBytes, 100000, 32));

    return pbkdf2.process(passwordBytes);
  }

  // Деривация ключа из строкового секрета
  static Uint8List deriveKeyFromString(String secret) {
    final secretBytes = utf8.encode(secret);
    final digest = SHA256Digest();
    final hash = digest.process(Uint8List.fromList(secretBytes));
    return hash;
  }

  // Шифрование данных с помощью AES-GCM
  static EncryptedMessage encryptData(String data, Uint8List key) {
    final iv = _generateRandomBytes(12);
    final dataBytes = utf8.encode(data);

    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(KeyParameter(key), 128, iv, Uint8List(0));
    cipher.init(true, params);

    final ciphertext = cipher.process(dataBytes);

    return EncryptedMessage(
      ciphertext: uint8ListToBase64(Uint8List.fromList(ciphertext)),
      nonce: uint8ListToBase64(iv),
    );
  }

  static String decryptData(
    String ciphertextBase64,
    Uint8List key,
    String ivBase64,
  ) {
    final ciphertext = base64ToUint8List(ciphertextBase64);
    final iv = base64ToUint8List(ivBase64);

    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(KeyParameter(key), 128, iv, Uint8List(0));
    cipher.init(false, params);

    final output = cipher.process(ciphertext);
    return utf8.decode(output);
  }

  static PasswordValidationResult validatePassword(String password) {
    if (password.length < 8) {
      return PasswordValidationResult(
        isValid: false,
        message: 'Пароль должен быть не короче 8 символов',
      );
    }
    if (!RegExp(r'[A-Z]').hasMatch(password)) {
      return PasswordValidationResult(
        isValid: false,
        message: 'Пароль должен содержать хотя бы одну заглавную букву',
      );
    }
    if (!RegExp(r'[0-9]').hasMatch(password)) {
      return PasswordValidationResult(
        isValid: false,
        message: 'Пароль должен содержать хотя бы одну цифру',
      );
    }
    return PasswordValidationResult(isValid: true);
  }

  // Генерирует новый эфемерный симметричный ключ AES-GCM для шифрования одного сообщения.
  static Uint8List generateMessageEncryptionKey() {
    return _generateRandomBytes(32);
  }

  // Обертывает (wrap) симметричный ключ AES-GCM с помощью ECDH(эпhemeral) + AES-GCM
  static WrappedKeyResult wrapSymmetricKey(
    Uint8List keyToWrap,
    ECPublicKey receiverPublicKey,
  ) {
    final iv = _generateRandomBytes(12);

    // Генерируем эфемерную пару ECDH
    final ephemeralKeyPair = generateKeyPair();

    // Деривируем общий секрет
    final sharedSecret = _deriveSharedSecret(
      ephemeralKeyPair.privateKey,
      receiverPublicKey,
    );

    // Обертываем ключ с помощью AES-GCM (sharedSecret используется напрямую как KEK)
    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(
      KeyParameter(sharedSecret),
      128,
      iv,
      Uint8List(0),
    );
    cipher.init(true, params);

    final wrappedKey = cipher.process(keyToWrap);

    return WrappedKeyResult(
      wrappedKey: uint8ListToBase64(Uint8List.fromList(wrappedKey)),
      ephemeralPublicKey: publicKeyToString(ephemeralKeyPair.publicKey),
      iv: uint8ListToBase64(iv),
    );
  }

  // Развертывает симметричный ключ с использованием собственного приватного ключа ECDH
  static Uint8List unwrapSymmetricKey(
    String wrappedKeyBase64,
    String ephemeralPublicKeyBase64,
    String ivBase64,
    ECPrivateKey receiverPrivateKey,
  ) {
    final wrappedKey = base64ToUint8List(wrappedKeyBase64);
    final iv = base64ToUint8List(ivBase64);
    final ephemeralPublicKey = publicKeyFromString(ephemeralPublicKeyBase64);

    // Получаем BigInt sharedSecret
    final agreement = ECDHBasicAgreement();
    agreement.init(receiverPrivateKey);
    final sharedSecretBigInt = agreement.calculateAgreement(ephemeralPublicKey);
    final sharedSecretRaw = _bigIntToBytes(
      sharedSecretBigInt,
      32,
    ); // raw 32 bytes

    // По спецификации WebCrypto deriveKey(ECDH -> AES-GCM) использует сырые биты в качестве KEK,
    // поэтому пробуем расшифровать, используя sharedSecretRaw.
    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(
      KeyParameter(sharedSecretRaw),
      128,
      iv,
      Uint8List(0),
    );
    cipher.init(false, params);
    final result = cipher.process(wrappedKey);
    return result;
  }

  // Шифрование сообщения
  static EncryptedMessage encryptMessage(String data, Uint8List key) {
    final iv = _generateRandomBytes(12);
    final dataBytes = utf8.encode(data);

    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(KeyParameter(key), 128, iv, Uint8List(0));
    cipher.init(true, params);

    final ciphertext = cipher.process(dataBytes);

    return EncryptedMessage(
      ciphertext: uint8ListToBase64(Uint8List.fromList(ciphertext)),
      nonce: uint8ListToBase64(iv),
    );
  }

  // Шифрование файла
  static EncryptedFile encryptFile(
    Uint8List fileData,
    String filename,
    String mimetype,
    Uint8List key,
  ) {
    final iv = _generateRandomBytes(12);

    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(KeyParameter(key), 128, iv, Uint8List(0));
    cipher.init(true, params);

    final ciphertext = cipher.process(fileData);

    return EncryptedFile(
      ciphertext: uint8ListToBase64(Uint8List.fromList(ciphertext)),
      nonce: uint8ListToBase64(iv),
      filename: filename,
      mimetype: mimetype,
    );
  }

  static DecryptedFileWithMessage decryptFileWithMessage(
    String ciphertextBase64,
    String nonceBase64,
    Uint8List key,
  ) {
    final ciphertext = base64ToUint8List(ciphertextBase64);
    final iv = base64ToUint8List(nonceBase64);

    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(KeyParameter(key), 128, iv, Uint8List(0));
    cipher.init(false, params);

    final decrypted = cipher.process(ciphertext);
    // В этом месте ожидается, что формат объединения сообщения+файла извне совпадает с тем, как вы упаковываете.
    throw UnimplementedError(
      'decryptFileWithMessage: адаптируйте под формат упаковки данных',
    );
  }

  // Генерация nonce
  static String generateNonce() => uint8ListToBase64(_generateRandomBytes(12));

  // Возвращаем сырые 32 байта общего секрета (big-endian) — совместимо с WebCrypto deriveKey(ECDH->AES).
  static Uint8List _deriveSharedSecret(
    ECPrivateKey privateKey,
    ECPublicKey publicKey,
  ) {
    final agreement = ECDHBasicAgreement();
    agreement.init(privateKey);
    final sharedSecret = agreement.calculateAgreement(publicKey);

    // Возвращаем сырые 32 байта общего секрета (big-endian), чтобы быть совместимыми с WebCrypto.
    final sharedSecretBytes = _bigIntToBytes(sharedSecret, 32);
    return sharedSecretBytes;
  }

  // Вспомогательная функция: оборачивает произвольный контент в ASN.1 SEQUENCE (простой вариант, работает для небольших размеров)
  static List<int> _wrapAsSequence(Uint8List content) {
    final len = content.length;
    final header = <int>[0x30] + _encodeLength(len);
    return header + content;
  }

  // Вспомогательная функция для кодирования длины ASN.1 (короткая/длинная форма)
  static List<int> _encodeLength(int len) {
    if (len < 128) {
      return [len];
    }
    // long form
    final bytes = <int>[];
    var tmp = len;
    while (tmp > 0) {
      bytes.insert(0, tmp & 0xff);
      tmp = tmp >> 8;
    }
    return [0x80 | bytes.length] + bytes;
  }

  // Вспомогательные функции для работы с BigInt
  static Uint8List _bigIntToBytes(BigInt bigInt, int length) {
    final bytes = Uint8List(length);
    var temp = bigInt;
    for (int i = length - 1; i >= 0; i--) {
      bytes[i] = (temp & BigInt.from(0xff)).toInt();
      temp = temp >> 8;
    }
    return bytes;
  }

  static BigInt _bytesToBigInt(Uint8List bytes) {
    var result = BigInt.zero;
    for (int i = 0; i < bytes.length; i++) {
      result = (result << 8) + BigInt.from(bytes[i]);
    }
    return result;
  }

  static List<int> _readAsn1Length(Uint8List bytes, int offset) {
    if (offset >= bytes.length) {
      throw FormatException('Offset out of range when reading ASN.1 length');
    }
    final first = bytes[offset];
    if (first < 0x80) {
      return [first, 1];
    } else {
      final numBytes = first & 0x7F;
      if (numBytes == 0 || numBytes > 4) {
        throw FormatException('Unsupported ASN.1 length octets: $numBytes');
      }
      if (offset + 1 + numBytes > bytes.length) {
        throw FormatException('ASN.1 length extends past buffer');
      }
      int len = 0;
      for (int i = 0; i < numBytes; i++) {
        len = (len << 8) | bytes[offset + 1 + i];
      }
      return [len, 1 + numBytes];
    }
  }

  /// Пытается найти OCTET STRING заданной длины внутри байтовой последовательности.
  /// Возвращает sublist содержащий содержимое OCTET STRING или null, если не найдено.
  static Uint8List? _tryExtractOctetString(Uint8List bytes, int expectedLen) {
    for (int i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] == 0x04) {
        // tag OCTET STRING
        try {
          final lenInfo = _readAsn1Length(bytes, i + 1);
          final lenVal = lenInfo[0];
          final lenBytes = lenInfo[1];
          final contentStart = i + 1 + lenBytes;
          final contentEnd = contentStart + lenVal;
          if (contentEnd <= bytes.length) {
            if (lenVal == expectedLen) {
              return bytes.sublist(contentStart, contentEnd);
            }
          } else {
            // некорректная длина — пропускаем
            continue;
          }
        } on FormatException {
          continue;
        }
      }
    }
    return null;
  }
}
