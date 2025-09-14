import React from "react";
import { motion } from "framer-motion";
import { useTheme, themes } from "@/components/theme/ThemeProvider";

interface BackgroundProps {
  children: React.ReactNode;
}

const Background: React.FC<BackgroundProps> = ({ children }) => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${currentTheme.background} p-2 md:p-4 relative overflow-hidden`}
      id="main"
    >
      {/* Анимированные фоновые элементы – мягкие пятна цвета сакуры */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <motion.div
          className="absolute -top-1/3 -left-1/4 w-[60vw] h-[60vw] bg-rose-200/35 rounded-full blur-3xl"
          animate={{
            y: [0, 20, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-1/3 -right-1/4 w-[60vw] h-[60vw] bg-indigo-200/35 rounded-full blur-3xl"
          animate={{
            y: [0, -20, 0],
            scale: [1.05, 1, 1.05],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* стеклянная пленка поверх */}
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export { Background };
