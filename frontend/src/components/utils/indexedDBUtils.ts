const DB_NAME = "Messenger-Ren-Keys-DB";
const DB_VERSION = 1;
const STORE_NAME = "cryptoKeys";

// База данных для кеширования файлов
const FILES_DB_NAME = "Messenger-Ren-Files-DB";
const FILES_DB_VERSION = 1;
const FILES_STORE_NAME = "files";
const FILES_META_STORE_NAME = "filesMeta";

interface StoredKey {
  id: string;
  key: CryptoKey;
}

interface CachedFile {
  id: string;
  data: Blob;
  timestamp: number;
}

interface FileMeta {
  id: string;
  chatId: number;
  messageId: number;
  filename: string;
  mimetype: string;
  size: number;
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject("IndexedDB error: " + (event.target as IDBOpenDBRequest).error);
    };
  });
};

// Функция для открытия базы данных файлов
const openFilesDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILES_DB_NAME, FILES_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Создаем хранилище для файлов
      if (!db.objectStoreNames.contains(FILES_STORE_NAME)) {
        db.createObjectStore(FILES_STORE_NAME, { keyPath: "id" });
      }

      // Создаем хранилище для метаданных файлов
      if (!db.objectStoreNames.contains(FILES_META_STORE_NAME)) {
        const metaStore = db.createObjectStore(FILES_META_STORE_NAME, {
          keyPath: "id",
        });
        metaStore.createIndex("chatMessage", ["chatId", "messageId"], {
          unique: false,
        });
        metaStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject(
        "Files IndexedDB error: " + (event.target as IDBOpenDBRequest).error,
      );
    };
  });
};

export const saveCryptoKeyToIndexedDB = async (
  id: string,
  key: CryptoKey,
): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id, key });

    request.onsuccess = () => resolve();
    request.onerror = (event) =>
      reject(
        "Failed to save key to IndexedDB: " +
          (event.target as IDBRequest).error,
      );
  });
};

export const loadCryptoKeyFromIndexedDB = async (
  id: string,
): Promise<CryptoKey | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result as StoredKey;
      resolve(result ? result.key : null);
    };
    request.onerror = (event) =>
      reject(
        "Failed to load key from IndexedDB: " +
          (event.target as IDBRequest).error,
      );
  });
};

export const deleteCryptoKeyFromIndexedDB = async (
  id: string,
): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (event) =>
      reject(
        "Failed to delete key from IndexedDB: " +
          (event.target as IDBRequest).error,
      );
  });
};

// Функции для кеширования файлов

/**
 * Сохраняет файл в кеш
 */
export const cacheFile = async (
  chatId: number,
  messageId: number,
  filename: string,
  mimetype: string,
  size: number,
  data: Blob,
): Promise<void> => {
  const db = await openFilesDB();
  const fileId = `${chatId}_${messageId}_${filename}`;
  const timestamp = Date.now();

  // silent in production

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [FILES_STORE_NAME, FILES_META_STORE_NAME],
      "readwrite",
    );

    // Сохраняем файл
    const filesStore = transaction.objectStore(FILES_STORE_NAME);
    filesStore.put({
      id: fileId,
      data,
      timestamp,
    } as CachedFile);

    // Сохраняем метаданные
    const metaStore = transaction.objectStore(FILES_META_STORE_NAME);
    metaStore.put({
      id: fileId,
      chatId,
      messageId,
      filename,
      mimetype,
      size,
      timestamp,
    } as FileMeta);

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) =>
      reject("Failed to cache file: " + (event.target as IDBRequest).error);
  });
};

/**
 * Получает файл из кеша
 */
export const getCachedFile = async (
  chatId: number,
  messageId: number,
  filename: string,
): Promise<{ data: Blob; meta: FileMeta } | null> => {
  const db = await openFilesDB();
  const fileId = `${chatId}_${messageId}_${filename}`;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [FILES_STORE_NAME, FILES_META_STORE_NAME],
      "readonly",
    );

    const filesStore = transaction.objectStore(FILES_STORE_NAME);
    const metaStore = transaction.objectStore(FILES_META_STORE_NAME);

    const fileRequest = filesStore.get(fileId);
    const metaRequest = metaStore.get(fileId);

    let fileResult: CachedFile | null = null;
    let metaResult: FileMeta | null = null;

    fileRequest.onsuccess = () => {
      fileResult = fileRequest.result;
    };

    metaRequest.onsuccess = () => {
      metaResult = metaRequest.result;
    };

    transaction.oncomplete = () => {
      if (fileResult && metaResult) {
        resolve({ data: fileResult.data, meta: metaResult });
      } else {
        resolve(null);
      }
    };

    transaction.onerror = (event) =>
      reject(
        "Failed to get cached file: " + (event.target as IDBRequest).error,
      );
  });
};

/**
 * Проверяет, есть ли файл в кеше
 */
export const isFileCached = async (
  chatId: number,
  messageId: number,
  filename: string,
): Promise<boolean> => {
  const db = await openFilesDB();
  const fileId = `${chatId}_${messageId}_${filename}`;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FILES_META_STORE_NAME], "readonly");
    const store = transaction.objectStore(FILES_META_STORE_NAME);
    const request = store.get(fileId);

    request.onsuccess = () => {
      resolve(!!request.result);
    };
    request.onerror = (event) =>
      reject(
        "Failed to check cached file: " + (event.target as IDBRequest).error,
      );
  });
};

/**
 * Получает все файлы для сообщения из кеша
 */
export const getCachedFilesForMessage = async (
  chatId: number,
  messageId: number,
): Promise<FileMeta[]> => {
  const db = await openFilesDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FILES_META_STORE_NAME], "readonly");
    const store = transaction.objectStore(FILES_META_STORE_NAME);
    const index = store.index("chatMessage");
    const request = index.getAll([chatId, messageId]);

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = (event) =>
      reject(
        "Failed to get cached files for message: " +
          (event.target as IDBRequest).error,
      );
  });
};

/**
 * Очищает старые файлы из кеша (старше указанного времени)
 */
export const cleanupOldCachedFiles = async (
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000,
): Promise<void> => {
  const db = await openFilesDB();
  const cutoffTime = Date.now() - maxAgeMs;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [FILES_STORE_NAME, FILES_META_STORE_NAME],
      "readwrite",
    );

    const filesStore = transaction.objectStore(FILES_STORE_NAME);
    const metaStore = transaction.objectStore(FILES_META_STORE_NAME);
    const timestampIndex = metaStore.index("timestamp");

    const request = timestampIndex.openCursor(
      IDBKeyRange.upperBound(cutoffTime),
    );
    const filesToDelete: string[] = [];

    request.onsuccess = (event) => {
      const cursor = event.target as IDBCursorWithValue | null;
      if (cursor && cursor.value) {
        const meta = cursor.value as FileMeta;
        if (meta && meta.id) {
          filesToDelete.push(meta.id);
        }
        cursor.continue();
      } else {
        // Удаляем все найденные файлы
        filesToDelete.forEach((fileId) => {
          filesStore.delete(fileId);
          metaStore.delete(fileId);
        });
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) =>
      reject(
        "Failed to cleanup old files: " + (event.target as IDBRequest).error,
      );
  });
};

/**
 * Получает размер кеша файлов
 */
export const getCacheSize = async (): Promise<number> => {
  const db = await openFilesDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FILES_META_STORE_NAME], "readonly");
    const store = transaction.objectStore(FILES_META_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const files = request.result as FileMeta[];
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      resolve(totalSize);
    };
    request.onerror = (event) =>
      reject("Failed to get cache size: " + (event.target as IDBRequest).error);
  });
};

/**
 * Полностью очищает весь кеш файлов
 */
export const clearAllCachedFiles = async (): Promise<void> => {
  const db = await openFilesDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [FILES_STORE_NAME, FILES_META_STORE_NAME],
      "readwrite",
    );

    const filesStore = transaction.objectStore(FILES_STORE_NAME);
    const metaStore = transaction.objectStore(FILES_META_STORE_NAME);

    // Очищаем все записи
    filesStore.clear();
    metaStore.clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) =>
      reject(
        "Failed to clear all cached files: " +
          (event.target as IDBRequest).error,
      );
  });
};
