// src/components/api/Auth.tsx
import { AUTH_SERVICE_URL, PROFILES_SERVICE_URL } from "@/components/utils/const";

// Типы для регистрации
export type RegisterStep1RequestData = {
  login: string;
  userName?: string;
  password: string; // Пароль может быть передан для хеширования на сервере, но не для прямого хранения
  publicKey: string; // Base64 SPKI
  encryptedPrivateKeyByUser: string; // Base64 зашифрованный PKCS#8
  salt: string; // Base64 соль
};

export type RegisterStep1Response = {
  status: number;
  accessKey?: string;
  user_id?: number;
  login?: string;
  message?: string;
};

export type RegisterStep2RequestData = {
  login: string;
  encryptedPrivateKeyByAccessKey: string; // Base64 зашифрованный PKCS#8
};

export type RegisterStep2Response = {
  status: number;
  message?: string;
};

// Типы для входа
export type LoginRequestData = {
  login: string;
  password: string;
};

export type LoginResponse = {
  status: number;
  token?: string;
  message?: string;
  encryptedPrivateKeyByUser?: string; // Base64 зашифрованный PKCS#8
  salt?: string; // Base64 соль
  publicKey?: string; // Base64 SPKI
};

// Типы для восстановления
export type RecoveryRequestData = {
  login: string;
};

export type RecoveryResponse = {
  status?: number;
  encryptedPrivateKeyByAccessKey?: string; // Base64 зашифрованный PKCS#8
  message?: string;
};

// Типы для обновления пароля
export type UpdatePasswordAndKeysRequestData = {
  login: string;
  oldPassword: string;
  newPassword: string;
  newEncryptedPrivateKeyByUser: string; // Base64 зашифрованный PKCS#8
  newSalt: string; // Base64 соль
};

export type UpdatePasswordAndKeysResponse = {
  status: number;
  message?: string;
};

// Типы для текущего пользователя
export type UserData = {
  id: number;
  login: string;
  userName: string;
  avatar?: string;
  created_at: string;
};

// Функция для регистрации пользователя (Шаг 1)
export const registerStep1 = async (
  data: RegisterStep1RequestData,
): Promise<RegisterStep1Response> => {
  // В данном сценарии, RegisterForm.tsx уже генерирует и шифрует ключи,
  // и передает их в 'data'. Здесь мы просто отправляем их на сервер.

  const response = await fetch(`${AUTH_SERVICE_URL}/register/step1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data), // 'data' уже содержит сгенерированные и зашифрованные ключи
  });

  if (!response.ok) {
    const errorData = await response.json();
    const message = errorData.detail || "Ошибка при регистрации";
    return { status: response.status, message };
  }

  const result = await response.json();
  return {
    status: response.status,
    accessKey: result.accessKey,
    user_id: result.user_id,
    login: result.login,
    message: result.message || "Пользователь успешно зарегистрирован",
  };
};

// Функция для регистрации пользователя (Шаг 2)
export const registerStep2 = async (
  data: RegisterStep2RequestData,
): Promise<RegisterStep2Response> => {
  const response = await fetch(`${AUTH_SERVICE_URL}/register/step2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    const message = errorData.detail || "Ошибка при завершении регистрации";
    return { status: response.status, message };
  }

  const result = await response.json();
  return {
    status: response.status,
    message: result.message || "Регистрация успешно завершена",
  };
};

// Функция для входа пользователя
export const login = async (data: LoginRequestData): Promise<LoginResponse> => {
  const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    const message = errorData.detail || "Неверные учетные данные";
    return { status: response.status, message };
  }

  const result = await response.json();
  return {
    status: response.status,
    token: result.access_token,
    encryptedPrivateKeyByUser: result.encryptedPrivateKeyByUser,
    salt: result.salt,
    publicKey: result.publicKey,
    message: result.message || "Вход выполнен успешно",
  };
};

// Функция для получения зашифрованного приватного ключа по accessKey (для восстановления)
export const getEncryptedPrivateKeyByAccessKey = async (
  data: RecoveryRequestData,
): Promise<RecoveryResponse> => {
  const response = await fetch(
    `${AUTH_SERVICE_URL}/recovery/recover_account_by_access_key`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const errorData = await response.json();
    const message = errorData.detail || "Ошибка при восстановлении ключа";
    return { status: response.status, message };
  }

  const result = await response.json();
  return {
    status: response.status,
    encryptedPrivateKeyByAccessKey: result.encryptedPrivateKeyByAccessKey,
    message: result.message || "Ключ успешно получен",
  };
};

// Обновление пароля и ключей
export const updatePasswordAndKeys = async (
  data: UpdatePasswordAndKeysRequestData,
): Promise<UpdatePasswordAndKeysResponse> => {
  const response = await fetch(`${AUTH_SERVICE_URL}/recovery/update_password_and_keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    const message = errorData.detail || "Ошибка при обновлении пароля";
    return { status: response.status, message };
  }

  const result = await response.json();
  return {
    status: response.status,
    message: result.message || "Пароль успешно обновлен",
  };
};

// Получение данных текущего пользователя
export const getCurrentUser = async (): Promise<UserData> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Токен не найден");
  }

  const response = await fetch(`${PROFILES_SERVICE_URL}/profiles`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    const message = errorData.detail || "Ошибка получения данных пользователя";
    throw new Error(message);
  }

  const userData: UserData = await response.json();
  return userData;
};

export const getPublicKeyByLogin = async (token: string, login: number) => {
  if (!token) {
    return {
      status: 401,
      message: "Неавторизованный доступ: токен отсутствует.",
    };
  }

  const response = await fetch(`${AUTH_SERVICE_URL}/get_public_key`, {
    // Предполагаем такой эндпоинт на сервере
    method: "POST", // Или GET с query параметром, если сервер так настроен
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ login }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    const message = errorData.detail || "Ошибка при получении публичного ключа";
    return { status: response.status, message };
  }

  const result = await response.json();
  return {
    status: response.status,
    publicKey: result.public_key, // Предполагаем, что сервер возвращает 'public_key'
    message: result.message || "Публичный ключ успешно получен",
  };
};
