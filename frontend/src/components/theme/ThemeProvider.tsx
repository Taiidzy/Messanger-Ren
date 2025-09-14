import React, { createContext, useContext, useEffect, useState } from "react";

// Определение доступных тем в приложении
type Theme = "dark" | "light";

// Интерфейс для контекста темы, который будет доступен во всем приложении
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// Создание контекста для темы
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Объект с конфигурацией для каждой темы
// Каждая тема содержит набор CSS классов для различных элементов интерфейса
// eslint-disable-next-line react-refresh/only-export-components
export const themes = {
  dark: {
    background: "from-gray-900/80 to-gray-800/80 bg-gradient-to-br backdrop-blur-xl",
    card: "glass",
    text: "text-gray-100",
    border: "border-gray-700/60",
    messageText: "text-gray-100",
    timeText: "text-gray-400",
    hr: "bg-[rgba(156,163,175,0.3)]",
    messageBackgroundMe: "self-end bg-gradient-to-br from-cyan-900/70 to-black/60 text-white shadow-lg backdrop-blur-xl",
    messageBackgroundYou: "self-start bg-gradient-to-br from-gray-900/70 to-black/60 text-gray-100 shadow-md backdrop-blur-xl",
    avatarCard: "bg-gray-800/60 backdrop-blur-xl",
    accessKeyCard: "from-cyan-900/70 to-black-900/60 bg-gradient-to-br backdrop-blur-xl",
  },
  light: {
    // Японская палитра и акцент на "жидкое стекло"
    background: "from-rose-100/70 via-rose-200/60 to-indigo-100/70 bg-gradient-to-br backdrop-blur-2xl",
    card: "glass",
    text: "text-gray-900 dark:text-rose-100",
    border: "border-white/40",
    messageText: "text-gray-900 dark:text-rose-50",
    timeText: "text-rose-400",
    hr: "bg-rose-200/60",
    messageBackgroundMe: "self-end bg-gradient-to-br from-rose-300/70 to-sky-200/60 text-gray-900 shadow-lg backdrop-blur-2xl",
    messageBackgroundYou: "self-start bg-white/60 dark:bg-white/10 text-gray-900 dark:text-rose-100 shadow-md backdrop-blur-2xl",
    avatarCard: "bg-white/30 dark:bg-white/10 backdrop-blur-2xl",
    accessKeyCard: "from-rose-300/70 to-sky-200/60 bg-gradient-to-br backdrop-blur-2xl",
  },
};

// Провайдер темы, который оборачивает все приложение
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Инициализация состояния темы из localStorage или использование светлой темы по умолчанию
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme") as Theme;
    return savedTheme || "light";
  });

  // Эффект для сохранения выбранной темы в localStorage и применения классов к HTML элементу
  useEffect(() => {
    localStorage.setItem("theme", theme);
    // Удаляем все классы тем
    document.documentElement.classList.remove(
      "dark",
      "light",
    );
    // Добавляем класс текущей темы
    document.documentElement.classList.add(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Хук для использования темы в компонентах
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// Функция для получения стилей текста в зависимости от темы
// eslint-disable-next-line react-refresh/only-export-components
export const getTextStyle = (theme: Theme) => {
  return themes[theme].text;
};
