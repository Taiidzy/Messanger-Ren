import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scrollbar } from "react-scrollbars-custom";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useTheme,
  themes,
  getTextStyle,
} from "@/components/theme/ThemeProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import Settings from "@/components/messenger/Settings";
import SearchUser from "@/components/messenger/SearchUser";
import type { User } from "@/components/models/User";
import { getInitials } from "@/components/utils/format";
import { API_URL } from "@/components/utils/const";
import type { ContactStatus } from "@/components/api/statusClient";
import { useCrypto } from "@/components/context/CryptoContext";
import { decryptMessage, unwrapSymmetricKey } from "@/components/utils/crypto";

// Интерфейс для пропсов компонента UsersList
interface UsersListProps {
  users: User[]; // Массив пользователей для отображения
  contactStatuses: ContactStatus[]; // Массив статусов контактов
  onSelectUser: (user: User) => void; // Функция обратного вызова при выборе пользователя
  onClose?: () => void; // Новый проп для закрытия (опционально)
}

const UsersList: React.FC<UsersListProps> = ({
  users,
  contactStatuses,
  onSelectUser,
  onClose,
}) => {
  // Получаем текущую тему и её конфигурацию
  const { theme } = useTheme();
  const currentTheme = themes[theme];

  // Определяем, какие анимации использовать
  const isMobile = !!onClose;

  return (
    // Основная карточка списка пользователей
    <div className={`h-full overflow-hidden rounded-3xl border-2 border-white/30 shadow-2xl bg-white/30 dark:bg-gray-900/30 backdrop-blur-2xl hover:shadow-[0_8px_40px_rgba(139,92,246,0.10)] hover:border-purple-400/40 ring-1 ring-white/20 ring-inset before:content-[''] before:absolute before:inset-0 before:rounded-3xl before:pointer-events-none before:shadow-[inset_0_0_40px_0_rgba(255,255,255,0.10)] transition-all duration-500 relative z-10`}>
      {/* Кнопка закрытия только на мобильных */}
      <AnimatePresence>
        {onClose && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="md:hidden absolute top-3 right-16 z-20 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
            onClick={onClose}
            aria-label="Закрыть список чатов"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeWidth="2"
                d="M6 6l12 12M6 18L18 6"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Анимированный контейнер с эффектом появления */}
      {isMobile ? (
        <motion.div
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
          className={`h-full shadow-lg rounded-xl text-card-foreground p-2 z-10 ${currentTheme.card}`}
        >
          {/* Содержимое для мобильных */}
          <MobileContent
            users={users}
            onSelectUser={onSelectUser}
            onClose={onClose}
            theme={theme}
            contactStatuses={contactStatuses}
          />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full p-2 rounded-xl z-10 ${currentTheme.card} text-card-foreground shadow`}
        >
          {/* Содержимое для десктопа */}
          <DesktopContent
            users={users}
            onSelectUser={onSelectUser}
            theme={theme}
            contactStatuses={contactStatuses}
          />
        </motion.div>
      )}
    </div>
  );
};

// Компонент для мобильного содержимого
const MobileContent: React.FC<{
  users: User[];
  onSelectUser: (user: User) => void;
  onClose?: () => void;
  theme: "light" | "dark" | "orange" | "cosmic";
  contactStatuses: ContactStatus[]; //
}> = ({ users, onSelectUser, onClose, theme, contactStatuses }) => { //
  
  const currentTheme = themes[theme];
  return (
    <>
      {/* Заголовок списка пользователей */}
      <motion.div
        className="flex items-center justify-between mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {/* Карточка с заголовком "Чаты" */}
        <Card className={`rounded-xl border bg-card text-card-foreground shadow ${theme === "orange" ? currentTheme.card : ""}`}>
          <h1 className={`text-2xl font-bold p-2 ${getTextStyle(theme)}`}>Чаты</h1>
        </Card>
        {/* Компонент настроек */}
        <SearchUser />
        <Settings />
      </motion.div>

      {/* Область прокрутки для списка пользователей */}
      <Scrollbar
        style={{ height: "calc(100% - 120px)" }}
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
            backgroundColor:
              theme === "cosmic"
                ? "rgba(139, 92, 246, 0.3)"
                : theme === "dark"
                  ? "rgba(156, 163, 175, 0.3)"
                  : theme === "orange"
                    ? "rgba(251, 146, 60, 0.3)"
                    : "rgba(209, 213, 219, 0.3)",
            borderRadius: "9999px",
            width: "8px",
            transition: "background-color 0.2s ease",
          },
        }}
      >
        {/* Итерация по каждому пользователю в списке */}
        {users.map((user, index) => {
          // Находим статус для текущего пользователя
          const userStatus = contactStatuses.find( //
            (status) => status.user_id === user.companion_id //
          );
          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: index * 0.05,
                duration: 0.3,
                ease: "easeOut",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mb-2 px-2 first:mt-0"
              onClick={() => {
                onSelectUser(user);
                if (onClose) onClose();
              }}
            >
              {/* Передаем найденный статус в UserCard */}
              <UserCard user={user} theme={theme} status={userStatus} />
            </motion.div>
          );
        })}
      </Scrollbar>
    </>
  );
};

// Компонент для десктопного содержимого
const DesktopContent: React.FC<{
  users: User[];
  onSelectUser: (user: User) => void;
  theme: "light" | "dark" | "orange" | "cosmic";
  contactStatuses: ContactStatus[]; //
}> = ({ users, onSelectUser, theme, contactStatuses }) => { //

  const currentTheme = themes[theme];
  return (
    <>
      {/* Заголовок списка пользователей */}
      <motion.div
        className="flex items-center justify-between mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {/* Карточка с заголовком "Чаты" */}
        <Card className={`rounded-xl border bg-card text-card-foreground shadow ${theme === "orange" ? currentTheme.card : ""}`}>
          <h1 className={`text-2xl font-bold p-2 ${getTextStyle(theme)}`}>Чаты</h1>
        </Card>
        {/* Компонент настроек */}
        <SearchUser />
        <Settings />
      </motion.div>

      {/* Область прокрутки для списка пользователей */}
      <Scrollbar
        style={{ height: "calc(100% - 120px)" }}
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
            backgroundColor:
              theme === "cosmic"
                ? "rgba(139, 92, 246, 0.3)"
                : theme === "dark"
                  ? "rgba(156, 163, 175, 0.3)"
                  : theme === "orange"
                    ? "rgba(251, 146, 60, 0.3)"
                    : "rgba(209, 213, 219, 0.3)",
            borderRadius: "9999px",
            width: "8px",
            transition: "background-color 0.2s ease",
          },
        }}
      >
        {/* Итерация по каждому пользователю в списке */}
        {users.map((user, index) => {
          // Находим статус для текущего пользователя
          const userStatus = contactStatuses.find( //
            (status) => status.user_id === user.companion_id //
          );
          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: index * 0.05,
                duration: 0.3,
                ease: "easeOut",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mb-2 px-2 first:mt-0"
              onClick={() => {
                onSelectUser(user);
              }}
            >
              {/* Передаем найденный статус в UserCard */}
              <UserCard user={user} theme={theme} status={userStatus} />
            </motion.div>
          );
        })}
      </Scrollbar>
    </>
  );
};

// Компонент карточки пользователя
const UserCard: React.FC<{
  user: User;
  theme: "light" | "dark" | "orange" | "cosmic";
  status?: ContactStatus;
}> = ({ user, theme, status }) => {
  const { privateKey } = useCrypto();
  const [lastMessage, setLastMessage] = useState<string>("Расшифровка..."); // 1. Состояние для сообщения

  const isOnline = status?.status === "online";
  const currentTheme = themes[theme];

  // 2. Используем useEffect для асинхронной расшифровки
  useEffect(() => {
    const decryptLastMessage = async () => {
      // Проверяем наличие всех необходимых данных
      if (!privateKey || !user.last_message || !user.last_message.envelopes) {
        setLastMessage("");
        return;
      }

      try {
        const userIdStr = user.user_id.toString();
        const userIdNum = user.user_id;
        
        // Безопасно получаем envelope
        const envelope = Array.isArray(user.last_message.envelopes)
          ? user.last_message.envelopes[userIdNum] || user.last_message.envelopes[userIdStr]
          : user.last_message.envelopes[userIdStr] || user.last_message.envelopes[userIdNum];

        if (!envelope) {
          throw new Error("Envelope for the current user not found.");
        }
        
        // 3. Дожидаемся получения ключа
        const messageKey = await unwrapSymmetricKey(
          envelope.key,
          envelope.ephemPubKey,
          envelope.iv,
          privateKey,
        );

        // Определяем, текст это или файл
        if (user.last_message.message_type === "text") {
            // 4. Дожидаемся расшифровки сообщения
            const decryptedText = await decryptMessage(
                user.last_message.ciphertext,
                user.last_message.nonce,
                messageKey
            );
            setLastMessage(decryptedText);
        } else {
            setLastMessage("Файл");
        }

      } catch (error) {
        console.error("Failed to decrypt message:", error);
        setLastMessage("Ошибка расшифровки"); // Показываем ошибку пользователю
      }
    };

    decryptLastMessage();
  }, [user, privateKey]); // Зависимости хука

  return (
    <Button
      variant="ghost"
      className={`w-full p-0 h-auto hover:bg-transparent cursor-pointer rounded-xl border bg-card text-card-foreground shadow ${theme === "orange" ? currentTheme.card : ""}`}
    >
      <Card
        className={`w-full bg-gray-50/0 border-1 p-2 transition-all duration-200 ${
          theme === "cosmic"
            ? "hover:bg-purple-500/10 hover:shadow-lg"
            : theme === "dark"
              ? "hover:bg-gray-800/50 hover:shadow-lg"
              : "hover:bg-gray-100/50 hover:shadow-lg"
        }`}
      >
        <CardHeader className="justify-between p-2">
          <div className="flex items-center gap-3">
            <Avatar
              className={`h-12 w-12 border-2 transition-all duration-200 ${isOnline ? "border-green-400" : "border-red-400"}`}
            >
              <AvatarImage
                src={`${API_URL}/storage/avatars/${user.companion_avatar}?${new Date().getTime()}`}
                alt={user.companion_userName}
                className="object-cover w-full h-full"
              />
              <AvatarFallback>
                {getInitials(user.companion_userName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1 justify-start min-w-0 flex-1">
              <CardTitle
                className={`text-base font-bold ${getTextStyle(theme)}`}
              >
                {user.companion_userName}
              </CardTitle>
              <div className="w-full min-w-0">
                {/* 5. Отображаем сообщение из состояния */}
                <h1
                  className={`text-xs overflow-hidden truncate whitespace-nowrap text-center w-full ${getTextStyle(theme)}`}
                  title={lastMessage}
                >
                  {lastMessage}
                </h1>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
    </Button>
  );
};

export default UsersList;
