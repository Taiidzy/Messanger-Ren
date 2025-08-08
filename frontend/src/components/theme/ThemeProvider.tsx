import React, { createContext, useContext, useEffect, useState } from "react";

// Определение доступных тем в приложении
type Theme = "light" | "dark" | "orange" | "cosmic";

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
  light: {
    background: "from-gray-50/80 to-gray-100/80 bg-gradient-to-br backdrop-blur-xl", // Градиентный фон с прозрачностью и блюром
    card: "bg-white/60 backdrop-blur-xl border border-gray-200/60 shadow-[0_4px_32px_rgba(0,0,0,0.08)]", // Стекломорфизм
    text: "text-gray-900",
    border: "border-gray-200/60",
    messageText: "text-gray-900",
    timeText: "text-gray-400",
    hr: "bg-gray-200/60",
    messageBackgroundMe: "self-end bg-gradient-to-br from-blue-400/70 to-blue-200/60 text-white shadow-lg backdrop-blur-xl",
    messageBackgroundYou: "self-start bg-white/60 text-gray-900 shadow-md backdrop-blur-xl",
    avatarCard: "bg-gray-800/60 backdrop-blur-xl",
    accessKeyCard: "bg-blue-500/60 backdrop-blur-xl",
  },
  dark: {
    background: "from-gray-900/80 to-gray-800/80 bg-gradient-to-br backdrop-blur-xl",
    card: "bg-gray-900/60 backdrop-blur-xl border border-gray-700/60 shadow-[0_4px_32px_rgba(0,0,0,0.25)]",
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
  orange: {
    background: "from-orange-100/80 to-orange-200/80 bg-gradient-to-br backdrop-blur-xl",
    card: "bg-orange-50/60 backdrop-blur-xl border border-orange-200/60 shadow-[0_4px_32px_rgba(251,146,60,0.10)]",
    text: "text-orange-900",
    border: "border-orange-200/60",
    messageText: "text-orange-900",
    timeText: "text-orange-400",
    hr: "bg-[rgba(251,146,60,0.3)]",
    messageBackgroundMe: "self-end bg-gradient-to-br from-orange-200/80 to-red-100/60 text-orange-800 shadow-lg backdrop-blur-xl",
    messageBackgroundYou: "self-start bg-gradient-to-br from-yellow-200/80 to-red-100/60 bg-white/60 text-orange-800 shadow-md backdrop-blur-xl",
    avatarCard: "bg-gray-800/60 backdrop-blur-xl",
    accessKeyCard: "from-orange-200/80 to-red-100/60 bg-gradient-to-br backdrop-blur-xl",
  },
  cosmic: {
    background: "from-slate-900/80 via-purple-950/80 to-indigo-950/80 bg-gradient-to-br backdrop-blur-2xl",
    card: "bg-black/40 backdrop-blur-2xl border border-purple-500/20 shadow-[0_0_32px_rgba(139,92,246,0.25)]",
    text: "text-purple-100",
    border: "border-purple-500/40",
    messageText: "text-purple-100",
    timeText: "text-purple-400",
    hr: "bg-[rgba(139,92,246,0.3)]",
    messageBackgroundMe: "self-end bg-gradient-to-br from-purple-600/80 to-cyan-900/60 text-white shadow-xl backdrop-blur-2xl",
    messageBackgroundYou: "self-start bg-gradient-to-br from-gray-700/80 to-indigo-900/60 text-purple-100 shadow-lg backdrop-blur-2xl",
    avatarCard: "bg-gray-800/60 backdrop-blur-xl",
    accessKeyCard: "from-purple-600/80 to-cyan-900/60 bg-gradient-to-br backdrop-blur-2xl",
  },
};

// Провайдер темы, который оборачивает все приложение
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Инициализация состояния темы из localStorage или использование светлой темы по умолчанию
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme") as Theme;
    return savedTheme || "dark";
  });

  // Эффект для сохранения выбранной темы в localStorage и применения классов к HTML элементу
  useEffect(() => {
    localStorage.setItem("theme", theme);
    // Удаляем все классы тем
    document.documentElement.classList.remove(
      "light",
      "dark",
      "orange",
      "cosmic",
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
  return theme === "cosmic"
    ? "bg-gradient-to-r from-purple-400 via-pink-500 to-blue-400 bg-clip-text text-transparent"
    : themes[theme].text;
};
