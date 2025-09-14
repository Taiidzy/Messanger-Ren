import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useTheme, themes } from "@/components/theme/ThemeProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Scrollbar } from "react-scrollbars-custom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageComposerProps {
  onSendMessage: (message: string) => void;
  onSendFilesAndMessage: (message: string, files: File[]) => void;
}

interface FileItem {
  id: number;
  file: File;
  url?: string;
  type: string;
  name: string;
  size: number;
}

const MAX_FILES = 50;
const MAX_FILE_SIZE = 10000 * 1024 * 1024; // 10000 МБ
const MAX_VISIBLE_FILES = 20; // Максимум видимых файлов одновременно
const IMAGE_PREVIEW_LIMIT = 5; // Максимум превью изображений одновременно

// Мемоизированный компонент файла
const FilePreview = React.memo<{
  file: FileItem;
  onRemove: (id: number) => void;
  getFileIcon: (type: string) => React.ComponentType<{ className?: string }>;
  shouldShowPreview: boolean;
}>(({ file, onRemove, getFileIcon, shouldShowPreview }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Ленивое создание URL для изображений только когда нужно
  useEffect(() => {
    if (
      shouldShowPreview &&
      file.type.startsWith("image/") &&
      !imageUrl &&
      !isLoading
    ) {
      setIsLoading(true);

      // Создаем URL асинхронно
      const createImageUrl = async () => {
        try {
          const url = URL.createObjectURL(file.file);
          setImageUrl(url);
        } catch {
          console.warn("Не удалось создать URL для изображения:", file.name);
        } finally {
          setIsLoading(false);
        }
      };

      createImageUrl();
    }

    // Очистка URL при размонтировании или изменении
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [shouldShowPreview, file.type, file.file, file.name, imageUrl, isLoading]);

  const FileIcon = getFileIcon(file.type);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative flex-shrink-0">
          {shouldShowPreview && imageUrl ? (
            <img
              src={imageUrl}
              className="w-16 h-16 rounded-2xl object-cover"
              alt={file.name}
              loading="lazy"
              onError={() => {
                if (imageUrl) {
                  URL.revokeObjectURL(imageUrl);
                  setImageUrl(null);
                }
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div>
              ) : (
                <FileIcon className="h-8 w-8 text-gray-500" />
              )}
            </div>
          )}
          <Button
            size="icon"
            variant="secondary"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full cursor-pointer z-10"
            onClick={() => onRemove(file.id)}
          >
            <Icons.x className="h-3 w-3" />
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <p className="font-medium">{file.name}</p>
          <p className="text-gray-500">{formatFileSize(file.size)}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

FilePreview.displayName = "FilePreview";

const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onSendFilesAndMessage,
}) => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [visibleRange, setVisibleRange] = useState({
    start: 0,
    end: MAX_VISIBLE_FILES,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false); // Состояние отправки

  // Мемоизированная функция для получения иконки файла
  const getFileIcon = useCallback((fileType: string) => {
    if (fileType.startsWith("image/")) {
      return Icons.fileImage;
    } else if (fileType.startsWith("video/")) {
      return Icons.fileVideo;
    } else if (fileType.startsWith("audio/")) {
      return Icons.fileAudio;
    } else if (
      fileType.includes("pdf") ||
      fileType.includes("document") ||
      fileType.includes("text")
    ) {
      return Icons.fileText;
    } else if (
      fileType.includes("zip") ||
      fileType.includes("rar") ||
      fileType.includes("tar")
    ) {
      return Icons.fileArchive;
    } else {
      return Icons.file;
    }
  }, []);

  // Мемоизированные видимые файлы
  const visibleFiles = useMemo(() => {
    return files.slice(visibleRange.start, visibleRange.end);
  }, [files, visibleRange]);

  // Мемоизированная информация о том, какие файлы должны показывать превью
  const filePreviewInfo = useMemo(() => {
    const imageFiles = visibleFiles.filter((f) => f.type.startsWith("image/"));
    return visibleFiles.map((file) => ({
      ...file,
      shouldShowPreview:
        file.type.startsWith("image/") &&
        imageFiles.indexOf(file) < IMAGE_PREVIEW_LIMIT,
    }));
  }, [visibleFiles]);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files;
      if (!selectedFiles) return;

      const fileArray = Array.from(selectedFiles);
      // Валидация размера файлов
      const oversized = fileArray.find((f) => f.size > MAX_FILE_SIZE);
      if (oversized) {
        alert(`Файл "${oversized.name}" превышает лимит 100 МБ!`);
        return;
      }
      if (files.length + fileArray.length > MAX_FILES) {
        alert(`Максимальное количество файлов: ${MAX_FILES}`);
        return;
      }
      const validFiles: FileItem[] = fileArray.map((file, index) => ({
        id: Date.now() + index + Math.random(),
        file,
        type: file.type,
        name: file.name,
        size: file.size,
      }));
      setFiles((prev) => [...prev, ...validFiles]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [files.length],
  );

  const removeFile = useCallback((fileId: number) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const removeAllFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (isSending) return;
  
    // Проверяем, есть ли что отправлять
    const hasMessage = message.trim().length > 0;
    const hasFiles = files.length > 0;
  
    if (!hasMessage && !hasFiles) {
      return; // Ничего не делаем, если отправлять нечего
    }
  
    setIsSending(true);
    try {
      // Главное условие: если есть файлы, всегда используем onSendFilesAndMessage
      if (hasFiles) {
        await onSendFilesAndMessage(
          message, // Передаем текст сообщения (может быть пустым)
          files.map((f) => f.file),
        );
      } 
      // Если файлов нет, но есть сообщение, используем onSendMessage
      else if (hasMessage) {
        await onSendMessage(message);
      }
  
      // Очищаем поля после успешной отправки
      setMessage("");
      setFiles([]);
  
    } catch (error) { // Добавил error в catch для большей информативности
      console.error("Ошибка при отправке:", error);
      alert("Ошибка при отправке сообщения или файлов!");
    } finally {
      setIsSending(false);
    }
  }, [
    message,
    files,
    onSendMessage,
    onSendFilesAndMessage,
    isSending,
  ]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  // Обработка скролла для виртуализации
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    const itemWidth = 76; // 64px + 12px gap
    const containerWidth = container.clientWidth;

    const startIndex = Math.floor(scrollLeft / itemWidth);
    const visibleCount = Math.ceil(containerWidth / itemWidth) + 2; // +2 для буфера

    const newStart = Math.max(0, startIndex);
    const newEnd = Math.min(
      files.length,
      newStart + Math.max(visibleCount, MAX_VISIBLE_FILES),
    );

    setVisibleRange({ start: newStart, end: newEnd });
  }, [files.length]);

  // Общий размер всех файлов (мемоизированный)
  const totalSize = useMemo(() => {
    return files.reduce((sum, file) => sum + file.size, 0);
  }, [files]);

  const formatTotalSize = (bytes: number) => {
    if (bytes === 0) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="flex-shrink-0 p-2 pt-0">
      <div className="flex flex-col gap-2">
        {files.length > 0 && (
          <div className="flex-shrink-0">
            <Scrollbar
              style={{
                width: "100%",
                height: "80px",
              }}
              noScrollY
              onScroll={handleScroll}
              contentProps={{
                style: {
                  paddingRight: "8px",
                  paddingTop: "8px",
                  paddingBottom: "16px",
                },
              }}
              trackXProps={{
                style: {
                  backgroundColor: "transparent",
                  height: "8px",
                  bottom: 0,
                  left: 2,
                  right: 2,
                },
              }}
              thumbXProps={{
                style: {
                  backgroundColor: theme === "dark" ? "rgba(156, 163, 175, 0.3)" : "rgba(209, 213, 219, 0.3)",
                  borderRadius: "9999px",
                  height: "8px",
                  transition: "background-color 0.2s ease",
                },
              }}
            >
              <div
                ref={scrollContainerRef}
                className="flex items-center gap-3"
                style={{ width: `${files.length * 76}px` }}
              >
                {/* Невидимые элементы для правильного позиционирования */}
                {visibleRange.start > 0 && (
                  <div
                    style={{
                      width: `${visibleRange.start * 76}px`,
                      flexShrink: 0,
                    }}
                  />
                )}

                {filePreviewInfo.map((file) => (
                  <FilePreview
                    key={file.id}
                    file={file}
                    onRemove={removeFile}
                    getFileIcon={getFileIcon}
                    shouldShowPreview={file.shouldShowPreview}
                  />
                ))}

                {/* Placeholder для остальных файлов */}
                {visibleRange.end < files.length && (
                  <div
                    style={{
                      width: `${(files.length - visibleRange.end) * 76}px`,
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            </Scrollbar>

            <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
              <div className="flex items-center gap-2 z-10">
                <span>
                  {files.length >= MAX_FILES
                    ? `Достигнут лимит файлов (${MAX_FILES})`
                    : `Файлов: ${files.length}/${MAX_FILES}`}
                </span>
                {files.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 cursor-pointer"
                    onClick={removeAllFiles}
                  >
                    Удалить все
                  </Button>
                )}
              </div>
              {totalSize > 0 && (
                <div>Общий размер: {formatTotalSize(totalSize)}</div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            className={`pl-9 relative h-12 flex-1 glass`}
            placeholder="Введите сообщение..."
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            aria-label="Текст сообщения"
          />
          <Button
            variant="glass"
            className={`cursor-pointer z-10`}
            onClick={handleSendMessage}
            disabled={(!message.trim() && files.length === 0) || isSending}
            aria-label="Отправить сообщение"
          >
            {isSending ? (
              <span className="animate-spin mr-1">
                <svg
                  className={currentTheme.text + " h-5 w-5"}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
              </span>
            ) : (
              <Icons.send className={`${currentTheme.text} cursor-pointer`} />
            )}
          </Button>
          <Button
            variant="glass"
            className={`cursor-pointer z-10`}
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES}
            aria-label="Прикрепить файл"
          >
            <Icons.filePlus className={`${currentTheme.text}`} />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="*/*"
          />
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;
