import { deleteCryptoKeyFromIndexedDB } from "@/components/utils/indexedDBUtils";
import { OnlineStatusClient } from "@/components/api/statusClient"; // Импортируем OnlineStatusClient

export const logoutUser = () => {
  const token = localStorage.getItem("token");
  if (token) {
    localStorage.removeItem("token");
    deleteCryptoKeyFromIndexedDB("privateKey");
    deleteCryptoKeyFromIndexedDB("publicKey");
    
    // Получаем существующий экземпляр синглтона и отключаем его
    // Здесь важно: getInstance без параметров, если экземпляр уже существует.
    // Если клиент еще не был создан (например, пользователь пытался выйти сразу после загрузки, до инициализации MainPage),
    // то getInstance может создать его с пустыми параметрами, но disconnect() все равно безопасно отработает.
    // Для более строгой проверки можно добавить метод isConnected или getStatus в OnlineStatusClient.
    const statusClient = OnlineStatusClient.getInstance("", []); // Параметры здесь не используются, если экземпляр уже есть
    if (statusClient) {
      statusClient.disconnect();
    }
    
    // silent success
    return true;
  }
  return false;
};