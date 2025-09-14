// URLs берём из переменных окружения Vite, с безопасными дефолтами для локальной разработки
interface ViteEnv {
  VITE_API_URL?: string;
  VITE_WS_URL?: string;
  VITE_MESSAGE_SERVICE_URL?: string;
  VITE_ONLINE_SERVICE_URL?: string;
}

const viteEnv = (import.meta as unknown as { env?: ViteEnv }).env ?? {};

export const API_URL: string = viteEnv.VITE_API_URL ?? "http://localhost:8000";
export const WS_URL: string = viteEnv.VITE_WS_URL ?? "ws://localhost:3000/ws";
export const MESSAGE_SERVICE_URL: string = viteEnv.VITE_MESSAGE_SERVICE_URL ?? "ws://localhost:3000/message-service";
export const ONLINE_SERVICE_URL: string = viteEnv.VITE_ONLINE_SERVICE_URL ?? "ws://localhost:3101/online-service";