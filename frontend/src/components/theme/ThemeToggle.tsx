import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { Moon, Sun } from "lucide-react";

// Объект с иконками для каждой темы
const themeIcons = {
  // light: Sun,    // Солнце для светлой темы
  orange: Sun, // Палитра для оранжевой темы
  dark: Moon, // Луна для темной темы
  // cosmic: Rocket,  // Ракета для космической темы
};

// Объект с названиями тем на русском языке
const themeNames = {
  light: "Светлая",
  dark: "Тёмная",
  orange: "Оранжевая",
  cosmic: "Космическая",
};

// Компонент переключения тем
export const ThemeToggle: React.FC = () => {
  // Получаем текущую тему и функцию для её изменения из контекста
  const { theme, setTheme } = useTheme();
  // Получаем массив доступных тем
  const themes = Object.keys(themeIcons) as Array<keyof typeof themeIcons>;

  return (
    // Контейнер с кнопками переключения тем
    <div className="flex gap-2 p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg">
      {themes.map((t) => {
        const Icon = themeIcons[t];
        const isActive = theme === t;

        return (
          // Анимированная кнопка для каждой темы
          <motion.div
            key={t}
            whileHover={{ scale: 1.05 }} // Эффект увеличения при наведении
            whileTap={{ scale: 0.95 }} // Эффект нажатия
          >
            <Button
              variant={isActive ? "default" : "ghost"}
              size="icon"
              onClick={() => setTheme(t)}
              className={`relative cursor-pointer overflow-hidden ${
                isActive
                  ? "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground"
                  : "bg-white/5 hover:bg-white/10"
              }`}
              title={themeNames[t]} // Подсказка при наведении
            >
              <Icon className="h-5 w-5 relative z-10" />
              {/* Анимированный индикатор активной темы */}
              {isActive && (
                <motion.div
                  layoutId="activeTheme"
                  className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary rounded-lg"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
};
