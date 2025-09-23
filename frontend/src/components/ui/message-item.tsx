import React, { useState, useEffect, useCallback } from "react";
import { useTheme, themes } from "@/components/theme/ThemeProvider";
import type { Messages, DecryptedFile } from "@/components/models/Messages";
import type { UploadProgress } from "@/components/api/messageService";
import { FileService } from "@/components/api/fileService";
import { unwrapSymmetricKey, decryptFile as decryptFileDirect } from "@/components/utils/crypto";
import { useCrypto } from "@/components/context/CryptoContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatTime, formatFileSize, getFileIcon, formatTimeHHMM } from "@/components/utils/format";
import Player from "@/components/ui/player";
import { fetchAndDecryptFile } from "@/components/api/chunkService";
import { motion } from "framer-motion";

interface MessageItemProps {
  message: Messages;
  currentUserId?: number;
  envelopes?: {
    [userId: string]: { key: string; ephemPubKey: string; iv: string };
  };
  uploadProgress?: UploadProgress[];
  onImageLoad?: () => void;
  onFileUrlReady?: (message: Messages, fileId: number, fileUrl: string) => void;
}


const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUserId,
  envelopes,
  uploadProgress,
  onImageLoad,
  onFileUrlReady
}) => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const { privateKey } = useCrypto();

  const [files, setFiles] = useState<DecryptedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [videoMessageKey, setVideoMessageKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  const isMyMessage = message.sender_id === currentUserId;

  // Проверяем, есть ли файлы в сообщении
  const hasMessageFiles = useCallback(() => {
    return (
      message.hasFiles ||
      (Array.isArray(message.metadata) && message.metadata.length > 0) ||
      message.message_type === "video" ||
      message.message_type === "image" ||
      message.message_type === "message_with_files"
    );
  }, [message.hasFiles, message.metadata, message.message_type]);

  // Получаем envelope для текущего пользователя
  const getUserEnvelope = useCallback(() => {
    if (!envelopes || !currentUserId) return null;

    const userIdStr = currentUserId.toString();
    const userIdNum = currentUserId;
    
    if (Array.isArray(envelopes)) {
      return envelopes[userIdNum] || envelopes[userIdStr];
    } else {
      return envelopes[userIdStr] || envelopes[userIdNum];
    }
  }, [envelopes, currentUserId]);

  // Загружаем и расшифровываем файлы
  const loadFiles = useCallback(async () => {
    const decFiles = [] as DecryptedFile[];
    if (!message.id || !message.chat_id || !privateKey) {
      console.warn("loadFiles: missing required data");
      return;
    }

    const envelope = getUserEnvelope();
    if (!envelope) {
      console.warn("loadFiles: envelope not found for current user");
      return;
    }

    setFileError(null);

    try {
      // Разворачиваем ключ сообщения
      const messageKey = await unwrapSymmetricKey(
        envelope.key,
        envelope.ephemPubKey,
        envelope.iv,
        privateKey,
      );

      // Для видео-сообщений не загружаем файлы через FileService
      if (message.message_type === "video") {
        setFiles([]);
        setVideoMessageKey(messageKey);
        return;
      }

      const metas = Array.isArray(message.metadata) ? message.metadata : [];

      // Обрабатываем все файлы из метаданных
      for (const meta of metas) {
        const isChunked = typeof meta.chunk_count === 'number' && meta.chunk_count > 1;

        if (isChunked) {
          const chatId = message.chat_id;
          const messageId = message.id;
          const fileId = meta.file_id!;
          const token = localStorage.getItem('token');
          const controller = new AbortController();
          const signal = controller.signal;

          try {
            setLoading(true);
            setError(null);
            setProgress(0);

            const objectUrl = await fetchAndDecryptFile({
              chatId,
              messageId,
              fileId,
              messageKey,
              token,
              signal,
              setProgress,
              setError
            });

            if (objectUrl) {
              decFiles.push({
                url: objectUrl,
                filename: meta.filename,
                mimetype: meta.mimetype,
                size: meta.size,
                file_id: meta.file_id,
              });

              if (onFileUrlReady) {
                onFileUrlReady(message, meta.file_id!, objectUrl);
              }
            }
          } catch (e) {
            if (!signal.aborted) {
              setError((e as Error).message);
            }
          } finally {
            if (!signal.aborted) {
              setLoading(false);
            }
          }
        } else if (meta.encFile && meta.nonce) {
          // Небольшой файл: расшифровываем напрямую из метаданных
          try {
            setLoading(true);
            setError(null);
            setProgress(10);
            const file = await decryptFileDirect(
              meta.encFile,
              meta.nonce,
              messageKey,
              meta.filename,
              meta.mimetype
            );
            const url = URL.createObjectURL(file);

            decFiles.push({
              url,
              filename: meta.filename,
              mimetype: meta.mimetype,
              size: meta.size,
              file_id: meta.file_id,
            });

            if (onFileUrlReady) {
              onFileUrlReady(message, meta.file_id!, url);
            }
            setProgress(100);
          } catch (e) {
            console.error("Ошибка расшифровки небольшого файла:", e);
          } finally {
            setLoading(false);
          }
        } else {
          // Фоллбек: если данных недостаточно, можно попробовать FileService (серверные файлы без чанков)
          try {
            setLoading(true);
            setError(null);
            setProgress(0);
            const decryptedFiles = await FileService.getDecryptedFiles(
              message.chat_id,
              message.id,
              messageKey,
            );
            decFiles.push(...decryptedFiles);
            setProgress(100);
          } catch (e) {
            console.warn("Не удалось получить файлы через FileService как фоллбек", e);
          } finally {
            setLoading(false);
          }
        }
      }

      setFiles(decFiles);

    } catch (error) {
      console.error("Ошибка загрузки файлов:", error);
      setFileError("Ошибка загрузки файлов");
    }
  }, [message, privateKey, getUserEnvelope, onFileUrlReady]);

  // Загружаем файлы при изменении зависимостей
  useEffect(() => {
    const shouldLoadFiles = hasMessageFiles() &&
      message.id &&
      message.chat_id &&
      privateKey &&
      envelopes;

    if (shouldLoadFiles) {
      loadFiles();
    }
  }, [
    message.id, 
    message.chat_id, 
    message.message_type, 
    message.hasFiles, 
    message.metadata, 
    privateKey, 
    envelopes, 
    message.status, 
    hasMessageFiles, 
    loadFiles
  ]);

  // Очищаем blob URL при размонтировании
  useEffect(() => {
    return () => {
      if (files.length > 0) {
        FileService.revokeFileUrls(files);
      }
    };
  }, [files]);

  // Обработчик загрузки изображения
  const handleImageLoad = useCallback(() => {
    if (onImageLoad) {
      setTimeout(() => {
        onImageLoad();
      }, 10);
    }
  }, [onImageLoad]);

  // Рендерим файл в pending состоянии
  const renderPendingFile = (progress: UploadProgress) => {
    const isImage = progress.fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);

    return (
      <div
        key={progress.fileId}
        className="flex items-center gap-3 p-2 rounded-xl bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20 animate-pulse-glass"
      >
        {isImage ? (
          <div className="relative w-16 h-16 flex-shrink-0">
            <Skeleton className="h-16 w-16 rounded-xl animate-shimmer-glass" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-gray-500">
                {progress.percentage < 100 ? "Загрузка..." : "Готово"}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 flex items-center justify-center">
            {getFileIcon("", progress.fileName)}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate text-gray-700 dark:text-gray-200">
            {progress.fileName}
          </div>
          <div className="text-xs text-gray-500">
            {progress.percentage}%
          </div>
          
          {progress.status === "uploading" && (
            <Progress value={progress.percentage} className="h-1 mt-1" />
          )}
          {progress.status === "completed" && (
            <div className="h-1 w-full bg-green-200 dark:bg-green-800 rounded-full mt-1">
              <div className="h-1 bg-green-500 rounded-full w-full" />
            </div>
          )}
          {progress.status === "error" && (
            <div className="h-1 w-full bg-red-200 dark:bg-red-800 rounded-full mt-1">
              <div className="h-1 bg-red-500 rounded-full w-full" />
            </div>
          )}
          {progress.error && (
            <p className="text-xs text-red-500 mt-1">{progress.error}</p>
          )}
        </div>
      </div>
    );
  };

  // Рендерим видео компонент
  const renderVideoPlayer = () => {
    if (!videoMessageKey) return null;

    let fileId = 0;
    if (message.metadata && Array.isArray(message.metadata) && message.metadata.length > 0) {
      const videoMeta = message.metadata[0];
      fileId = videoMeta.file_id || 0;
    } else {
      console.warn("MessageItem: no valid metadata found for video message");
    }

    return (
      <div className="w-full flex items-center justify-center">
        <Player
          chatId={message.chat_id}
          messageId={message.id!}
          fileId={fileId}
          messageKey={videoMessageKey}
        />
      </div>
    );
  };

  // Рендерим обычный файл
  const renderFile = (file: DecryptedFile, idx: number) => {
    // Изображения
    if (file.mimetype.startsWith("image/")) {
      return (
        <img
          key={idx}
          src={file.url}
          alt={file.filename}
          className="max-w-xs max-h-60 rounded-lg"
          onLoad={handleImageLoad}
          onError={() => {
            console.error(`Ошибка загрузки изображения: ${file.filename}`);
            handleImageLoad();
          }}
        />
      );
    }

    // Видео файлы
    if (file.mimetype.startsWith("video/")) {
      return (
        <Player
          key={idx}
          chatId={message.chat_id}
          messageId={message.id!}
          fileId={file.file_id!}
          messageKey={videoMessageKey!}
        />
      );
    }

    // Остальные файлы
    return (
      <div
        key={idx}
        className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
      >
        <span className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
          {getFileIcon(file.mimetype, file.filename)}
        </span>
        <div className="flex flex-col">
          <span
            className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate"
          >
            {file.filename}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatFileSize(file.size)}
          </span>
        </div>
      </div>
    );
  };

  const renderFileWithLoadingState = (file: DecryptedFile, idx: number) => {
    // Для файлов с chunk_count > 1 показываем скелетон во время загрузки
    const isChunkedFile = message.metadata && message.metadata[0] && message.metadata[0].chunk_count! > 1;
    
    if (isChunkedFile && loading) {
      return (
        <div key={idx} className="w-full flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="w-full flex flex-col items-center"
          >
            {/* Скелетон квадратный и занимает всю ширину */}
            <div className="w-full aspect-square rounded-2xl overflow-hidden">
              <Skeleton className="w-full h-full bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20 shadow-md animate-shimmer-glass" />
            </div>
            <div className="mt-4 w-2/3">
              <div className="w-full h-2 bg-white/30 dark:bg-gray-900/30 rounded-full overflow-hidden">
                <div className="h-2 bg-purple-400/60 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </motion.div>
        </div>
      );
    }
  
    if (isChunkedFile && error) {
      return (
        <div key={idx} className="w-full flex flex-col items-center">
          <div className="text-red-500 p-4 text-center">
            <p>Ошибка загрузки файла</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      );
    }
  
    // Если файл загружен или это не chunked файл, рендерим обычно
    return renderFile(file, idx);
  };

  // Skeleton для pending-сообщения
  if (message.status === "pending") {
    return (
      <div className={`flex w-full ${isMyMessage ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[70%] min-w-[100px] px-4 py-2 flex flex-col rounded-2xl shadow-xl border border-white/30 backdrop-blur-xl bg-white/30 dark:bg-gray-900/30 animate-pulse-glass ${
            isMyMessage
              ? `${currentTheme.messageBackgroundMe} ml-auto`
              : `${currentTheme.messageBackgroundYou} mr-auto`
          }`}
        >
          <div className="flex flex-col gap-1">
            {/* Текст сообщения */}
            {message.message && message.message.trim() !== "" && (
              <div className={`text-left text-base break-words leading-relaxed ${currentTheme.messageText}`}>
                {message.message}
              </div>
            )}

            {/* Файлы в pending состоянии */}
            {hasMessageFiles() && uploadProgress && (
              <div className="flex flex-col gap-2 mt-2">
                {uploadProgress.map(renderPendingFile)}
              </div>
            )}

            {/* Fallback skeleton */}
            {hasMessageFiles() && !uploadProgress && (
              <div className="flex flex-col gap-2 mt-2">
                <Skeleton className="h-32 w-48 rounded-xl animate-shimmer-glass" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Проверяем наличие контента
  const hasContent = (message.message && message.message.trim() !== "") || hasMessageFiles();
  
  if (!hasContent) {
    console.warn("MessageItem: no content to display");
    return null;
  }

  // Основной рендер сообщения
  return (
    <div className={`flex w-full ${isMyMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[320px] min-w-[130px] w-full px-4 py-2 flex flex-col rounded-2xl shadow-md border border-white/20 backdrop-blur-xl bg-white/50 dark:bg-gray-900/50 hover:shadow-lg hover:border-purple-300/30 transition-all duration-300 animate-fade-in relative ${
          isMyMessage
            ? `${currentTheme.messageBackgroundMe} ml-auto`
            : `${currentTheme.messageBackgroundYou} mr-auto`
        }`}
      >
        <div className="flex flex-col gap-1">
          {/* Текст сообщения */}
          {message.message && message.message.trim() !== "" && (
            <div className={`text-left text-base break-words leading-relaxed ${currentTheme.messageText}`}>
              {message.message}
            </div>
          )}

          {/* Ошибка загрузки файлов */}
          {hasMessageFiles() && fileError && (
            <div className="mt-2 text-sm text-red-500">{fileError}</div>
          )}

          {/* Видео сообщения */}
          {message.message_type === "video" && (
            <div className="flex flex-col gap-2 mt-2">
              {renderVideoPlayer()}
            </div>
          )}

          {/* Единый прогресс загрузки/расшифровки файлов */}
          {hasMessageFiles() && loading && (
            <div className="flex flex-col items-center gap-3 mt-2">
              <div className="w-full aspect-square rounded-2xl overflow-hidden">
                <Skeleton className="w-full h-full bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20 shadow-md animate-shimmer-glass" />
              </div>
              <div className="mt-2 w-2/3">
                <div className="w-full h-2 bg-white/30 dark:bg-gray-900/30 rounded-full overflow-hidden">
                  <div className="h-2 bg-purple-400/60 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Обычные файлы */}
          {files.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {files.map((file, idx) => renderFileWithLoadingState(file, idx))}
            </div>
          )}
        </div>

        {/* Время сообщения и пометка об изменении */}
        <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} mt-1`}>
          <div className="flex flex-col text-left">
            <span className={`text-xs whitespace-nowrap ${currentTheme.timeText}`}>
              {formatTime(message.created_at)}
            </span>
            {message.edited_at && (
              <span className={`text-[10px] opacity-80 ${currentTheme.timeText}`}>
                изменено в {formatTimeHHMM(message.edited_at)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;