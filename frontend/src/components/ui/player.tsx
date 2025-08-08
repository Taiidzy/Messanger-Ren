import React, { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { fetchAndDecryptFile } from "@/components/api/chunkService";

interface VideoStreamProps {
  chatId: number;
  messageId: number;
  fileId: number;
  messageKey: CryptoKey;
}

const Player: React.FC<VideoStreamProps> = ({ chatId, messageId, fileId, messageKey }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Создаем AbortController для управления отменой
    const controller = new AbortController();
    const signal = controller.signal;
    
    let objectUrl: string | null = null;

    const runFetch = async () => {
      try {
        setLoading(true);
        setError(null);
        setProgress(0);
        
        const token = localStorage.getItem('token');
        
        // Вызываем нашу утилитарную функцию
        objectUrl = await fetchAndDecryptFile({
          chatId,
          messageId,
          fileId,
          messageKey,
          token,
          signal,
          setProgress,
          setError
        });

        // Если функция не была отменена, устанавливаем URL
        if (objectUrl && !signal.aborted) {
          setVideoUrl(objectUrl);
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
    };

    runFetch();

    // Функция очистки, которая будет вызвана при размонтировании компонента
    return () => {
      // Отменяем все запущенные fetch запросы
      controller.abort();
      
      // Освобождаем память, удаляя созданный URL объекта
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [chatId, messageId, fileId, messageKey]);

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
          className="w-full flex flex-col items-center"
        >
          {/* ИЗМЕНЕНО: Скелетон теперь всегда квадратный и занимает всю ширину */}
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
  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }
  return (
    // ИЗМЕНЕНО: Упрощен контейнер. Он будет занимать всю ширину "капли" сообщения.
    <div className="w-full rounded-2xl border border-white/20 shadow-md backdrop-blur-xl bg-black/20 overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        src={videoUrl!} // Уверенность, что url не null, так как loading=false
        controls
        // ИЗМЕНЕНО: Стили для корректного отображения и вписывания в контейнер
        className="w-full h-full object-contain bg-black/70 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
      />
    </div>
  );
};

export default Player;