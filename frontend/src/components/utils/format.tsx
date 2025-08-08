import { Icons } from "@/components/ui/icons";
import type { Messages } from "@/components/models/Messages";

export const getInitials = (userName: string | null = "") => {
  if (!userName) return "??";
  return userName.slice(0, 2).toUpperCase();
};

export const getDateKey = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return "Сегодня";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Вчера";
    } else {
      return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  } catch {
    return dateString;
  }
};

export const getUserStatusTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Форматируем время в формате HH:MM
    const timeString = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    if (date.toDateString() === now.toDateString()) {
      return `Сегодня в ${timeString}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Вчера в ${timeString}`;
    } else {
      const dateFormatted = date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return `${dateFormatted} в ${timeString}`;
    }
  } catch {
    return dateString;
  }
}

export const formatTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24 && date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Вчера ${date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const getFileIcon = (mimetype: string, filename: string) => {
  // Проверяем по mimetype сначала
  if (mimetype.startsWith("text/") || mimetype === "application/pdf") {
    return <Icons.fileText className="w-4 h-4" />;
  }
  if (mimetype.startsWith("image/")) {
    return <Icons.fileImage className="w-4 h-4" />;
  }
  if (mimetype.startsWith("video/")) {
    return <Icons.fileVideo className="w-4 h-4" />;
  }
  if (mimetype.startsWith("audio/")) {
    return <Icons.fileAudio className="w-4 h-4" />;
  }

  // Затем по расширению файла
  if (filename.match(/\.(txt|md|doc|docx|pdf|rtf)$/i)) {
    return <Icons.fileText className="w-4 h-4" />;
  }
  if (filename.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
    return <Icons.fileImage className="w-4 h-4" />;
  }
  if (filename.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i)) {
    return <Icons.fileVideo className="w-4 h-4" />;
  }
  if (filename.match(/\.(mp3|wav|flac|aac|ogg|wma)$/i)) {
    return <Icons.fileAudio className="w-4 h-4" />;
  }
  if (filename.match(/\.(zip|rar|7z|tar|gz|bz2)$/i) || 
      mimetype === "application/x-compressed" || 
      mimetype === "application/zip") {
    return <Icons.fileArchive className="w-4 h-4" />;
  }

  return <Icons.file className="w-4 h-4" />;
};

// Функция для форматирования даты для заголовка
export const formatDateHeader = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();

    // Если сообщение сегодня
    if (date.toDateString() === now.toDateString()) {
      return "Сегодня";
    }

    // Если сообщение вчера
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Вчера";
    }

    // Если сообщение старше, показываем полную дату
    return date.toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

// Функция для скачивания файла (видео или картинки)
export const handleDownloadFile = async (message: Messages, fileId: number, url: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = message.metadata?.find(meta => meta.file_id === fileId)?.filename || `file_${fileId}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};