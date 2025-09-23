# Chat Service

Микросервис для управления чатами, построенный на NestJS и Prisma.

## Особенности

- **NestJS** - современный Node.js фреймворк
- **Prisma** - современный ORM для работы с базой данных
- **PostgreSQL** - основная база данных
- **JWT авторизация** через внешний auth-сервис
- **Динамические таблицы** для сообщений чатов
- **Валидация** входных данных с помощью class-validator
- **Логирование** и обработка ошибок

## Структура проекта

```
chat-service/
├── src/
│   ├── app.module.ts              # Корневой модуль
│   ├── main.ts                    # Точка входа
│   ├── chats/                     # Модуль чатов
│   │   ├── chats.module.ts        # NestJS модуль
│   │   ├── chats.controller.ts    # REST контроллер
│   │   ├── chats.service.ts       # Бизнес-логика
│   │   ├── chats.repository.ts    # Слой работы с БД
│   │   ├── dto/                   # DTO для валидации
│   │   │   └── create-chat.dto.ts
│   │   ├── interfaces/            # TypeScript интерфейсы
│   │   │   └── chat.interface.ts
│   │   └── exceptions/            # Кастомные исключения
│   │       └── chat.exceptions.ts
│   ├── guards/                    # Guards для авторизации
│   │   └── auth.guard.ts
│   └── database/                  # Модуль базы данных
│       ├── database.module.ts
│       └── prisma.service.ts
├── prisma/
│   └── schema.prisma              # Схема базы данных
├── .env.example                   # Пример переменных окружения
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```


## Переменные окружения

| Переменная | Описание | Пример |
|------------|----------|---------|
| `DATABASE_URL` | URL подключения к PostgreSQL | `postgresql://user:password@localhost:5432/chatdb` |
| `PORT` | Порт сервера | `3000` |
| `AUTH_SERVICE_URL` | URL сервиса авторизации | `http://localhost:3001` |
| `ALLOWED_ORIGINS` | Разрешенные CORS origins | `http://localhost:3000,http://localhost:3001` |


## API Endpoints

### Создание чата
```http
POST /chats
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "companionId": 123
}
```

**Ответ:**
```json
{
  "chatId": 1,
  "user1Id": 456,
  "user2Id": 123,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Получение списка чатов пользователя
```http
GET /chats
Authorization: Bearer <jwt-token>
```

**Ответ:**
```json
[
  {
    "chatId": 1,
    "user1Id": 456,
    "user2Id": 123,
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### Получение чата по ID
```http
GET /chats/:id
Authorization: Bearer <jwt-token>
```

### Удаление чата
```http
DELETE /chats/:id
Authorization: Bearer <jwt-token>
```

## Архитектурные решения

### Авторизация
- Сервис не хранит пользователей локально
- Для каждого запроса проверяет JWT токен через внешний auth-сервис
- `AuthGuard` автоматически извлекает информацию о пользователе

### База данных
- Основная таблица `chats` хранит метаданные чатов
- Для каждого чата динамически создаются таблицы:
  - `chat_<id>` - сообщения чата
  - `chat_<id>_files` - файлы сообщений

### Обработка ошибок
- Кастомные исключения для разных типов ошибок
- Централизованное логирование
- Валидация входных данных

### Безопасность
- Проверка принадлежности чата пользователю
- Валидация всех входных параметров
- Защита от SQL-инъекций через Prisma

## Разработка

### Генерация Prisma Client после изменения схемы
```bash
npm run prisma:generate
```

### Создание и применение миграций
```bash
npm run prisma:migrate
```

### Просмотр данных
```bash
npm run prisma:studio
```

### Линтинг
```bash
npm run lint
```

### Тестирование
```bash
npm run test
npm run test:e2e
```

## Мониторинг и логирование

Сервис использует встроенный NestJS Logger для логирования:
- Создание и удаление чатов
- Ошибки авторизации
- Ошибки работы с базой данных

Логи можно настроить через переменные окружения или конфигурационные файлы.

## Масштабирование

1. **Горизонтальное масштабирование**: сервис stateless, можно запускать несколько экземпляров
2. **Кеширование**: можно добавить Redis для кеширования метаданных чатов
3. **Разделение БД**: можно шардить таблицы сообщений по chat_id
4. **Message Queue**: для асинхронной обработки создания/удаления таблиц

## Зависимости от других сервисов

- **Auth Service** - для проверки JWT токенов и получения информации о пользователе
- **PostgreSQL** - основная база данных