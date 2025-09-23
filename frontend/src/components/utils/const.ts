// URLs берём из переменных окружения Vite, с безопасными дефолтами для локальной разработки
interface ViteEnv {
  VITE_API_URL?: string;
  VITE_MESSAGE_SERVICE_URL?: string;
  VITE_ONLINE_SERVICE_URL?: string;
  VITE_AUTH_SERVICE_URL?: string;
  VITE_CHAT_SERVICE_URL?: string;
  VITE_PROFILES_SERVICE_URL?: string;
  VITE_MEDIA_SERVICE_URL?: string;
}

const viteEnv = (import.meta as unknown as { env?: ViteEnv }).env ?? {};

export const API_URL: string = viteEnv.VITE_API_URL ?? "http://localhost:8000";
export const PROFILES_SERVICE_URL: string = viteEnv.VITE_PROFILES_SERVICE_URL ?? "http://localhost:8002/profiles-service";
export const CHAT_SERVICE_URL: string = viteEnv.VITE_CHAT_SERVICE_URL ?? "http://localhost:3102/chat-service";
export const AUTH_SERVICE_URL: string = viteEnv.VITE_AUTH_SERVICE_URL ?? "http://localhost:8001/auth-service";
export const MESSAGE_SERVICE_URL: string = viteEnv.VITE_MESSAGE_SERVICE_URL ?? "ws://localhost:3000/message-service";
export const ONLINE_SERVICE_URL: string = viteEnv.VITE_ONLINE_SERVICE_URL ?? "ws://localhost:3101/online-service";
export const MEDIA_SERVICE_URL: string = viteEnv.VITE_MEDIA_SERVICE_URL ?? "http://localhost:8003/media-service";