/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme, themes } from "@/components/theme/ThemeProvider";
import { Card } from "@/components/ui/card";
import { Scrollbar } from "react-scrollbars-custom";
import Message from "@/components/ui/message";
import MessageComposer from "@/components/ui/message-composer";
import FileUploadProgress from "@/components/ui/file-upload-progress";
import ScrollToBottom from "@/components/ui/scroll-to-bottom";
import type { UserChat } from "@/components/models/Chat";
import type { Messages, Recipient } from "@/components/models/Messages";
import type { UploadProgress } from "@/components/api/messageService";
import { getMessages } from "@/components/api/Chats";
import { useMessageService } from "@/components/api/messageService";
import { importPublicKeyFromSpki } from "@/components/utils/crypto";
import { useCrypto } from "@/components/context/CryptoContext";
import { decryptedMessagesFromServer } from "@/components/utils/decryptedMessageFromServer";
import UserInfo from "@/components/ui/userinfo";
import { logoutUser } from "@/components/auth/Logout";
import { useNavigate } from "react-router";
import { useToast } from "@/components/ui/toast-context";
import { FileService } from "@/components/api/fileService";
import type { ContactStatus } from "@/components/api/statusClient";

interface UserProps {
  user: UserChat;
  contactStatuses: ContactStatus[];
}

// Мемоизированный компонент для UserInfo
const MemoizedUserInfo = React.memo(UserInfo);

// Мемоизированный компонент для Message
const MemoizedMessage = React.memo(Message);

// Мемоизированный компонент для MessageComposer
const MemoizedMessageComposer = React.memo(MessageComposer);

// Мемоизированный компонент для FileUploadProgress
const MemoizedFileUploadProgress = React.memo(FileUploadProgress);

// Мемоизированный компонент для ScrollToBottom
const MemoizedScrollToBottom = React.memo(ScrollToBottom);

const Chat: React.FC<UserProps> = ({ user, contactStatuses }) => {
  const { theme } = useTheme();
  const { privateKey, publicKey, isLoadingKeys } = useCrypto();
  const currentTheme = themes[theme];
  const token = localStorage.getItem("token");

  const [messages, setMessages] = useState<Messages[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Исправлено: уточнен тип для scrollbarRef, чтобы TypeScript знал о методе getValues()
  const scrollbarRef = useRef<Scrollbar | null>(null);
  const isFirstLoad = useRef(true);
  const hasShownTokenErrorRef = useRef(false);
  const lastScrollTop = useRef(0);
  const scrollTimer = useRef<NodeJS.Timeout | null>(null);
  const isNearBottomRef = useRef(true);

  const navigate = useNavigate();
  const { showToast } = useToast();

  // Мемоизируем данные пользователя для UserInfo
  const userInfoData = useMemo(() => {
    const userStatus = contactStatuses.find((status) => status.user_id === user.companion_id);
    const userStatusTime = userStatus?.last_seen || '';
    const status = userStatus?.status === "online";
    
    return {
      user: {
        companion_avatar: user.companion_avatar,
        companion_userName: user.companion_userName,
      },
      status,
      userStatusTime,
    };
  }, [contactStatuses, user.companion_id, user.companion_avatar, user.companion_userName]);

  // Инициализация очистки кеша при загрузке компонента
  useEffect(() => {
    const initializeCache = async () => {
      try {
        await FileService.cleanupCache();
      } catch (error) {
        console.warn("Ошибка инициализации кеша:", error);
      }
    };

    initializeCache();
  }, []);

  // Улучшенный обработчик прокрутки
  const handleScroll = useCallback(
    () => { // Удаляем scrollValues из параметров, так как мы будем получать их через ref
      if (!scrollbarRef.current) return; // Добавляем проверку наличия рефа

      const { scrollTop, scrollHeight, clientHeight } = scrollbarRef.current; // Вызываем getValues() на рефе
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      
      isNearBottomRef.current = isNearBottom;
      setShowScrollButton(!isNearBottom && messages.length > 0);
      
      // Определяем, прокручивает ли пользователь вручную
      const isScrollingUp = scrollTop < lastScrollTop.current;
      const isScrollingDown = scrollTop > lastScrollTop.current;
      
      if (isScrollingUp || (isScrollingDown && !isNearBottom)) {
        setIsUserScrolling(true);
        
        // Сбрасываем флаг после паузы в прокрутке
        if (scrollTimer.current) {
          clearTimeout(scrollTimer.current);
        }
        
        scrollTimer.current = setTimeout(() => {
          setIsUserScrolling(false);
        }, 1000);
      }
      
      lastScrollTop.current = scrollTop;
    },
    [messages.length],
  );

  // Функция для безопасной прокрутки
  const scrollToBottomSafe = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ 
          behavior,
          block: 'end',
          inline: 'nearest'
        });
      } catch {
        // Fallback для старых браузеров
        if (scrollbarRef.current) {
          scrollbarRef.current.scrollToBottom();
        }
      }
    }
  }, []);

  // Стабилизируем обработчики с помощью useCallback
  const handleMessageReceived = useCallback(
    (newMessage: Messages) => {
      
      // debug log removed for production cleanliness
      setMessages((prev) => {
        // --- 1. Основная проверка: Найти сообщение по ID ---
        // Это самый надежный способ, который заменит и текстовые, и файловые "pending" сообщения.
        const existingIndex = prev.findIndex(msg => msg.id === newMessage.id);
        
        if (existingIndex !== -1) {
          const updatedMessages = [...prev];
          updatedMessages[existingIndex] = {
            ...newMessage,
            status: "sent", // Помечаем как полученное сервером
          };
          return updatedMessages;
        }

        // --- 2. Запасной вариант: Найти последнее "ожидающее" сообщение с файлом ---
        // Этот блок сработает, только если сообщение не было найдено по ID (например, если сервер изменил ID).
        if (newMessage.sender_id === user.user_id && newMessage.hasFiles) {
          // Ищем индекс последнего "pending" сообщения с файлами от текущего пользователя.
          // Поиск с конца (lastIndexOf) безопаснее, если было отправлено несколько файлов подряд.
          const lastPendingIndex = prev.map(m => m.status === 'pending' && m.sender_id === user.user_id && m.hasFiles).lastIndexOf(true);
          
          if (lastPendingIndex !== -1) {
            const updatedMessages = [...prev];
            updatedMessages[lastPendingIndex] = {
              ...newMessage,
              status: "sent",
            };
            return updatedMessages;
          }
        }

        // --- 3. Если ничего не найдено для замены, добавляем как новое ---
        return [...prev, { ...newMessage, status: "sent" }];
      });

      // Очищаем прогресс-бар после обновления состояния, если это было наше сообщение с файлом
      if (newMessage.hasFiles && newMessage.sender_id === user.user_id) {
        // Небольшая задержка, чтобы UI успел обновиться
        setTimeout(() => {
          setUploadProgress([]);
          setIsUploading(false);
        }, 500);
      }
    },
    [user.user_id], // Зависимости useCallback остаются прежними
  );

  const handleError = useCallback((error: string) => {
    console.error("Ошибка MessageService:", error);
  }, []);

  // Мемоизируем userData
  const userData = useMemo(
    () => ({
      user_id: user.user_id,
      chat_id: user.chat_id,
      privateKey: privateKey,
    }),
    [user.user_id, user.chat_id, privateKey],
  );

  // Мемоизируем handlers
  const handlers = useMemo(
    () => ({
      onMessageReceived: handleMessageReceived,
      onError: handleError,
    }),
    [handleMessageReceived, handleError],
  );

  const { connectionState, sendMessage, sendMessageWithFiles } = useMessageService(userData, handlers, token!);

  // Мемоизируем connectionState для UserInfo
  const memoizedConnectionState = useMemo(() => connectionState, [connectionState.isConnected, connectionState.isRegistered]);

  // Улучшенный автоскролл
  useEffect(() => {
    if (messages.length === 0) return;

    // Прокручиваем при первой загрузке
    if (isFirstLoad.current) {
      setTimeout(() => {
        scrollToBottomSafe('auto');
        isFirstLoad.current = false;
      }, 100);
      return;
    }

    // Прокручиваем только если пользователь находится внизу и не прокручивает вручную
    if (isNearBottomRef.current && !isUserScrolling) {
      setTimeout(() => {
        scrollToBottomSafe('smooth');
      }, 50);
    }
  }, [messages, scrollToBottomSafe, isUserScrolling]);

  // Обработчик загрузки изображений
  const handleImageLoad = useCallback(() => {
    // Прокручиваем только если пользователь внизу
    if (isNearBottomRef.current && !isUserScrolling) {
      setTimeout(() => {
        scrollToBottomSafe('smooth');
      }, 100);
    }
  }, [scrollToBottomSafe, isUserScrolling]);

  // Загрузка сообщений
  useEffect(() => {
    const fetchMessages = async () => {
      const token = localStorage.getItem("token");
      if (!token || !user.chat_id) {
        if (!hasShownTokenErrorRef.current) {
          showToast({
            variant: "destructive",
            title: "Ошибка",
            description: "Вы не авторизованы",
            icon: "alertCircle",
          });
          hasShownTokenErrorRef.current = true;
          setTimeout(async () => {
            logoutUser();
            navigate("/login");
          }, 1000);
        }
        return;
      }
      
      setMessages([]);
      
      try {
        const response = await getMessages(token, user.chat_id);
        if (response === 401) {
          if (!hasShownTokenErrorRef.current) {
            showToast({
              variant: "destructive",
              title: "Ошибка",
              description: "Вы не авторизованы",
              icon: "alertCircle",
            });
            hasShownTokenErrorRef.current = true;
            setTimeout(async () => {
              logoutUser();
              navigate("/login");
            }, 1000);
          }
          return;
        }
        
        if (Array.isArray(response)) {
          if (privateKey) {
            const decrypted = await decryptedMessagesFromServer(
              response,
              privateKey,
              user.user_id,
            );
            setMessages(decrypted);
          } else {
            setMessages([]);
            console.warn("Нет приватного ключа для расшифровки сообщений");
          }
        }
      } catch (error) {
        console.error("Ошибка при получении сообщений:", error);
        showToast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось загрузить сообщения",
          icon: "alertCircle",
        });
      }
    };
    
    fetchMessages();
  }, [user, privateKey, showToast, navigate]);

  const handleSendMessage = useCallback(
    async (messageText: string) => {
      if (!publicKey || !user.companion_pubKey) {
        console.error("Ключи для шифрования не готовы!");
        return;
      }

      try {
        const companionPublicKey = await importPublicKeyFromSpki(
          user.companion_pubKey,
        );

        const recipients: Recipient[] = [
          { userId: user.user_id, publicKey: publicKey },
          { userId: user.companion_id, publicKey: companionPublicKey },
        ];

        sendMessage(messageText, recipients);
      } catch (error) {
        console.error("Ошибка подготовки ключей для отправки:", error);
      }
    },
    [
      publicKey,
      user.companion_pubKey,
      user.user_id,
      user.companion_id,
      sendMessage,
    ],
  );

  const handleSendFilesAndMessage = useCallback(
    async (message: string, files: File[]) => {
      if (!publicKey || !user.companion_pubKey) {
        console.error("Ключи для шифрования не готовы!");
        return;
      }
      
      try {
        const companionPublicKey = await importPublicKeyFromSpki(
          user.companion_pubKey,
        );
        const recipients: Recipient[] = [
          { userId: user.user_id, publicKey: publicKey },
          { userId: user.companion_id, publicKey: companionPublicKey },
        ];
        
        setIsUploading(true);

        const pendingId = Date.now();
        const pendingMessage: Messages = {
          id: pendingId,
          chat_id: user.chat_id,
          sender_id: user.user_id,
          message: message,
          message_type: "message_with_files",
          created_at: new Date().toISOString(),
          edited_at: null,
          is_read: false,
          hasFiles: true,
          status: "pending",
          metadata: [], // добавлено обязательное поле
        };

        setMessages((prev) => [...prev, pendingMessage]);

        const initialProgress: UploadProgress[] = files.map((file, index) => ({
          fileId: pendingId + index,
          fileName: file.name,
          uploaded: 0,
          total: file.size,
          percentage: 0,
          status: "pending" as const,
        }));

        setUploadProgress(initialProgress);

        sendMessageWithFiles(
          message,
          files,
          recipients,
          (progress) => {
            // Обновляем состояние прогресс-бара
            setUploadProgress(progress);
        
            // Проверяем, завершена ли загрузка всех файлов в этой "пачке"
            const isUploadFinished = progress.length > 0 && progress.every(
              (p) => p.status === "completed" || p.status === "error",
            );
        
            // Если загрузка окончена...
            if (isUploadFinished) {
              // ...НЕМЕДЛЕННО УДАЛЯЕМ скелетон из чата по его ID
              setMessages((prevMessages) =>
                prevMessages.filter((msg) => msg.id !== pendingId)
              );
        
              // Через секунду скрываем сам прогресс-бар внизу экрана
              setTimeout(() => {
                setIsUploading(false);
                setUploadProgress([]);
              }, 1000);
            }
          },
          pendingId,
        );
      } catch (error) {
        console.error("Ошибка подготовки ключей для отправки:", error);
        setIsUploading(false);
      }
    },
    [
      publicKey,
      user.companion_pubKey,
      user.user_id,
      user.companion_id,
      sendMessageWithFiles,
      user.chat_id,
    ],
  );

  // Функция для принудительной прокрутки вниз
  const scrollToBottom = useCallback(() => {
    setIsUserScrolling(false);
    scrollToBottomSafe('smooth');
    setShowScrollButton(false);
  }, [scrollToBottomSafe]);

  // Мемоизируем обработчики для Message компонента
  const messageHandlers = useMemo(() => ({
    onDeleteMessage: () => {
      /* no-op in UI; implement via API when ready */
    },
    onEditMessage: () => {
      /* no-op in UI; implement via API when ready */
    },
  }), []);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (scrollTimer.current) {
        clearTimeout(scrollTimer.current);
      }
    };
  }, []);

  // Показываем лоадер, пока ключи не загружены
  if (isLoadingKeys || !privateKey || !publicKey) {
    return <div>Загрузка ключей...</div>;
  }

  return (
    <div className="h-full w-full flex flex-col">
      <Card
        className={`rounded-3xl border-2 border-white/30 shadow-2xl flex-1 flex flex-col ${currentTheme.card} transition-all duration-500 backdrop-blur-2xl bg-white/30 dark:bg-gray-900/30 hover:shadow-[0_8px_40px_rgba(139,92,246,0.15)] hover:border-purple-400/40 ring-1 ring-white/20 ring-inset before:content-[''] before:absolute before:inset-0 before:rounded-3xl before:pointer-events-none before:shadow-[inset_0_0_40px_0_rgba(255,255,255,0.15)]`}>
        <MemoizedUserInfo
          user={userInfoData.user}
          connectionState={memoizedConnectionState}
          status={userInfoData.status}
          userStatusTime={userInfoData.userStatusTime}
        />
        <hr
          className={`h-1 border-0 ml-6 mr-6 rounded-2xl flex-shrink-0 ${currentTheme.hr}`}
        />
        <div className="flex-1 p-2 overflow-hidden">
          <Scrollbar
            style={{ height: "100%" }}
            noScrollX
            onScroll={handleScroll}
          >
            <MemoizedMessage
              messages={messages}
              currentUserId={user.user_id}
              uploadProgress={uploadProgress}
              onImageLoad={handleImageLoad}
              onDeleteMessage={messageHandlers.onDeleteMessage}
              onEditMessage={messageHandlers.onEditMessage}
            />
            <div ref={messagesEndRef} />
          </Scrollbar>
        </div>
        <MemoizedMessageComposer
          onSendMessage={handleSendMessage}
          onSendFilesAndMessage={handleSendFilesAndMessage}
        />
      </Card>
      <MemoizedFileUploadProgress
        progress={uploadProgress}
        isUploading={isUploading}
      />
      <MemoizedScrollToBottom onClick={scrollToBottom} isVisible={showScrollButton} />
    </div>
  );
};

export default Chat;