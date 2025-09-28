import { CHAT_SERVICE_URL } from "@/components/utils/const";
import type { MessageData } from "@/components/models/Messages";

export const getChat = async (token: string) => {
  if (!token) {
    return null;
  }

  const response = await fetch(`${CHAT_SERVICE_URL}/chats`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      console.error("Вы не авторизованы");

      return 401 as const;
    }
    return null;
  }

  const result = await response.json();

  return result;
};

export const createChat = async (token: string, userId: number) => {
  const response = await fetch(`${CHAT_SERVICE_URL}/chats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ "companion_id": userId }),
  });

  console.log(response);

  if (!response.ok) {
    if (response.status === 401) {
      console.error("Вы не авторизованы");

      return 401 as const;
    }
    return 500;
  }

  return 201;
};

export const getMessages = async (
  token: string,
  chatId: number,
  offset: number = 0,
  limit: number = 50,
): Promise<MessageData[] | null | 401> => {
  if (!token) {
    return null;
  }

  const response = await fetch(`${CHAT_SERVICE_URL}/chats/${chatId}/messages?offset=${offset}&limit=${limit}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      console.error("Вы не авторизованы");

      return 401 as const;
    }
    return null;
  }

  const result = await response.json();

  return result;
};
