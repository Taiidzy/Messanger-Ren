# Online Service

Сервис для управленя статусами пользователей

## Структура проекта

```
online-service/
├─ src/
│  ├─ api/
│  │  ├─ http/
│  │  │  └─ authService.js      # Проверка токена на валидность через сервис авторизации
│  │  └─ websocket/
│  │     ├─ wsServer.js         # Подключение WebSocket, обработка сообщений
│  │     └─ wsHandler.js        # Логика обработки статусов
│  ├─ domain/
│  │  ├─ userStatusService.js   # Бизнес-логика изменения статусов
│  │  └─ userStatusType.js      # Типы сокета
│  ├─ infrastructure/
│  │  └─ redisClient.js         # Работа с Redis
│  ├─ app.js                    # Основной файл для запуска сервера
│  └─ config.js                 # Конфигурации
├─ .env
├─ package.json
└─ README.md                    # Этот файл

```

## Возможности

- **WebSocket соединения** на `/online-service` эндпоинте
- **Регистрация статусов пользователей** с проверкой токенов
- **Отправка статусов** пользователям с сохранением в Redis
- **Обновление и удаление** статусов
- **Redis** для управления статусами пользователей

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `APP_PORT` | Порт WebSocket сервера | `3101` |
| `AUTH_HOST` | URL основного API | `http://localhost:8000` |
| `REDIS_HOST` | URL Redis сервера | `redis://localhost:6379` |

## Протокол WebSocket

### Типы сообщений

- `status_register` - Регистрация в статуса
- `status_update` - Обвновление статуса контакта
- `contact_status` - Получение статуса контактов

### Пример регистрации

```json
{
  "type": "status_register",
  "token": "jwt_token",
  "contacts": [1,2,3]
}
```

## Зависимости

- `axios` - http клиент
- `dotenv` - Загрузка .env файлов
- `module-alias` - Псевдонимы для модулей
- `redis` - Redis клиент
- `winston` - Библиотека для логов
- `ws` - WebSocket бибилотека

## API интеграция

Сервер интегрируется с внешними API:
- `/auth/verify` - Проверка JWT токенов