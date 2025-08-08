import { API_URL } from "@/components/utils/const";

export const getUser = async (token: string) => {
  if (!token) {
    return null;
  }

  const response = await fetch(`${API_URL}/user`, {
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
  const response = await fetch(`${API_URL}/user/update/name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userName }),
  });
  return response.ok ? await response.json() : null;
};

export const searchUsers = async (token: string, loginQuery: string) => {
  if (!token || !loginQuery) return [];
  const response = await fetch(
    `${API_URL}/user/search?login=${encodeURIComponent(loginQuery)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) return [];
  return await response.json(); // [{id, userName, login}]
};

export const sendFile = async (token: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/user/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  return response.ok ? await response.json() : null;
};
