import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme, themes } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  Settings as Icon,
  User,
  LogOut,
  Palette,
  Camera,
  HardDrive,
  Trash2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useToast } from "@/components/ui/toast-context";
import { logoutUser } from "@/components/auth/Logout";
import { useNavigate } from "react-router-dom";
import { getUser, updateUserName } from "@/components/api/User";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AvatarUpload from "@/components/ui/avatar-upload";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/components/utils/format";
import { FileService } from "@/components/api/fileService";
import { API_URL } from "@/components/utils/const";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserData {
  login?: string;
  id?: string;
  userName?: string;
  created_at?: string;
  avatar?: string;
}

const Settings: React.FC = () => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [userData, setUserData] = useState<UserData>({});
  const [avatarError, setAvatarError] = useState(false);
  const [isAvatarUploadOpen, setIsAvatarUploadOpen] = useState(false);
  const token = localStorage.getItem("token") || "";
  const [editName, setEditName] = useState(false);
  const [newUserName, setNewUserName] = useState(userData.userName || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const handleLogout = () => {
    if (logoutUser()) {
      showToast({
        variant: "warning",
        title: "Внимание",
        description: "Вы успешно вышли из аккаунта",
        icon: "warning",
      });
      navigate("/login");
    }
  };

  const handleAvatarError = () => {
    setAvatarError(true);
  };

  const handleAvatarUpload = () => {
    setIsAvatarUploadOpen(true);
  };

  const handleAvatarUpdate = async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await fetch(`${API_URL}/user/update/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }

      // Принудительно обновляем аватар, сбрасывая ошибку и увеличивая ключ
      setAvatarError(false);

      showToast({
        variant: "success",
        title: "Успех",
        description: "Аватар успешно обновлен",
        icon: "check",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      throw error; // Перебрасываем ошибку для обработки в компоненте AvatarUpload
    }
  };

  // Функция для получения размера кеша
  const fetchCacheSize = async () => {
    try {
      const size = await FileService.getCacheSize();
      setCacheSize(size);
    } catch (error) {
      console.error("Ошибка получения размера кеша:", error);
      setCacheSize(0);
    }
  };

  // Функция для очистки кеша
  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await FileService.clearAllCache(); // Используем полную очистку кеша
      await fetchCacheSize(); // Обновляем размер кеша
      showToast({
        variant: "success",
        title: "Успех",
        description: "Кеш файлов очищен",
        icon: "check",
      });
    } catch (error) {
      console.error("Ошибка очистки кеша:", error);
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось очистить кеш",
        icon: "alertCircle",
      });
    } finally {
      setIsClearingCache(false);
    }
  };

  // Функция для очистки только старых файлов
  const handleClearOldFiles = async () => {
    setIsClearingCache(true);
    try {
      await FileService.cleanupCache(); // Очищаем только старые файлы (по умолчанию 7 дней)
      await fetchCacheSize(); // Обновляем размер кеша
      showToast({
        variant: "success",
        title: "Успех",
        description: "Старые файлы очищены",
        icon: "check",
      });
    } catch (error) {
      console.error("Ошибка очистки старых файлов:", error);
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось очистить старые файлы",
        icon: "alertCircle",
      });
    } finally {
      setIsClearingCache(false);
    }
  };

  // Функция для форматирования размера файла
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const user = await getUser(token);
        if (user === 401) {
          await logoutUser();
          navigate("/login");
          showToast({
            variant: "destructive",
            title: "Ошибка",
            description: "Вы не авторизованы",
            icon: "alertCircle",
          });
          return;
        }
        if (user) {
          setUserData(user);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось загрузить данные пользователя",
          icon: "alertCircle",
        });
      }
    };

    fetchUser();
    fetchCacheSize(); // Загружаем размер кеша при инициализации
  }, [token, navigate, showToast]);

  useEffect(() => {
    setNewUserName(userData.userName || "");
  }, [userData.userName]);

  const avatarUrl =
    userData.login && !avatarError
      ? `${API_URL}/storage/avatars/${userData.avatar}?${new Date().getTime()}`
      : undefined;

  const handleEditName = () => setEditName(true);
  const handleCancelEditName = () => {
    setEditName(false);
    setNewUserName(userData.userName || "");
  };
  const handleSaveName = async () => {
    setIsSavingName(true);
    try {
      const updated = await updateUserName(token, newUserName);
      if (updated) {
        setUserData((prev) => ({ ...prev, userName: updated.userName }));
        showToast({
          variant: "success",
          title: "Успех",
          description: "Имя пользователя обновлено",
          icon: "check",
        });
        setEditName(false);
      } else {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось обновить имя пользователя",
          icon: "alertCircle",
        });
      }
    } catch {
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Ошибка при обновлении имени пользователя",
        icon: "alertCircle",
      });
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            size="icon"
            variant="glass"
            className={`relative cursor-pointer overflow-hidden ${currentTheme.border}`}
          >
            <Icon
              className={`h-5 w-5 relative z-10 ${theme === "dark" ? "text-black" : "text-white"}`}
            />
            <motion.div
              layoutId="settings"
              className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary rounded-lg"
              initial={false}
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          </Button>
        </motion.div>
      </AlertDialogTrigger>

      <AlertDialogContent
        className={`${currentTheme.card} ${currentTheme.border} max-w-2xl`}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className={`${currentTheme.text} text-2xl font-bold flex items-center gap-2`}
          >
            <Icon className="h-6 w-6" />
            Настройки
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="py-4">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList
              className={`grid w-full grid-cols-3 ${currentTheme.background}`}
            >
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Профиль
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Настройки
              </TabsTrigger>
              <TabsTrigger value="cache" className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Кеш
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 mt-6">
              <Card
                className={`${currentTheme.card} ${currentTheme.border} max-w-lg w-full mx-auto`}
              >
                <CardHeader>
                  <CardTitle
                    className={`${currentTheme.text} flex items-center gap-2`}
                  >
                    <User className="h-5 w-5" />
                    Информация профиля
                  </CardTitle>
                  <CardDescription className={currentTheme.text}>
                    Ваши личные данные и настройки аккаунта
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative">
                      <Avatar className="w-20 h-20">
                        <AvatarImage
                          src={avatarUrl}
                          alt={userData.login}
                          onError={handleAvatarError}
                          className="object-cover w-full h-full"
                        />
                        <AvatarFallback className="text-lg font-semibold">
                          {getInitials(userData.login)}
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full"
                        onClick={handleAvatarUpload}
                      >
                        <Camera className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex flex-col space-y-1 min-w-0 max-w-full">
                      <h3
                        className={`${currentTheme.text} text-lg font-semibold flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full`}
                      >
                        {editName ? (
                          <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <input
                              className="border rounded px-2 py-1 text-base mr-0 sm:mr-2 w-full sm:w-auto min-w-0"
                              value={newUserName}
                              onChange={(e) => setNewUserName(e.target.value)}
                              disabled={isSavingName}
                              maxLength={32}
                              style={{ wordBreak: "break-all" }}
                            />
                            <div className="flex gap-2 mt-2 sm:mt-0">
                              <Button
                                size="sm"
                                onClick={handleSaveName}
                                disabled={isSavingName || !newUserName.trim()}
                              >
                                Сохранить
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleCancelEditName}
                                disabled={isSavingName}
                              >
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0 max-w-full">
                            <span className="truncate max-w-[180px] block">
                              {userData.userName || "Пользователь"}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="ml-2"
                              onClick={handleEditName}
                            >
                              <svg
                                width="16"
                                height="16"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  d="M16.862 5.487a2.06 2.06 0 0 1 2.916 2.915l-9.193 9.193a2 2 0 0 1-.707.464l-3.11 1.037a.5.5 0 0 1-.632-.632l1.037-3.11a2 2 0 0 1 .464-.707l9.193-9.193Z"
                                />
                              </svg>
                            </Button>
                          </div>
                        )}
                      </h3>
                    </div>
                  </div>

                  <Separator className={currentTheme.border} />

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className={currentTheme.text}>Логин</span>
                      <span
                        className={`${currentTheme.text} font-mono truncate max-w-[160px] text-right`}
                        title={userData.login || ""}
                      >
                        {userData.login || "---"}
                      </span>
                    </div>
                    {userData.id && (
                      <div className="flex justify-between items-center">
                        <span className={currentTheme.text}>
                          id пользователя
                        </span>
                        <span
                          className={`${currentTheme.text} font-mono truncate max-w-[160px] text-right`}
                          title={userData.id}
                        >
                          {userData.id}
                        </span>
                      </div>
                    )}
                    {userData.created_at && (
                      <div className="flex justify-between items-center">
                        <span className={currentTheme.text}>
                          Дата регистрации
                        </span>
                        <span className={`${currentTheme.text} font-mono`}>
                          {userData.created_at.split("T")[0]}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-6">
              <Card className={`${currentTheme.card} ${currentTheme.border}`}>
                <CardHeader>
                  <CardTitle
                    className={`${currentTheme.text} flex items-center gap-2`}
                  >
                    <Palette className="h-5 w-5" />
                    Тема оформления
                  </CardTitle>
                  <CardDescription className={currentTheme.text}>
                    Выберите подходящую тему для интерфейса
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={currentTheme.text}>Переключение темы</p>
                      <p className={`${currentTheme.text} text-sm`}>
                        Светлая или тёмная тема
                      </p>
                    </div>
                    <ThemeToggle />
                  </div>
                </CardContent>
              </Card>

              <Card className={`${currentTheme.card} ${currentTheme.border}`}>
                <CardHeader>
                  <CardTitle
                    className={`${currentTheme.text} flex items-center gap-2 text-red-600`}
                  >
                    <LogOut className="h-5 w-5" />
                    Выход из аккаунта
                  </CardTitle>
                  <CardDescription className={currentTheme.text}>
                    Завершить текущую сессию
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleLogout}
                    variant="destructive"
                    className="w-full sm:w-auto"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Выйти из аккаунта
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cache" className="space-y-4 mt-6">
              <Card className={`${currentTheme.card} ${currentTheme.border}`}>
                <CardHeader>
                  <CardTitle
                    className={`${currentTheme.text} flex items-center gap-2`}
                  >
                    <HardDrive className="h-5 w-5" />
                    Кеш файлов
                  </CardTitle>
                  <CardDescription className={currentTheme.text}>
                    Управление кешированными файлами для быстрой загрузки
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={currentTheme.text}>Размер кеша</p>
                      <p className={`${currentTheme.text} text-sm`}>
                        Занято места на диске
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`${currentTheme.text} font-semibold`}>
                        {formatFileSize(cacheSize)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchCacheSize}
                        className="mt-1"
                      >
                        Обновить
                      </Button>
                    </div>
                  </div>

                  <Separator className={currentTheme.border} />

                  <div className="space-y-3">
                    <div>
                      <p className={`${currentTheme.text} text-sm mb-2`}>
                        Кеш содержит загруженные файлы для быстрого доступа.
                        Старые файлы автоматически удаляются через 7 дней.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleClearCache}
                        variant="destructive"
                        disabled={isClearingCache || cacheSize === 0}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isClearingCache ? "Очистка..." : "Очистить кеш"}
                      </Button>

                      <Button
                        onClick={handleClearOldFiles}
                        variant="outline"
                        disabled={isClearingCache}
                        className="flex items-center gap-2"
                      >
                        <HardDrive className="h-4 w-4" />
                        Очистить старые файлы
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            className={`cursor-pointer ${theme === "dark" ? "text-black bg-white hover:bg-gray-100" : "text-white bg-black hover:bg-gray-800"}`}
          >
            Закрыть
          </AlertDialogCancel>
        </AlertDialogFooter>

        {/* Компонент загрузки аватара */}
        <AvatarUpload
          isOpen={isAvatarUploadOpen}
          onClose={() => setIsAvatarUploadOpen(false)}
          onAvatarUpdate={handleAvatarUpdate}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default Settings;
