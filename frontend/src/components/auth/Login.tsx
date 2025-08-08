import React from "react";
import { Navigate } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Background } from "@/components/theme/Background";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoginForm from "@/components/forms/LoginForm";
import RegisterForm from "@/components/forms/RegisterForm";
import { motion } from "framer-motion";
import {
  useTheme,
  themes,
  getTextStyle,
} from "@/components/theme/ThemeProvider";
import RenLogo from "@/assets/Ren-logo.png";

const Login: React.FC = () => {
  const { theme } = useTheme();

  if (localStorage.getItem("token")) {
    return <Navigate to="/" replace />;
  }

  return (
    <Background>
      <div className="flex items-center justify-center h-screen">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>

        <div className="absolute top-4 left-4 z-10">
          <h1 className={`text-2xl font-bold ${getTextStyle(theme)}`}>Ren</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`w-full max-w-md relative z-10 rounded-2xl p-8 shadow-2xl ${themes[theme].card} ${themes[theme].border} border`}
        >
          <div className="flex flex-col items-center gap-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            >
              <img src={RenLogo} alt="Ren Logo" className="w-24 h-24" />
            </motion.div>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="register">Регистрация</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm />
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </div>
    </Background>
  );
};

export default Login;
