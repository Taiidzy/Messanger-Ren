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
import { useCrypto } from "@/components/context/CryptoContext";

const LoginForm: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const { showToast } = useToast();
  const { loadKeysOnLogin } = useCrypto();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!username || !password) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Пожалуйста, заполните все поля",
          icon: "alertCircle",
        });
        return;
      }

      // Вызываем loadKeysOnLogin, которая сама обрабатывает получение и сохранение ключей
      const success = await loadKeysOnLogin(username, password);

      if (success.status === 200) {
        showToast({
          variant: "success",
          title: "Успех",
          description: "Вы успешно вошли в аккаунт.",
          icon: "checkCircle",
        });
        navigate("/");
      } else {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: success.message,
          icon: "alertCircle",
        });
        localStorage.removeItem("token"); // Убедитесь, что токен удаляется при неудаче
      }
    } catch (error) {
      console.error("Login error:", error);
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: `Произошла ошибка при входе: ${error instanceof Error ? error.message : String(error)}`,
        icon: "alertCircle",
      });
    } finally {
      setIsLoading(false);
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
            Добро пожаловать обратно
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
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Вход...
                  </>
                ) : (
                  "Войти"
                )}
              </Button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/recover")}
                className={`text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline`}
              >
                Забыли пароль?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default LoginForm;
