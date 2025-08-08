// src/App.tsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./components/auth/Login";
import Recovery from "./components/auth/Recovery";
import MainPage from "./components/main/MainPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/toast-context";
import { CryptoProvider } from "@/components/context/CryptoContext";

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <CryptoProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/recover" element={<Recovery />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </CryptoProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
