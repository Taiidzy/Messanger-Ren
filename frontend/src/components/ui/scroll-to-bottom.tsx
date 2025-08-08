import React from "react";
import { ChevronDown } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";

interface ScrollToBottomProps {
  onClick: () => void;
  isVisible: boolean;
}

const ScrollToBottom: React.FC<ScrollToBottomProps> = ({
  onClick,
  isVisible,
}) => {
  const { theme } = useTheme();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            duration: 0.3,
          }}
          className="fixed bottom-24 right-6 z-50"
        >
          <motion.button
            onClick={onClick}
            whileHover={{
              scale: 1.1,
              transition: { duration: 0.2 },
            }}
            whileTap={{
              scale: 0.95,
              transition: { duration: 0.1 },
            }}
            className="h-12 w-12 rounded-full shadow-lg border-0 flex items-center justify-center cursor-pointer"
            style={{
              backgroundColor:
                theme === "dark"
                  ? "rgba(55, 65, 81, 0.9)"
                  : theme === "orange"
                    ? "rgba(251, 146, 60, 0.9)"
                    : "rgba(255, 255, 255, 0.9)",
              border:
                theme === "dark"
                  ? "1px solid rgba(75, 85, 99, 0.3)"
                  : theme === "orange"
                    ? "1px solid rgba(251, 146, 60, 0.3)"
                    : "1px solid rgba(209, 213, 219, 0.3)",
            }}
          >
            <motion.div
              animate={{
                y: [0, -2, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <ChevronDown
                className="h-6 w-6"
                style={{
                  color:
                    theme === "dark"
                      ? "#ffffff"
                      : theme === "orange"
                        ? "#ffffff"
                        : "#374151",
                }}
              />
            </motion.div>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ScrollToBottom;
