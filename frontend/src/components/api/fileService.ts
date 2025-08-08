import type { FileInfo, DecryptedFile } from "@/components/models/Messages";
import { decryptFile } from "@/components/utils/crypto";
import {
  cacheFile,
  getCachedFile,
  isFileCached,
  cleanupOldCachedFiles,
  clearAllCachedFiles,
} from "@/components/utils/indexedDBUtils";
import { API_URL } from "@/components/utils/const";

const API_BASE_URL = API_URL;

export interface FileChunk {
  chunk: string; // base64
  nonce: string; // base64
  index: number;
}

export class FileService {
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Получает список файлов для сообщения
   */
  static async getMessageFiles(
    chatId: number,
    messageId: number,
  ): Promise<FileInfo[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/chat/${chatId}/messages/${messageId}/files`,
        {
          method: "GET",
          headers,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `FileService: ошибка HTTP ${response.status}: ${errorText}`,
        );
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const files: FileInfo[] = await response.json();
      return files;
    } catch (error) {
      console.error("Ошибка получения файлов сообщения:", error);
      throw error;
    }
  }

  /**
   * Получает зашифрованное содержимое файла (или чанки)
   */
  static async getFileContent(filePath: string): Promise<string> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/chat/file/${encodeURIComponent(filePath)}`,
        {
          method: "GET",
          headers,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return data.encrypted_data;
    } catch (error) {
      console.error("Ошибка получения содержимого файла:", error);
      throw error;
    }
  }

  /**
   * Расшифровывает файл и создает blob URL с кешированием
   */
  static async decryptFile(
    fileInfo: FileInfo,
    messageKey: CryptoKey,
    chatId: number,
  ): Promise<DecryptedFile> {

    try {
      // Сначала проверяем кеш
      const isCached = await isFileCached(
        chatId,
        fileInfo.message_id,
        fileInfo.filename,
      );


      if (isCached) {
        const cachedFile = await getCachedFile(
          chatId,
          fileInfo.message_id,
          fileInfo.filename,
        );
        
        if (cachedFile) {
          
          const url = URL.createObjectURL(cachedFile.data);
          
          return {
            url,
            filename: cachedFile.meta.filename,
            mimetype: cachedFile.meta.mimetype,
            size: cachedFile.meta.size,
            file_id: fileInfo.file_id,
          };
        } else {
          console.warn("Файл помечен как кешированный, но не найден в кеше");
        }
      }

      // Если файл не в кеше, загружаем с сервера

      const metadata = fileInfo.metadata;
      const meta = Array.isArray(metadata) ? metadata[0] : metadata;
      
      if (!meta || !meta.chunk_count) {
        // Попробуем получить с сервера
        const fileContent = await this.getFileContent(fileInfo.file_path);

        const decryptedFile = await decryptFile(
          fileContent,
          fileInfo.nonce,
          messageKey,
          fileInfo.filename,
          fileInfo.mimetype,
        );

        try {
          await cacheFile(
            chatId,
            fileInfo.message_id,
            fileInfo.filename,
            fileInfo.mimetype,
            fileInfo.size,
            decryptedFile,
          );
        } catch (cacheError) {
          console.error("Ошибка сохранения обычного файла в кеш:", cacheError);
        }

        const url = URL.createObjectURL(decryptedFile);

        const result = {
          url,
          filename: fileInfo.filename,
          mimetype: fileInfo.mimetype,
          size: fileInfo.size,
          file_id: fileInfo.file_id,
        };

        return result;
      } else {

        try {

          const token = localStorage.getItem('token');
          const metaRes = await fetch(
            `${API_URL}/chat/file_metadata/${chatId}/${fileInfo.message_id}/${fileInfo.file_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (!metaRes.ok) {
            const errorText = await metaRes.text();
            console.error(`FileService: ошибка HTTP ${metaRes.status}: ${errorText}`);
            throw new Error(`HTTP error! status: ${metaRes.status}`);
          }

          const meta = await metaRes.json();

          const buffers: Uint8Array[] = [];
          for (let i = 0; i < meta.chunk_count; i++) {
            const chunkRes = await fetch(
              `${API_URL}/chat/file_chunk/${chatId}/${fileInfo.message_id}/${fileInfo.file_id}/${i}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!chunkRes.ok) throw new Error(`Failed to fetch chunk ${i}`);
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
          }

          const totalLength = buffers.reduce((sum, arr) => sum + arr.byteLength, 0);
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const buf of buffers) {
            merged.set(buf, offset);
            offset += buf.byteLength;
          }
          
          const file = new File([merged], meta.filename, {
            type: meta.mimetype,
            lastModified: Date.now(),
          });
          const blob = new Blob([merged], { type: meta.mimetype });
          const objectUrl = URL.createObjectURL(blob);

          try {
            await cacheFile(
              chatId,
              fileInfo.message_id,
              fileInfo.filename,
              fileInfo.mimetype,
              fileInfo.size,
              file,
            );
          } catch (cacheError) {
            console.warn("Ошибка сохранения обычного файла в кеш:", cacheError);
          }

          return {
            url: objectUrl,
            filename: meta.filename,
            mimetype: meta.mimetype,
            size: meta.size,
            file_id: fileInfo.file_id
          }
        } catch (error) {
          console.error("Ошибка расшифровки файла:", {
            error: error instanceof Error ? error : new Error(String(error)),
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : "Unknown error stack",
            fileInfo: {
              filename: fileInfo.filename,
              file_id: fileInfo.file_id,
              message_id: fileInfo.message_id,
              mimetype: fileInfo.mimetype,
              size: fileInfo.size
            }
          });
          throw error;
        }
      }
    } catch (error) {
      console.error("Ошибка расшифровки файла:", {
        error: error instanceof Error ? error : new Error(String(error)),
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "Unknown error stack",
        fileInfo: {
          filename: fileInfo.filename,
          file_id: fileInfo.file_id,
          message_id: fileInfo.message_id,
          mimetype: fileInfo.mimetype,
          size: fileInfo.size
        }
      });
      throw error;
    }
  }

  /**
   * Получает и расшифровывает все файлы сообщения с кешированием
   */
  static async getDecryptedFiles(
    chatId: number,
    messageId: number,
    messageKey: CryptoKey,
  ): Promise<DecryptedFile[]> {
    try {
      // Получаем список файлов
      const files = await this.getMessageFiles(chatId, messageId);

      // Расшифровываем каждый файл
      const decryptedFiles: DecryptedFile[] = [];

      for (const fileInfo of files) {
        try {
          const decryptedFile = await this.decryptFile(
            fileInfo,
            messageKey,
            chatId,
          );
          decryptedFiles.push(decryptedFile);
        } catch (error) {
          console.error(
            `Ошибка расшифровки файла ${fileInfo.filename}:`,
            error,
          );
          // Продолжаем с другими файлами
        }
      }

      return decryptedFiles;
    } catch (error) {
      console.error("Ошибка получения расшифрованных файлов:", error);
      throw error;
    }
  }

  /**
   * Освобождает blob URL
   */
  static revokeFileUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  /**
   * Освобождает все blob URL для файлов
   */
  static revokeFileUrls(files: DecryptedFile[]): void {
    files.forEach((file) => {
      URL.revokeObjectURL(file.url);
    });
  }

  /**
   * Очищает старые файлы из кеша
   */
  static async cleanupCache(maxAgeMs?: number): Promise<void> {
    try {
      await cleanupOldCachedFiles(maxAgeMs);
    } catch (error) {
      console.error("Ошибка очистки кеша:", error);
    }
  }

  /**
   * Полностью очищает весь кеш файлов
   */
  static async clearAllCache(): Promise<void> {
    try {
      await clearAllCachedFiles();
    } catch (error) {
      console.error("Ошибка полной очистки кеша:", error);
    }
  }

  /**
   * Получает размер кеша файлов
   */
  static async getCacheSize(): Promise<number> {
    try {
      const { getCacheSize } = await import(
        "@/components/utils/indexedDBUtils"
      );
      return await getCacheSize();
    } catch (error) {
      console.error("Ошибка получения размера кеша:", error);
      return 0;
    }
  }
}

