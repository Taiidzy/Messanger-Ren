# Message Service

Сервис для обмена сообщениями и сохранения их в БД

---

## Структура проекта

```
message-service/
├── internal/
│   └── server/
│       ├── handlers.go     # Логика обработки входящих сообщений по их типу
│       ├── models.go       # Структуры данных для сообщений (JSON)
│       ├── redis.go        # Сохранение и работа с комантами в редис
│       └── server.go       # Основной HTTP-сервер и обработчик WebSocket-подключений
├── .env
├── go.mod                  # Определение Go-модуля и зависимостей
├── go.sum                  
├── main.go                 # Точка входа в приложение
├── .Dockerfile
└── README.md               # Этот файл
```

## Возможности

- **WebSocket соединения** на `/ws` эндпоинте
- **Регистрация пользователей** с проверкой токенов
- **Отправка сообщений** в чаты с сохранением в БД
- **Редактирование и удаление** сообщений
- **Redis** для управления участниками чатов
- **Graceful shutdown** с корректным закрытием соединений


## Переменные окружения

| Переменная   | Описание               | По умолчанию             |
|--------------|------------------------|--------------------------|
| `APP_PORT`   | Порт WebSocket сервера | `3000`                   |
| `AUTH_HOST`  | URL основного API      | `http://localhost:8000`  |
| `REDIS_HOST` | URL Redis сервера      | `redis://localhost:6379` |

## Протокол WebSocket

### Типы сообщений

- `register` - Регистрация в чате
- `message` - Отправка сообщения
- `edit_message` - Редактирование сообщения
- `delete_message` - Удаление сообщения

### Пример регистрации

```json
{
  "type": "register",
  "token": "jwt_token",
  "chat_id": 123
}
```

### Пример отправки сообщения

```json
{
  "type": "message",
  "data": {
    "id": "msg_uuid",
    "sender_id": 456,
    "message_type": "text",
    "ciphertext": "encrypted_content",
    "nonce": "encryption_nonce",
    "envelopes": {},
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

## Зависимости

- `github.com/gorilla/websocket` - WebSocket библиотека
- `github.com/redis/go-redis/v9` - Redis клиент
- `github.com/joho/godotenv` - Загрузка .env файлов

## API интеграция

Сервер интегрируется с внешними API:
- `/auth/verify` - Проверка JWT токенов
- `/chat/massage` - Сохранение сообщений в БД
- `/chat/{chat_id}/messages/{message_id}` - Редактирование/удаление сообщений