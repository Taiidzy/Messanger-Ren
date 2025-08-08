// Предположим, что эти типы и функции импортированы из других модулей
import { decryptFile } from '@/components/utils/crypto';
import { API_URL } from '@/components/utils/const';
import { logoutUser } from "@/components/auth/Logout";

// Тип для метаданных видео
interface FileMetadata {
  chunk_count: number;
  nonces: string[];
  filename: string;
  mimetype: string;
}

// Параметры для нашей новой функции
interface FetchFileParams {
  chatId: number;
  messageId: number;
  fileId: number;
  messageKey: CryptoKey;
  token: string | null;
  signal: AbortSignal; // Используем AbortSignal для отмены запросов
  
  // Функции обратного вызова для обновления состояния в компоненте
  setProgress: (progress: number) => void;
  setError: (error: string) => void;
}

/**
 * Загружает, расшифровывает и создает URL для видеофайла.
 * @returns Promise, который разрешается в URL объекта (Blob URL) или null в случае отмены.
 */
export const fetchAndDecryptFile = async ({
  chatId,
  messageId,
  fileId,
  messageKey,
  token,
  signal,
  setProgress,
}: FetchFileParams): Promise<string | null> => {
  if (!token) {
    throw new Error('Токен аутентификации не найден.');
  }

  // 1. Загрузка метаданных
  const metaRes = await fetch(
    `${API_URL}/chat/file_metadata/${chatId}/${messageId}/${fileId}`,
    { 
      headers: { Authorization: `Bearer ${token}` },
      signal, // Передаем сигнал для возможности отмены
    }
  );
  if (signal.aborted) return null;
  if (!metaRes.ok) throw new Error('Не удалось загрузить метаданные');
  const meta: FileMetadata = await metaRes.json();

  // 2. Загрузка и расшифровка всех чанков
  const buffers: Uint8Array[] = [];
  const totalChunks = meta.chunk_count;

  for (let i = 0; i < totalChunks; i++) {
    // Проверяем, не была ли операция отменена перед каждым запросом
    if (signal.aborted) return null;

    const chunkRes = await fetch(
      `${API_URL}/chat/file_chunk/${chatId}/${messageId}/${fileId}/${i}`,
      { 
        headers: { Authorization: `Bearer ${token}` },
        signal,
      }
    );

    if (chunkRes.status === 401) {
      logoutUser();
      throw new Error(`Ошибка аутентификации при загрузке чанка ${i}`);
    } else if (!chunkRes.ok) {
      throw new Error(`Не удалось загрузить чанк ${i}`);
    }
    
    const { chunk: ciphertextB64 } = await chunkRes.json();
    const file = await decryptFile(
      ciphertextB64,
      meta.nonces[i],
      messageKey,
      meta.filename,
      meta.mimetype
    );
    const arrayBuf = await file.arrayBuffer();
    buffers.push(new Uint8Array(arrayBuf));
    
    // Обновляем прогресс, только если операция не отменена
    if (!signal.aborted) {
      setProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
  }

  if (signal.aborted) return null;

  // 3. Объединение всех буферов в один
  const totalLength = buffers.reduce((sum, arr) => sum + arr.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    merged.set(buf, offset);
    offset += buf.byteLength;
  }

  // 4. Создание Blob и URL объекта
  const blob = new Blob([merged], { type: meta.mimetype });
  const objectUrl = URL.createObjectURL(blob);
  
  return objectUrl; // Возвращаем URL для использования и последующей очистки
};
