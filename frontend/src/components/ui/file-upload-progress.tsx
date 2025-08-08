import React, { useState, useEffect } from "react";
import type { UploadProgress } from "@/components/api/messageService";

interface FileUploadProgressProps {
  progress: UploadProgress[];
  isUploading: boolean;
}

const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  progress,
  isUploading,
}) => {
  const [visible, setVisible] = useState(true);

  // Автоматически скрывать окно после завершения всех загрузок (если нет ошибок)
  useEffect(() => {
    if (
      isUploading === false &&
      progress.length > 0 &&
      progress.every((p) => p.status === "completed")
    ) {
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
    // Показывать снова, если началась новая загрузка
    if (isUploading) setVisible(true);
  }, [isUploading, progress]);

  if (!isUploading || progress.length === 0 || !visible) {
    return null;
  }

  
};

export default FileUploadProgress;
