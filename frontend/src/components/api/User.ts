import { PROFILES_SERVICE_URL } from "@/components/utils/const";

export const getUser = async (token: string) => {
  if (!token) {
    return null;
  }

  const response = await fetch(`${PROFILES_SERVICE_URL}/profiles`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      console.error("Вы не авторизованы");

      return 401;
    }
    return null;
  }

  return await response.json();
};

export const updateUserName = async (token: string, userName: string) => {
  const response = await fetch(`${PROFILES_SERVICE_URL}/user/update/name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userName }),
  });
  return response.ok ? await response.json() : null;
};

export const searchUser = async (usernameQuery: string, token: string) => {
  const response = await fetch(`${PROFILES_SERVICE_URL}/profiles/search?username=${usernameQuery}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      return 401;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
};