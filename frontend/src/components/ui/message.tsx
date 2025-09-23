import React, { useState, useCallback  } from "react";
import { useTheme, themes } from "@/components/theme/ThemeProvider";
import type { Messages, Metadata } from "@/components/models/Messages";
import type { UploadProgress } from "@/components/api/messageService";
import MessageItem from "@/components/ui/message-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2 } from "lucide-react";
import { getDateKey, formatDateHeader, handleDownloadFile } from "@/components/utils/format"
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Интерфейс для пропсов компонента Message
interface MessageProps {
  messages: Messages[]; // Массив сообщений для отображения
  currentUserId?: number; // ID текущего пользователя для определения своих сообщений
  uploadProgress?: UploadProgress[]; // Прогресс загрузки для pending-сообщений
  onImageLoad?: () => void; // Колбэк для уведомления о загрузке изображения
  onDeleteMessage?: (messageId: number, metadata: Metadata[] | undefined) => void; // Колбэк для удаления сообщения
  onEditMessage?: (messageId: number) => void; // Колбэк для редактирования сообщения
  editingMessageId?: number | null;
  editedText?: string;
  onEditedTextChange?: (value: string) => void;
  onSaveEdit?: (messageId: number, newText: string) => void;
  onCancelEdit?: () => void;
}

const Message: React.FC<MessageProps> = ({
  messages,
  currentUserId,
  uploadProgress,
  onImageLoad,
  onDeleteMessage,
  onEditMessage,
  editingMessageId,
  editedText,
  onEditedTextChange,
  onSaveEdit,
  onCancelEdit,
}) => {
  // Получаем текущую тему и её конфигурацию
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [fileUrls, setFileUrls] = useState<Record<number, Record<number, string>>>({}); // { messageId: { fileId: url } }

  // Колбэк для получения URL файла из MessageItem
  const handleFileUrlReady = useCallback((message: Messages, fileId: number, url: string) => {
    setFileUrls(prevUrls => ({
      ...prevUrls,
      [message.id]: {
        ...(prevUrls[message.id] || {}),
        [fileId]: url,
      },
    }));
  }, []);
  
  // Состояние для управления контекстным меню
  const [contextMenu, setContextMenu] = useState<{
    messageId: number;
    isOpen: boolean;
    x: number;
    y: number;
  }>({ messageId: 0, isOpen: false, x: 0, y: 0 });

  // Если нет сообщений, не отображаем ничего
  if (!messages || messages.length === 0) {
    return null;
  }

  // Группируем сообщения по датам (оптимизировано)
  const groupedMessages = messages.reduce<Record<string, Messages[]>>(
    (groups, message) => {
      const dateKey = getDateKey(message.created_at);
      (groups[dateKey] = groups[dateKey] || []).push(message);
      return groups;
    },
    {},
  );

  const hrStyle = theme === "dark" ? "bg-rose-200/60" : "bg-rose-200/60";

  // Функция для определения, нужно ли показывать контекстное меню
  const shouldShowContextMenu = (message: Messages, isCurrentUser: boolean): boolean => {
    const messageType = message.message_type;
    
    // Для собственных сообщений показываем меню всегда
    if (isCurrentUser) return true;
    
    // Для чужих сообщений показываем меню только если это файлы/видео
    return messageType === 'video' || messageType === 'file' || messageType === 'message_with_files';
  };

  // Обработчик правого клика
  const handleContextMenu = (e: React.MouseEvent, messageId: number, isCurrentUser: boolean, message: Messages) => {
    if (!shouldShowContextMenu(message, isCurrentUser)) return;
    
    e.preventDefault();
    setContextMenu({
      messageId,
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Обработчик клика вне меню
  const handleCloseMenu = () => {
    setContextMenu({ messageId: 0, isOpen: false, x: 0, y: 0 });
  };

  // Функция для рендера пунктов меню
  const renderMenuItems = (message: Messages, isCurrentUser: boolean) => {
    const messageType = message.message_type;
    const hasFiles = message.metadata && message.metadata.length > 0;
    const fileIdToDownload = message.metadata?.[0]?.file_id || 0;
    const fileUrl = fileUrls[message.id!]?.[fileIdToDownload];
    
    if (isCurrentUser) {
      // Для собственных сообщений
      switch (messageType) {
        case 'video':
        case 'file':
          return (
            <>
              <DropdownMenuItem
                onClick={() => {
                  if (fileUrl) {
                    handleDownloadFile(message, fileIdToDownload, fileUrl); // Передаем полученный URL
                  } else {
                    // Обработка случая, когда URL еще не готов
                    console.warn(`File URL for message ${message.id}, file ${fileIdToDownload} not yet available.`);
                  }
                  handleCloseMenu();
                }}
                className="flex items-center gap-2 cursor-pointer"
                disabled={!fileUrl} // Отключить, если URL еще не готов
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 17v2a2 2 0 002 2h12a2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Скачать
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onDeleteMessage?.(message.id!, message.metadata);
                  handleCloseMenu();
                }}
                className="flex items-center gap-2 cursor-pointer text-red-600 hover:text-red-700 focus:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </DropdownMenuItem>
            </>
          );
        
        case 'message_with_files':
          return (
            <>
              {hasFiles && (
                <DropdownMenuItem
                  onClick={() => {
                    if (fileUrl) {
                      handleDownloadFile(message, fileIdToDownload, fileUrl); // Передаем полученный URL
                    } else {
                      console.warn(`File URL for message ${message.id}, file ${fileIdToDownload} not yet available.`);
                    }
                    handleCloseMenu();
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                  disabled={!fileUrl}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 17v2a2 2 0 002 2h12a2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Скачать
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  onEditMessage?.(message.id!);
                  handleCloseMenu();
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                Изменить
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onDeleteMessage?.(message.id!, message.metadata);
                  handleCloseMenu();
                }}
                className="flex items-center gap-2 cursor-pointer text-red-600 hover:text-red-700 focus:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </DropdownMenuItem>
            </>
          );
        
        default: // text и другие типы
          return (
            <>
              <DropdownMenuItem
                onClick={() => {
                  onEditMessage?.(message.id!);
                  handleCloseMenu();
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                Изменить
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onDeleteMessage?.(message.id!, message.metadata);
                  handleCloseMenu();
                }}
                className="flex items-center gap-2 cursor-pointer text-red-600 hover:text-red-700 focus:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </DropdownMenuItem>
            </>
          );
      }
    } else {
      // Для чужих сообщений - только скачать
      if (messageType === 'video' || messageType === 'file' || messageType === 'message_with_files') {
        return (
          <DropdownMenuItem
            onClick={() => {
              if (fileUrl) {
                handleDownloadFile(message, fileIdToDownload, fileUrl); // Передаем полученный URL
              } else {
                console.warn(`File URL for message ${message.id}, file ${fileIdToDownload} not yet available.`);
              }
              handleCloseMenu();
            }}
            className="flex items-center gap-2 cursor-pointer"
            disabled={!fileUrl}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 17v2a2 2 0 002 2h12a2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Скачать
          </DropdownMenuItem>
        );
      }
    }
    
    return null;
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Итерация по группам сообщений по датам */}
      {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
        <div key={dateKey} className="w-full">
          {/* Заголовок с датой */}
            <div className="flex items-center justify-center my-4">
            <div
              className={`px-4 py-1 rounded-full text-sm font-medium ${currentTheme.timeText} glass`}
            >
              {formatDateHeader(dateMessages[0].created_at)}
            </div>
          </div>
          {/* Горизонтальная линия */}
          <hr
            className={`h-1 border-0 ml-6 mr-6 my-6 rounded-2xl flex-shrink-0 ${hrStyle}`}
          />
          {/* Сообщения для этой даты */}
          <div className="flex flex-col gap-2">
            {dateMessages.map((message) => {
              // Передаём uploadProgress только для pending-сообщений текущего пользователя
              const shouldShowProgress =
                message.status === "pending" &&
                message.sender_id === currentUserId &&
                uploadProgress &&
                uploadProgress.length > 0;
              
              // Проверяем, принадлежит ли сообщение текущему пользователю
              const isCurrentUser = message.sender_id === currentUserId;
              
              return (
                <div 
                  key={message.id} 
                  className={`relative w-fit max-w-[80%] ${isCurrentUser ? 'ml-auto' : 'mr-auto'} animate-fade-in`}
                >
                  {editingMessageId === message.id ? (
                    <div className="max-w-[320px] min-w-[130px] w-full px-4 py-2 flex flex-col gap-2 rounded-2xl shadow-md border border-white/20 backdrop-blur-xl bg-white/50 dark:bg-gray-900/50">
                      <Input
                        autoFocus
                        value={editedText ?? ""}
                        onChange={(e) => onEditedTextChange && onEditedTextChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && onSaveEdit) onSaveEdit(message.id!, editedText ?? "");
                          if (e.key === 'Escape' && onCancelEdit) onCancelEdit();
                        }}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => onCancelEdit && onCancelEdit()}
                        >
                          Отмена
                        </Button>
                        <Button
                          onClick={() => onSaveEdit && onSaveEdit(message.id!, editedText ?? "")}
                        >
                          Сохранить
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onContextMenu={(e) => handleContextMenu(e, message.id!, isCurrentUser, message)}
                      className="cursor-pointer"
                    >
                      <MessageItem
                        message={message}
                        currentUserId={currentUserId}
                        envelopes={message.envelopes}
                        uploadProgress={
                          shouldShowProgress ? uploadProgress : undefined
                        }
                        onImageLoad={onImageLoad}
                        onFileUrlReady={handleFileUrlReady}
                      />
                    </div>
                  )}
                  
                  {/* Контекстное меню */}
                  {contextMenu.isOpen && contextMenu.messageId === message.id && (
                    <DropdownMenu 
                      open={contextMenu.isOpen} 
                      onOpenChange={handleCloseMenu}
                    >
                      <DropdownMenuTrigger asChild>
                        <div className="absolute top-2 right-2 z-50" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="end" 
                        className="w-48 z-50"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                        side="bottom"
                        sideOffset={4}
                      >
                        {renderMenuItems(message, isCurrentUser)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Message;