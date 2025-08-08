import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { useTheme, themes } from "@/components/theme/ThemeProvider";

interface AccessKeyModalProps {
  isOpen: boolean;
  accessKey: string;
  onClose: () => void;
}

const AccessKeyModal: React.FC<AccessKeyModalProps> = ({
  isOpen,
  accessKey,
  onClose,
}) => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(accessKey);
      // Можно добавить toast уведомление об успешном копировании
    } catch (err) {
      console.error("Ошибка при копировании:", err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Card
              className={`w-full max-w-md ${currentTheme.accessKeyCard} ${currentTheme.border} border`}
            >
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
                  <Icons.warning className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <CardTitle className={`text-xl font-bold ${currentTheme.text}`}>
                  Сохраните ваш ключ доступа!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`text-sm ${currentTheme.text} text-center`}>
                  <p className="mb-3">
                    Это ваш <strong>ключ доступа</strong>. Он необходим для
                    восстановления аккаунта в случае утери пароля.
                  </p>
                  <p className="mb-4 text-red-600 dark:text-red-400">
                    ⚠️ Запишите его и храните в безопасном месте. Без этого
                    ключа вы не сможете восстановить доступ к аккаунту!
                  </p>
                </div>

                <div className="space-y-2">
                  <label className={`text-sm font-medium ${currentTheme.text}`}>
                    Ключ доступа:
                  </label>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`flex-1 p-3 rounded-md border ${currentTheme.border} ${currentTheme.background} font-mono text-sm break-all`}
                    >
                      {accessKey}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                      className="shrink-0"
                    >
                      <Icons.filePlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button type="button" onClick={onClose} className="flex-1">
                    Я сохранил ключ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AccessKeyModal;
