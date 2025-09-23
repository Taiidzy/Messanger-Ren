import React from "react";
import { motion } from "framer-motion";
import {
  useTheme,
  themes,
  getTextStyle,
} from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PROFILES_SERVICE_URL } from "@/components/utils/const";
import { createChat } from "@/components/api/Chats";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/toast-context";
import { getInitials } from "@/components/utils/format";
import Scrollbar from "react-scrollbars-custom";
import { logoutUser } from "@/components/auth/Logout";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { searchUser } from "@/components/api/User";

interface UserData {
  login?: string;
  id?: string;
  userName?: string;
  avatar?: string;
}

type SearchUserProps = {
  onChatCreated?: () => void | Promise<void>;
};

const SearchUser: React.FC<SearchUserProps> = ({ onChatCreated }) => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [users, setUsers] = React.useState<UserData[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreatingChat, setIsCreatingChat] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const token = localStorage.getItem("token") || "";

  // Debounce для поиска пользователей
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = React.useCallback(
    React.useMemo(() => {
      let timeoutId: NodeJS.Timeout;
      return (query: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (query.trim().length >= 2) {
            fetchUsers(query.trim());
          } else {
            setUsers([]);
          }
        }, 300);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
    [],
  );

  const fetchUsers = async (loginQuery?: string) => {
    if (!loginQuery || loginQuery.trim().length < 2) {
      setUsers([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await searchUser(loginQuery, token);
      if (data === 401) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Вы не авторизованы",
          icon: "alertCircle",
        });
        setTimeout(async () => {
          await logoutUser();
          navigate("/login");
        }, 1000);
        return;
      }
      
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Ошибка при поиске пользователей:", error);
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось найти пользователей. Попробуйте еще раз.",
        icon: "alertCircle",
      });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSelectUser = async (user: UserData) => {
    if (!user.id) {
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Некорректные данные пользователя.",
        icon: "alertCircle",
      });
      return;
    }

    setIsCreatingChat(true);
    try {
      const result = await createChat(token, Number(user.id));
      if (result === 401) {
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Вы не авторизованы",
          icon: "alertCircle",
        });
        setTimeout(async () => {
          await logoutUser();
          navigate("/login");
        }, 1000);
        return;
      }
      if (result === 201) {
        showToast({
          variant: "success",
          title: "Успех",
          description: "Вы успешно создали чат с пользователем.",
          icon: "checkCircle",
        });
        setSearchQuery("");
        setUsers([]);
        setIsCreatingChat(false);
        // Обновляем список чатов на главной странице
        try {
          await onChatCreated?.();
        } catch (e) {
          // fail-safe: даже если колбэк упадет, продолжим
          console.error("onChatCreated error:", e);
        }
        navigate("/");
      } else {
        throw new Error(`Ошибка создания чата: ${result}`);
      }
    } catch (error) {
      console.error("Ошибка при создании чата:", error);
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось создать чат. Попробуйте еще раз.",
        icon: "alertCircle",
      });
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
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
            <Search
              className={`h-5 w-5 relative z-10 ${theme === "dark" ? "text-black" : "text-white"}`}
            />
            <motion.div
              layoutId="searchUser"
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
            Поиск пользователей
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="py-4">
          <div className="relative">
            <Input
              className={`w-full ${currentTheme.text} ${currentTheme.border} bg-white/20 dark:bg-black/20 backdrop-blur-xl placeholder:opacity-60`}
              onChange={handleSearchChange}
              value={searchQuery}
              placeholder="Введите логин пользователя (минимум 2 символа)..."
              style={{ wordBreak: "break-all" }}
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <Scrollbar
          style={{ height: "300px" }}
          noScrollX
          contentProps={{
            style: {
              paddingRight: "8px",
              paddingTop: "8px",
              paddingBottom: "16px",
            },
          }}
          trackYProps={{
            style: {
              backgroundColor: "transparent",
              width: "8px",
              right: 0,
              bottom: 2,
              top: 2,
            },
          }}
          thumbYProps={{
            style: {
              backgroundColor: theme === "dark" ? "rgba(156, 163, 175, 0.3)" : "rgba(209, 213, 219, 0.3)",
              borderRadius: "9999px",
              width: "8px",
              transition: "background-color 0.2s ease",
            },
          }}
        >
          <div>
            {users.length === 0 && searchQuery.length >= 2 && !isLoading && (
              <div
                className={`text-center py-8 ${currentTheme.text} opacity-70`}
              >
                Пользователи не найдены
              </div>
            )}

            {users.map((user) => (
              <motion.div
                whileHover={{ scale: 1.02 }} // Эффект при наведении
                whileTap={{ scale: 0.98 }} // Эффект при нажатии
                className="mb-2 px-2 first:mt-0" // Отступы между пользователями
                onClick={() => onSelectUser(user)} // Обработчик клика
              >
                {/* Кнопка для выбора пользователя */}
                <Button
                  variant="ghost" // Тип кнопки без фона
                  className="w-full p-0 h-auto hover:bg-transparent cursor-pointer border-0 focus:ring-0 focus:outline-none"
                  disabled={isCreatingChat}
                >
                  {/* Карточка пользователя */}
                  <Card
                    className={`w-full bg-gray-50/0 border-1 p-2 transition-colors duration-200 ${ theme === "dark" ? "hover:bg-gray-800/50" : "hover:bg-gray-100/50" }`}
                  >
                    {/* Заголовок карточки пользователя */}
                    <CardHeader className="justify-between p-2">
                      <div className="flex items-center gap-3">
                        {/* Аватар пользователя с индикаторами статуса */}
                        <Avatar className="w-12 h-12">
                          <AvatarImage
                            src={`${PROFILES_SERVICE_URL}/storage/avatars/${user.avatar}?${new Date().getTime()}`}
                            alt={user.userName || "User"}
                            className="object-cover w-full h-full"
                          />
                          <AvatarFallback>
                            {getInitials(user.userName || "User")}
                          </AvatarFallback>
                        </Avatar>
                        {/* Информация о пользователе */}
                        <div className="flex flex-col gap-1 justify-start min-w-0 flex-1">
                          {/* Имя пользователя */}
                          <CardTitle
                            className={`text-base font-bold ${getTextStyle(theme)}`}
                          >
                            {user.userName || "Неизвестный пользователь"}
                          </CardTitle>
                          {user.login && (
                            <span
                              className={`text-sm opacity-70 ${currentTheme.text}`}
                            >
                              @{user.login}
                            </span>
                          )}
                        </div>
                        {isCreatingChat && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                </Button>
              </motion.div>
            ))}
          </div>
        </Scrollbar>
        <AlertDialogFooter>
          <AlertDialogCancel
            className={`cursor-pointer ${theme === "dark" ? "text-black bg-white hover:bg-gray-100" : "text-white bg-black hover:bg-gray-800"}`}
          >
            Закрыть
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SearchUser;
