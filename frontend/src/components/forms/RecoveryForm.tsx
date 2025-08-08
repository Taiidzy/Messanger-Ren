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
import {
  getEncryptedPrivateKeyByAccessKey,
  updatePasswordAndKeys,
} from "@/components/api/Auth";
import {
  generateSalt,
  deriveKeyFromString,
  deriveKeyFromPassword,
  encryptData,
  decryptData,
  validatePassword,
} from "@/components/utils/crypto";

const RecoveryForm: React.FC = () => {
  const [stage, setStage] = useState<"login" | "password">("login");
  const [username, setUsername] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recoveredPrivateKey, setRecoveredPrivateKey] = useState<string | null>(
    null,
  );

  const navigate = useNavigate();
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const { showToast } = useToast();

  const handleStage1Submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!username || !accessKey) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Пожалуйста, заполните все поля",
          icon: "alertCircle",
        });
        return;
      }

      // Получаем зашифрованный приватный ключ
      const result = await getEncryptedPrivateKeyByAccessKey({
        login: username,
      });

      if (result.status !== 200 || !result.encryptedPrivateKeyByAccessKey) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description:
            result.message ||
            "Пользователь не найден или неверный ключ доступа",
          icon: "alertCircle",
        });
        return;
      }

      try {
        // Деривируем ключ из AccessKey
        const accessKeyDerivedKey = await deriveKeyFromString(accessKey);

        // Дешифруем приватный ключ
        const privateKey = await decryptData(
          result.encryptedPrivateKeyByAccessKey,
          accessKeyDerivedKey,
        );

        // Временно сохраняем приватный ключ
        setRecoveredPrivateKey(privateKey);

        // Переходим ко второму этапу
        setStage("password");

        showToast({
          variant: "success",
          title: "Успешно",
          description:
            "Ключ доступа подтвержден. Теперь установите новый пароль.",
          icon: "checkCircle",
        });
      } catch (decryptError) {
        console.error("Ошибка дешифровки:", decryptError);
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Неверный ключ доступа",
          icon: "alertCircle",
        });
      }
    } catch (error) {
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description:
          "Произошла ошибка при восстановлении. Пожалуйста, попробуйте снова.",
        icon: "alertCircle",
      });
      console.error("Recovery error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStage2Submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!newPassword || !confirmPassword) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Пожалуйста, заполните все поля",
          icon: "alertCircle",
        });
        return;
      }

      // Валидация пароля
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: passwordValidation.message || "Неверный формат пароля",
          icon: "alertCircle",
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Пароли не совпадают",
          icon: "alertCircle",
        });
        return;
      }

      if (!recoveredPrivateKey) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description:
            "Приватный ключ не найден. Начните восстановление заново.",
          icon: "alertCircle",
        });
        return;
      }

      // Генерируем новую соль и мастер-ключ
      const newSalt = generateSalt();
      const newMasterKey = await deriveKeyFromPassword(newPassword, newSalt);

      // Шифруем приватный ключ новым мастер-ключом
      const newEncryptedPrivateKeyByUser = await encryptData(
        recoveredPrivateKey,
        newMasterKey,
      );

      // Обновляем пароль и ключи
      const updateResult = await updatePasswordAndKeys({
        login: username,
        oldPassword: "",
        newPassword: newPassword,
        newEncryptedPrivateKeyByUser,
        newSalt,
      });

      if (updateResult.status !== 200) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: updateResult.message || "Ошибка при обновлении пароля",
          icon: "alertCircle",
        });
        return;
      }

      // Очищаем временные данные
      setRecoveredPrivateKey(null);

      showToast({
        variant: "success",
        title: "Успешно",
        description:
          "Пароль успешно обновлен! Теперь вы можете войти в систему.",
        icon: "checkCircle",
      });

      navigate("/");
    } catch (error) {
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description:
          "Произошла ошибка при обновлении пароля. Пожалуйста, попробуйте снова.",
        icon: "alertCircle",
      });
      console.error("Password update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (stage === "password") {
      setStage("login");
      setRecoveredPrivateKey(null);
    } else {
      navigate("/");
    }
  };

  return (
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
            {stage === "login"
              ? "Восстановление аккаунта"
              : "Установка нового пароля"}
          </CardTitle>
          <p className={`text-sm text-center ${currentTheme.text} opacity-70`}>
            {stage === "login"
              ? "Введите имя пользователя и ключ доступа"
              : "Установите новый пароль для вашего аккаунта"}
          </p>
        </CardHeader>
        <CardContent>
          {stage === "login" ? (
            <form onSubmit={handleStage1Submit} className="space-y-4">
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
                <Label htmlFor="accessKey" className={`${currentTheme.text}`}>
                  Ключ доступа
                </Label>
                <div className="relative">
                  <Icons.lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="accessKey"
                    type="text"
                    placeholder="Введите ключ доступа"
                    className="pl-9"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Введите ключ доступа, который вы получили при регистрации
                </p>
              </div>

              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Назад
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    "Продолжить"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleStage2Submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className={`${currentTheme.text}`}>
                  Новый пароль
                </Label>
                <div className="relative">
                  <Icons.lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Введите новый пароль"
                    className="pl-9"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                  Подтвердите новый пароль
                </Label>
                <div className="relative">
                  <Icons.lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Подтвердите новый пароль"
                    className="pl-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Назад
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Обновление...
                    </>
                  ) : (
                    "Обновить пароль"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RecoveryForm;
