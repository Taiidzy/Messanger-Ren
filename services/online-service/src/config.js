// ================== Импорты ==================
const dotenv = require('dotenv');

// Загружаем переменные из .env, если они есть
dotenv.config();

// Создаём объект конфигурации
const config = {
  app: {
    port: process.env.APP_PORT || 3101,
  },
  redis: {
    host: process.env.REDIS_HOST || "redis://localhost:6379",
  },
  auth: {
    host: process.env.AUTH_HOST || "https://localhost:8000",
  }
};

module.exports = config;