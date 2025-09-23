import { encryptFile } from "@/components/utils/crypto";
import { MEDIA_SERVICE_URL } from "@/components/utils/const";
import { logoutUser } from "@/components/auth/Logout";

// Тип для прогресса
export interface UploadProgressInfo {
  uploaded: number;
  total: number;
  percentage: number;
}

export async function uploadVideoByChunks(
  videoFile: File,
  chatId: number,
  messageId: number,
  messageKey: CryptoKey,
  onProgress?: (progress: UploadProgressInfo) => void
): Promise<{
  file_id: number;
  filename: string;
  mimetype: string;
  size: number;
  chunk_count: number;
  chunk_size: number;
  nonces: string[];
  duration: number | null;
}> {
  // Проверяем, что это видеофайл
  let duration: number | null = null;
  if (videoFile.type.startsWith('video/')) {
    // Получаем продолжительность видео
    const getVideoDuration = (file: File): Promise<number> => {
      return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve(video.duration);
        };
        video.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(0); // Если не удалось получить, возвращаем 0
        };
        video.src = url;
      });
    };
    duration = await getVideoDuration(videoFile);
  }

  const file_id = Date.now() + Math.floor(Math.random() * 10000);
  const chunkSize = 2 * 1024 * 1024; // 2MB для чанков
  const totalChunks = Math.ceil(videoFile.size / chunkSize);
  const nonces: string[] = [];
  let uploaded = 0;
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, videoFile.size);
    const chunkBlob = videoFile.slice(start, end);
    const chunkFile = new File([chunkBlob], `${videoFile.name}.chunk.${i}`, { type: videoFile.type });

    const encrypted = await encryptFile(chunkFile, messageKey);
    nonces[i] = encrypted.nonce;
    let success = false;
    let attempts = 0;
    while (!success && attempts < 3) {
      attempts++;
      try {
        const token = localStorage.getItem("token");
        const resp = await fetch(
          `${MEDIA_SERVICE_URL}/upload_chunk/${chatId}/${messageId}/${file_id}/${i}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include', // Добавляем credentials для CORS
            body: JSON.stringify({
              chunk: encrypted.ciphertext,
              nonce: encrypted.nonce,
            }),
          }
        );
        if (resp.ok) {
          success = true;
        } else if (resp.status === 401) {
          logoutUser();
        }
        else {
          console.error(`Chunk upload failed: ${resp.status} ${resp.statusText}`);
          const errorText = await resp.text().catch(() => 'Unknown error');
          console.error(`Error details: ${errorText}`);
          await new Promise((res) => setTimeout(res, 500));
        }
      } catch (error) {
        console.error(`Network error uploading chunk ${i}:`, error);
        await new Promise((res) => setTimeout(res, 500));
      }
    }
    uploaded += end - start;
    onProgress?.({
      uploaded,
      total: videoFile.size,
      percentage: Math.round((uploaded / videoFile.size) * 100),
    });
  }
  // Отправляем metadata
  const metadata = {
    filename: videoFile.name,
    mimetype: videoFile.type,
    size: videoFile.size,
    chunk_count: Math.ceil(videoFile.size / chunkSize),
    chunk_size: chunkSize, // Размер обычных чанков
    nonces,
    duration, // duration: number | null
  };
  const token = localStorage.getItem("token");
  try {
    const metadataResp = await fetch(
      `${MEDIA_SERVICE_URL}/upload_metadata/${chatId}/${messageId}/${file_id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Добавляем credentials для CORS
        body: JSON.stringify(metadata),
      }
    );
    
    if (!metadataResp.ok) {
      console.error(`Metadata upload failed: ${metadataResp.status} ${metadataResp.statusText}`);
      const errorText = await metadataResp.text().catch(() => 'Unknown error');
      console.error(`Metadata error details: ${errorText}`);
    }
  } catch (error) {
    console.error('Metadata upload error:', error);
  }
  return {
    file_id,
    ...metadata,
  };
}