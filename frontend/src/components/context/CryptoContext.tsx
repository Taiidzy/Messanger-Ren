/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import {
  loadCryptoKeyFromIndexedDB,
  saveCryptoKeyToIndexedDB,
  deleteCryptoKeyFromIndexedDB,
} from "@/components/utils/indexedDBUtils";
import {
  deriveKeyFromPassword,
  decryptData,
  importPrivateKeyFromPkcs8,
  importPublicKeyFromSpki,
} from "@/components/utils/crypto";
import { login } from "@/components/api/Auth"; // Импортируем функцию логина

interface loginSuccess {
  status: number;
  message?: string;
}

interface CryptoContextType {
  privateKey: CryptoKey | null;
  publicKey: CryptoKey | null;
  setKeys: (privateKey: CryptoKey, publicKey: CryptoKey) => void;
  clearKeys: () => void;
  isAuthenticated: boolean;
  isLoadingKeys: boolean;
  loadKeysOnLogin: (username: string, password: string) => Promise<loginSuccess>;
}

const CryptoContext = createContext<CryptoContextType | undefined>(undefined);

export const useCrypto = () => {
  const context = useContext(CryptoContext);
  if (context === undefined) {
    throw new Error("useCrypto must be used within a CryptoProvider");
  }
  return context;
};

interface CryptoProviderProps {
  children: ReactNode;
}

export const CryptoProvider: React.FC<CryptoProviderProps> = ({ children }) => {
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Функция для сохранения ключей в IndexedDB
  const saveKeysToDB = useCallback(
    async (privKey: CryptoKey, pubKey: CryptoKey) => {
      try {
        await saveCryptoKeyToIndexedDB("privateKey", privKey);
        await saveCryptoKeyToIndexedDB("publicKey", pubKey);
      } catch (error) {
        console.error("Error saving keys to IndexedDB:", error);
      }
    },
    [],
  );

  // Функция для очистки ключей из IndexedDB
  const clearKeysFromDB = useCallback(async () => {
    try {
      await deleteCryptoKeyFromIndexedDB("privateKey");
      await deleteCryptoKeyFromIndexedDB("publicKey");
    } catch (error) {
      console.error("Error deleting keys from IndexedDB:", error);
    }
  }, []);

  const setKeysAndPersist = useCallback(
    (newPrivateKey: CryptoKey, newPublicKey: CryptoKey) => {
      setPrivateKey(newPrivateKey);
      setPublicKey(newPublicKey);
      setIsAuthenticated(true);
      saveKeysToDB(newPrivateKey, newPublicKey); // Сохраняем в IndexedDB
    },
    [saveKeysToDB],
  );

  const clearKeys = useCallback(() => {
    setPrivateKey(null);
    setPublicKey(null);
    setIsAuthenticated(false);
    clearKeysFromDB(); // Удаляем из IndexedDB
    localStorage.removeItem("token"); // Также очищаем токен
  }, [clearKeysFromDB]);

  // Функция для загрузки ключей при логине (если их нет в IndexedDB)
  const loadKeysOnLogin = useCallback(
    async (username: string, password: string): Promise<loginSuccess> => {
      setIsLoadingKeys(true);
      try {
        const result = await login({ login: username, password: password });

        if (result.status === 401) {
          const errorAuth = {
            status: result.status,
            message: result.message
          }
          return errorAuth
        }

        else if (
          result.token &&
          result.encryptedPrivateKeyByUser &&
          result.salt &&
          result.publicKey
        ) {
          localStorage.setItem("token", result.token);

          const masterKey = await deriveKeyFromPassword(password, result.salt);
          const privateKeyString = await decryptData(
            result.encryptedPrivateKeyByUser,
            masterKey,
          );

          // Импортируем дешифрованный приватный ключ как CryptoKey с extractable: false
          const privateKeyObj = await importPrivateKeyFromPkcs8(
            privateKeyString,
            false,
          );
          // Публичный ключ можно импортировать как extractable: true, так как он не секретен
          const publicKeyObj = await importPublicKeyFromSpki(
            result.publicKey,
            true,
          );

          setKeysAndPersist(privateKeyObj, publicKeyObj);
          const successAuth = {
            status: 200,
            message: "Вы успешно вошли в аккаунт."
          }
          return successAuth
        } else {
          const errorAuth = {
            status: result.status,
            message: result.message
          }
          return errorAuth
        }
      } catch (error) {
        console.error("Error loading keys on login:", error);
        const errorAuth = {
          status: 0,
          message: error!.toString()
        }
        return errorAuth
      } finally {
        setIsLoadingKeys(false);
      }
    },
    [setKeysAndPersist],
  );

  useEffect(() => {
    // При монтировании компонента пытаемся загрузить ключи из IndexedDB
    const loadPersistedKeys = async () => {
      setIsLoadingKeys(true);
      try {
        const storedPrivateKey = await loadCryptoKeyFromIndexedDB("privateKey");
        const storedPublicKey = await loadCryptoKeyFromIndexedDB("publicKey");

        if (storedPrivateKey && storedPublicKey) {
          setPrivateKey(storedPrivateKey);
          setPublicKey(storedPublicKey);
          setIsAuthenticated(true);
        } else {
          // silent in production; UI will prompt user
          // Если ключей нет, проверяем токен. Если токен есть, но ключей нет, токен может быть устарел или ключи удалены.
          // В таком случае, может быть полезно очистить токен и попросить пользователя залогиниться снова.
          if (localStorage.getItem("token")) {
            // remove stale token silently
            localStorage.removeItem("token");
          }
        }
      } catch (error) {
        console.error("Ошибка при загрузке ключей из IndexedDB:", error);
      } finally {
        setIsLoadingKeys(false);
      }
    };

    loadPersistedKeys();
  }, []); // Запускается один раз при монтировании

  const value: CryptoContextType = {
    privateKey,
    publicKey,
    setKeys: setKeysAndPersist,
    clearKeys,
    isAuthenticated,
    isLoadingKeys,
    loadKeysOnLogin,
  };

  return (
    <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>
  );
};
