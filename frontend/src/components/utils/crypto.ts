// Интерфейс для результата шифрования сообщения
export interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
}

// Интерфейс для результата шифрования файла
export interface EncryptedFile {
  ciphertext: string;
  nonce: string;
  filename: string;
  mimetype: string;
}

// Интерфейс для результата шифрования файла с сообщением
export interface EncryptedFileWithMessage {
  encFile: string; // зашифрованный файл в Base64
  ciphertext: string; // зашифрованное сообщение в Base64
  nonce: string;
  filename: string;
  mimetype: string;
}

// Интерфейс для результата расшифровки файла с сообщением
export interface DecryptedFileWithMessage {
  file: File;
  message: string;
}

// Вспомогательные функции для работы с Base64
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Генерация криптографически стойкой соли
export const generateSalt = (): string => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt);
};

/**
 * Генерирует пару ключей ECDH (P-256).
 * privateKey по умолчанию non-extractable для безопасного локального хранения.
 * publicKey всегда extractable.
 */
export const generateKeyPair = async (
  extractablePrivateKey: boolean = false,
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    extractablePrivateKey, // true, если нужно экспортировать (например, для шифрования и отправки на сервер при регистрации)
    ["deriveKey", "deriveBits"],
  );
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
};

// Экспорт публичного ключа в формат SPKI (для передачи)
export const exportPublicKeyToSpki = async (
  publicKey: CryptoKey,
): Promise<string> => {
  const publicKeyBuffer = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(publicKeyBuffer);
};

// Экспорт приватного ключа в формат PKCS#8 (только если ключ extractable!)
export const exportPrivateKeyToPkcs8 = async (
  privateKey: CryptoKey,
): Promise<string> => {
  const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", privateKey);
  return arrayBufferToBase64(privateKeyBuffer);
};

// Импорт публичного ключа из формата SPKI
export const importPublicKeyFromSpki = async (
  spkiBase64: string,
  extractable: boolean = true, // Публичные ключи обычно экспортируемые
  keyUsages: KeyUsage[] = [],
): Promise<CryptoKey> => {
  const spkiBuffer = base64ToArrayBuffer(spkiBase64);
  return await crypto.subtle.importKey(
    "spki",
    spkiBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    extractable,
    keyUsages,
  );
};

// Импорт приватного ключа из формата PKCS#8
export const importPrivateKeyFromPkcs8 = async (
  pkcs8Base64: string,
  extractable: boolean = false, // При импорте для локального хранения лучше делать non-extractable
  keyUsages: KeyUsage[] = ["deriveKey", "deriveBits"],
): Promise<CryptoKey> => {
  const pkcs8Buffer = base64ToArrayBuffer(pkcs8Base64);
  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Buffer,
    { name: "ECDH", namedCurve: "P-256" },
    extractable,
    keyUsages,
  );
};

// Деривация ключа из пароля с помощью PBKDF2
export const deriveKeyFromPassword = async (
  password: string,
  salt: string,
): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);
  const saltBuffer = base64ToArrayBuffer(salt);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  const masterKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return masterKey;
};

// Деривация ключа из строкового секрета (для AccessKey)
export const deriveKeyFromString = async (
  secret: string,
): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const secretBuffer = encoder.encode(secret);

  // Хэшируем строку с помощью SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", secretBuffer);

  // Используем первые 32 байта хэша как ключ
  const keyBuffer = hashBuffer.slice(0, 32);

  return await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
};

// Шифрование данных с помощью AES-GCM
export const encryptData = async (
  data: string,
  key: CryptoKey,
): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV: 12 байт для AES-GCM
  const enc = new TextEncoder();
  const encodedData = enc.encode(data);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encodedData,
  );

  const result = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encryptedBuffer), iv.length);

  return arrayBufferToBase64(result);
};

// Дешифрование данных с помощью AES-GCM
export const decryptData = async (
  encryptedDataBase64: string,
  key: CryptoKey,
): Promise<string> => {
  const encryptedBuffer = base64ToArrayBuffer(encryptedDataBase64);
  const encryptedArray = new Uint8Array(encryptedBuffer);

  // Извлекаем IV (первые 12 байт)
  const iv = encryptedArray.slice(0, 12);
  const data = encryptedArray.slice(12);

  // Дешифруем данные
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
};

// Валидация пароля
export const validatePassword = (
  password: string,
): { isValid: boolean; message?: string } => {
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Пароль должен содержать минимум 8 символов",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "Пароль должен содержать хотя бы одну заглавную букву",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "Пароль должен содержать хотя бы одну строчную букву",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: "Пароль должен содержать хотя бы одну цифру",
    };
  }

  return { isValid: true };
};

// Генерирует новый эфемерный симметричный ключ AES-GCM для шифрования одного сообщения.
export const generateMessageEncryptionKey = async (): Promise<CryptoKey> => {
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable: true, потому что этот ключ нужно будет "обернуть" и передать
    ["encrypt", "decrypt"],
  );
};

// Обертывает (шифрует) симметричный ключ AES-GCM с использованием публичного ключа ECDH получателя.
// Генерирует эфемерную пару ECDH для этой операции, обеспечивая PFS для обмена ключами.
export const wrapSymmetricKey = async (
  keyToWrap: CryptoKey,
  receiverPublicKey: CryptoKey,
): Promise<{ wrappedKey: string; ephemeralPublicKey: string; iv: string }> => {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // Генерируем IV для обертки
  // Генерируем эфемерную пару ECDH для этой операции
  // Приватный ключ эфемерной пары - для деривации секрета с публичным ключом получателя
  // Публичный ключ эфемерной пары - для отправки получателю, чтобы он мог деривировать тот же секрет
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // Публичный ключ должен быть extractable, чтобы его можно было отправить получателю
    ["deriveKey", "deriveBits"],
  );

  // Деривируем общий секрет из эфемерного приватного ключа и публичного ключа получателя
  const derivedSharedSecret = await crypto.subtle.deriveKey(
    { name: "ECDH", public: receiverPublicKey },
    ephemeralKeyPair.privateKey,
    { name: "AES-GCM", length: 256 }, // Алгоритм для обертывания ключа
    false, // false, так как этот ключ используется только для обертывания/развертывания
    ["wrapKey", "unwrapKey"],
  );

  // Обертываем (шифруем) симметричный ключ с использованием этого производного секрета
  const wrappedKeyBuffer = await crypto.subtle.wrapKey(
    "raw", // Формат ключа для обертывания (raw - ArrayBuffer)
    keyToWrap,
    derivedSharedSecret,
    { name: "AES-GCM", iv: iv }, // IV для AES-GCM обертки
  );

  // Экспортируем эфемерный публичный ключ для отправки получателю
  const exportedEphemeralPublicKey = await exportPublicKeyToSpki(
    ephemeralKeyPair.publicKey,
  );

  return {
    wrappedKey: arrayBufferToBase64(wrappedKeyBuffer),
    ephemeralPublicKey: exportedEphemeralPublicKey,
    iv: arrayBufferToBase64(iv), // Возвращаем IV в Base64
  };
};

// Развертывает (дешифрует) симметричный ключ AES-GCM с использованием собственного приватного ключа ECDH.
export const unwrapSymmetricKey = async (
  wrappedKeyBase64: string,
  ephemeralPublicKeyBase64: string,
  ivBase64: string, // Получаем IV для развертывания
  receiverPrivateKey: CryptoKey,
): Promise<CryptoKey> => {
  const wrappedKeyBuffer = base64ToArrayBuffer(wrappedKeyBase64);
  const iv = base64ToArrayBuffer(ivBase64); // Используем полученный IV

  // Импортируем эфемерный публичный ключ отправителя
  const ephemeralPublicKey = await importPublicKeyFromSpki(
    ephemeralPublicKeyBase64,
  );

  // Деривируем тот же общий секрет, что и отправитель, используя свой приватный ключ
  const derivedSharedSecret = await crypto.subtle.deriveKey(
    { name: "ECDH", public: ephemeralPublicKey },
    receiverPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );

  // Развертываем (дешифруем) симметричный ключ
  const unwrappedKey = await crypto.subtle.unwrapKey(
    "raw", // Формат ожидаемого ключа
    wrappedKeyBuffer,
    derivedSharedSecret,
    { name: "AES-GCM", iv: iv }, // Используем полученный IV
    { name: "AES-GCM", length: 256 }, // Алгоритм дешифрованного ключа
    false, // extractable: false, если ключ для использования в памяти
    ["encrypt", "decrypt"], // Использование дешифрованного ключа
  );

  return unwrappedKey;
};

// Шифрование сообщений с помощью AES-GCM
export const encryptMessage = async (
  data: string,
  key: CryptoKey,
): Promise<EncryptedMessage> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encodedData = enc.encode(data);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encodedData,
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    nonce: arrayBufferToBase64(iv),
  };
};

// Шифрование файла с помощью AES-GCM
export const encryptFile = async (
  file: File,
  key: CryptoKey,
): Promise<EncryptedFile> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    fileBuffer,
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    nonce: arrayBufferToBase64(iv),
    filename: file.name,
    mimetype: file.type,
  };
};

// Шифрование файла с сообщением с помощью AES-GCM
export const encryptFileWithMessage = async (
  file: File,
  message: string,
  key: CryptoKey,
): Promise<EncryptedFileWithMessage> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Шифруем файл отдельно
  const fileBuffer = await file.arrayBuffer();
  const encryptedFileBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    fileBuffer,
  );

  // Шифруем сообщение отдельно
  const enc = new TextEncoder();
  const encodedMessage = enc.encode(message);
  const encryptedMessageBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encodedMessage,
  );

  return {
    encFile: arrayBufferToBase64(encryptedFileBuffer),
    ciphertext: arrayBufferToBase64(encryptedMessageBuffer),
    nonce: arrayBufferToBase64(iv),
    filename: file.name,
    mimetype: file.type,
  };
};

// Расшифровка сообщений
export const decryptMessage = async (
  ciphertextBase64: string,
  nonceBase64: string,
  key: CryptoKey,
): Promise<string> => {
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);
  const iv = base64ToArrayBuffer(nonceBase64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertextBuffer,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
};

// Расшифровка файла с помощью AES-GCM
export const decryptFile = async (
  ciphertextBase64: string,
  nonceBase64: string,
  key: CryptoKey,
  filename: string,
  mimetype: string,
): Promise<File> => {
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);
  const iv = base64ToArrayBuffer(nonceBase64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertextBuffer,
  );

  return new File([decryptedBuffer], filename, { type: mimetype });
};

// Расшифровка файла с сообщением с помощью AES-GCM
export const decryptFileWithMessage = async (
  encFileBase64: string,
  ciphertextBase64: string,
  nonceBase64: string,
  key: CryptoKey,
  filename: string,
  mimetype: string,
): Promise<DecryptedFileWithMessage> => {
  const iv = base64ToArrayBuffer(nonceBase64);

  // Расшифровываем файл
  const encryptedFileBuffer = base64ToArrayBuffer(encFileBase64);
  const decryptedFileBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encryptedFileBuffer,
  );

  // Расшифровываем сообщение
  const encryptedMessageBuffer = base64ToArrayBuffer(ciphertextBase64);
  const decryptedMessageBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encryptedMessageBuffer,
  );

  const decoder = new TextDecoder();
  const message = decoder.decode(decryptedMessageBuffer);
  const file = new File([decryptedFileBuffer], filename, { type: mimetype });

  return {
    file,
    message,
  };
};

export const generateNonce = async (): Promise<string> =>
  arrayBufferToBase64(crypto.getRandomValues(new Uint8Array(12)));
