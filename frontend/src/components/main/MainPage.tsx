import React, { useEffect, useState } from "react";
/**
 * Главная страница мессенджера.
 * Отвечает за:
 * - загрузку списка чатов
 * - подключение клиента статусов (онлайн/оффлайн)
 * - роутинг между списком пользователей и активным чатом (включая мобильный режим с выезжающей панелью)
 */
import { motion, AnimatePresence } from "framer-motion";

import UsersList from "@/components/messenger/UsersList";
import Chat from "@/components/messenger/Chat";
import { Background } from "@/components/theme/Background";

import { getChat } from "@/components/api/Chats";
import type { User } from "@/components/models/User";
import { logoutUser } from "@/components/auth/Logout";
import { useNavigate } from "react-router";
import { useToast } from "@/components/ui/toast-context";
import { OnlineStatusClient } from "@/components/api/statusClient";
import type { ContactStatus } from "@/components/api/statusClient";
import { ONLINE_SERVICE_URL } from "@/components/utils/const";

const MainPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [companionIds, setCompanionIds] = useState<number[]>([]); // добавлено
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUsersListOpen, setIsUsersListOpen] = useState(false);
  const [contactStatuses, setContactStatuses] = useState<ContactStatus[]>([]); // Новое состояние для статусов
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        const chatUsers = await getChat(token);
        if (chatUsers === 401) {
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
        if (chatUsers) {
          setUsers(chatUsers);
        }
      }
    };

    fetchUsers();
  }, [showToast, navigate]);

  // Делаем рефетч доступным для дочерних компонентов
  const refreshUsers = React.useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const chatUsers = await getChat(token);
    if (chatUsers && chatUsers !== 401) {
      setUsers(chatUsers);
    }
  }, []);

  useEffect(() => {
    setCompanionIds(users.map((user) => user.companion_id));
  }, [users]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token && companionIds.length > 0) {
      const statusClient = OnlineStatusClient.getInstance(token, companionIds);

      // Обновляем состояние contactStatuses при получении полного списка статусов
      statusClient.onContactsUpdateCallback((contacts) => {
        setContactStatuses(contacts); // Обновляем состояние
      });

      // Обновляем состояние contactStatuses при изменении статуса одного контакта
      statusClient.onContactStatusChangeCallback((contact) => {
        setContactStatuses(prevStatuses => {
          const existingIndex = prevStatuses.findIndex(s => s.user_id === contact.user_id);
          if (existingIndex > -1) {
            const newStatuses = [...prevStatuses];
            newStatuses[existingIndex] = contact; // Обновляем существующий статус
            return newStatuses;
          } else {
            return [...prevStatuses, contact]; // Добавляем новый статус, если его нет
          }
        });
      });

      statusClient.onErrorCallback((error) => {
          console.error('❌ Ошибка:', error);
      });

      statusClient.connect(ONLINE_SERVICE_URL).catch(error => {
        console.error('Не удалось подключиться:', error);
      });

      return () => {
        statusClient.disconnect();
      };
    }
  }, [companionIds]);

  return (
    <Background>
      <AnimatePresence>
        {!isUsersListOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="md:hidden fixed top-4 left-4 z-50 glass rounded-full p-2 hover:bg-white/50 dark:hover:bg-gray-800/60 transition-colors duration-200"
            onClick={() => setIsUsersListOpen(true)}
            aria-label="Открыть список чатов"
          >
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex flex-row gap-4 h-[calc(100vh-2rem)] overflow-hidden p-4">
        <div className="w-1/6 flex-shrink-0 hidden md:block">
          <UsersList
            users={users}
            onSelectUser={(user) => {
              setSelectedUser(user);
            } }
            contactStatuses={contactStatuses}
            onChatCreated={refreshUsers}
          />
        </div>

        <AnimatePresence>
          {isUsersListOpen && (
            <motion.div
              className="fixed inset-0 z-50 flex md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="absolute inset-0 bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => setIsUsersListOpen(false)}
              />

              <motion.div
                className="relative w-4/5 max-w-xs h-full glass"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                <UsersList
                  users={users}
                  onSelectUser={(user) => {
                    setSelectedUser(user);
                    setIsUsersListOpen(false);
                  }}
                  onClose={() => setIsUsersListOpen(false)}
                  contactStatuses={contactStatuses}
                  onChatCreated={refreshUsers}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 h-full overflow-hidden">
          {selectedUser ? (
            <Chat
              user={selectedUser}
              contactStatuses={contactStatuses}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Выберите чат для начала переписки</p>
            </div>
          )}
        </div>
      </div>
    </Background>
  );
};

export default MainPage;
