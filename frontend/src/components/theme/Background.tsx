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
      className={`min-h-screen bg-gradient-to-br ${currentTheme.background} p-4 relative overflow-hidden`}
      id="main"
    >
      {/* Анимированные фоновые элементы */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/20 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>
      {children}
    </div>
  );
};

export { Background };
