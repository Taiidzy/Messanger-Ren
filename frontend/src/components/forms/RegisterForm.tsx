import React, { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/ui/icons";
import { useTheme, themes } from "@/components/theme/ThemeProvider";
import { useToast } from "@/components/ui/toast-context";
import { registerStep1, registerStep2 } from "@/components/api/Auth";
import {
  generateSalt,
  generateKeyPair, // Теперь может принимать аргумент extractablePrivateKey
  deriveKeyFromPassword,
  deriveKeyFromString,
  encryptData,
  validatePassword,
  exportPublicKeyToSpki, // Добавлены экспорты
  exportPrivateKeyToPkcs8, // Добавлены экспорты
  importPrivateKeyFromPkcs8, // Для импорта обратно как non-extractable CryptoKey
  importPublicKeyFromSpki, // Для импорта публичного ключа как CryptoKey
} from "@/components/utils/crypto";
import AccessKeyModal from "@/components/ui/access-key-modal";
import { useCrypto } from "@/components/context/CryptoContext"; // Импортируем useCrypto

const Register: React.FC = () => {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAccessKeyModal, setShowAccessKeyModal] = useState(false);
  const [accessKey, setAccessKey] = useState("");

  const navigate = useNavigate();
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const { showToast } = useToast();
  const { setKeys: setCryptoKeysInContext } = useCrypto(); // Переименовываем, чтобы не конфликтовать

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Валидация полей
      if (!username || !password || !confirmPassword) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Пожалуйста, заполните все поля",
          icon: "alertCircle",
        });
        return;
      }

      // Валидация пароля
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: passwordValidation.message || "Неверный формат пароля",
          icon: "alertCircle",
        });
        return;
      }

      if (password !== confirmPassword) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Пароли не совпадают",
          icon: "alertCircle",
        });
        return;
      }

      // --- Генерация криптографических ключей ---
      const salt = generateSalt();

      // Генерируем ключи, делая приватный ключ extractable: true для экспорта на сервер
      const keyPairExportable = await generateKeyPair(true);

      // Экспортируем публичный и приватный ключи в Base64 для сервера
      const exportedPublicKey = await exportPublicKeyToSpki(
        keyPairExportable.publicKey,
      );
      const exportedPrivateKey = await exportPrivateKeyToPkcs8(
        keyPairExportable.privateKey,
      );

      // Деривируем мастер-ключ из пароля для шифрования приватного ключа пользователя
      const masterKey = await deriveKeyFromPassword(password, salt);

      // Шифруем экспортированный приватный ключ мастер-ключом
      const encryptedPrivateKeyByUser = await encryptData(
        exportedPrivateKey,
        masterKey,
      );

      // --- Первый этап регистрации ---
      const step1Result = await registerStep1({
        login: username,
        userName: displayName || username,
        password: password, // Пароль может быть передан для хэширования на сервере, но не для прямого хранения
        publicKey: exportedPublicKey,
        encryptedPrivateKeyByUser,
        salt,
      });

      if (step1Result.status !== 201) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: step1Result.message || "Ошибка при регистрации",
          icon: "alertCircle",
        });
        return;
      }

      // --- Шифрование приватного ключа ключом доступа (для восстановления) ---
      // Используем экспортированный приватный ключ для этой цели
      const accessKeyDerivedKey = await deriveKeyFromString(
        step1Result.accessKey!,
      );
      const encryptedPrivateKeyByAccessKey = await encryptData(
        exportedPrivateKey,
        accessKeyDerivedKey,
      );

      // --- Второй этап регистрации ---
      const step2Result = await registerStep2({
        login: username,
        encryptedPrivateKeyByAccessKey,
      });

      if (step2Result.status !== 200) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description:
            step2Result.message || "Ошибка при завершении регистрации",
          icon: "alertCircle",
        });
        return;
      }

      // --- Локальное сохранение ключей (как CryptoKey с extractable: false) ---
      // Импортируем приватный ключ обратно как non-extractable CryptoKey
      const privateKeyForLocalStorage = await importPrivateKeyFromPkcs8(
        exportedPrivateKey,
        false,
      );
      // Импортируем публичный ключ как CryptoKey
      const publicKeyForLocalStorage = await importPublicKeyFromSpki(
        exportedPublicKey,
        true,
      );

      // Сохраняем эти CryptoKey объекты в IndexedDB через CryptoContext
      setCryptoKeysInContext(
        privateKeyForLocalStorage,
        publicKeyForLocalStorage,
      );

      // --- Показываем модальное окно с ключом доступа ---
      setAccessKey(step1Result.accessKey!);
      setShowAccessKeyModal(true);
    } catch (error) {
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description:
          "Произошла ошибка при регистрации. Пожалуйста, попробуйте снова.",
        icon: "alertCircle",
      });
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccessKeyModalClose = () => {
    setShowAccessKeyModal(false);
    showToast({
      variant: "success",
      title: "Успешно",
      description: "Аккаунт успешно создан! Теперь вы можете войти в систему.",
      icon: "checkCircle",
    });
    navigate("/");
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10 rounded-2xl bg-none overflow-hidden"
      >
        <motion.div
          className={`absolute inset-0 -z-10 ${currentTheme.background}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        ></motion.div>
        <Card className={`w-full max-w-md mx-auto ${currentTheme.card}`}>
          <CardHeader className="space-y-1">
            <CardTitle
              className={`text-2xl font-bold text-center ${currentTheme.text}`}
            >
              Добро пожаловать в Ren
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className={`${currentTheme.text}`}>
                  Имя пользователя
                </Label>
                <div className="relative">
                  <Icons.user className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Введите имя пользователя"
                    className="pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName" className={`${currentTheme.text}`}>
                  Отображаемое имя (необязательно)
                </Label>
                <div className="relative">
                  <Icons.user className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Введите отображаемое имя"
                    className="pl-9"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className={`${currentTheme.text}`}>
                  Пароль
                </Label>
                <div className="relative">
                  <Icons.lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Введите пароль"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Минимум 8 символов, включая заглавную и строчную буквы, цифру
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className={`${currentTheme.text}`}
                >
                  Подтвердите пароль
                </Label>
                <div className="relative">
                  <Icons.lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Подтвердите пароль"
                    className="pl-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Регистрация...
                  </>
                ) : (
                  "Зарегистрироваться"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <AccessKeyModal
        isOpen={showAccessKeyModal}
        accessKey={accessKey}
        onClose={handleAccessKeyModalClose}
      />
    </>
  );
};

export default Register;
