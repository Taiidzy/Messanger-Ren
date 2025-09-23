## Auth Service

Сервис управления аккаунтами пользователей, аутентификацией, верификацией и регистрацией

---

## Структура проекта
app/services/auth_service.py
```
auth-service/
│── app/
│   ├── api/                         # Роуты (endpoints)
│   │   └── v1/                      # Версия API
│   │       ├── auth.py              # Авторизация
│   │       ├── recovery.py          # Восстановление аккаунта
│   │       └── register.py          # Регистрация
│   │
│   ├── core/                        # Конфигурация и основные зависимости
│   │   ├── config.py                # Настройки (env, dotenv, pydantic)
│   │   └── security.py              # JWT, пароли, токены
│   │
│   ├── db/                          # Работа с БД
│   │   ├── base.py                  # Подключение к БД, session
│   │   └── models.py                # SQLAlchemy модели
│   │
│   ├── schemas/                     # Pydantic схемы для API
│   │   ├── auth.py                  # Схемы для авторизации
│   │   ├── recovery.py              # Схемы для восстановление аккаунта
│   │   └── register.py              # Схемы для регистрация
│   │
│   ├── services/                    # Бизнес-логика
│   │   ├── auth_service.py          # Логика аутентификации
│   │   ├── register_service.py      # Логика регистрации
│   │   └── __init__.py
│   │
│   ├── utils/                       # Хелперы и вспомогательные функции
│   │   └── __init__.py
│   │
│   └── app.py                       # Точка входа (FastAPI app)
│
├── .Dockerfile
├── .env                             # Переменные окружения
├── requirements.txt                 # Зависимости
└── README.md                        # Этот файл

```

## Возможности

- **Двухэтапная регистрация**
- **Восстановление аккаунта** с помощью кода доступа

## Переменные окружения

| Переменная                     | Описание            | По умолчанию   |
|--------------------------------|---------------------|----------------|
| `POSTGRES_USER`                | Логин БД            | `----`         |
| `POSTGRES_PASSWORD`            | Пароль БД           | `----`         |
| `POSTGRES_SERVER`              | Хост БД             | `postgres`     |
| `POSTGRES_PORT`                | Порт БД             | `5432`         |
| `POSTGRES_DB`                  | Название БД         | `----`         |
| `SECRET_KEY`                   | Секретный ключ      | `----`         |
| `ALGORITHM`                    | Алгортим шифрования | `HS256`        |
| `ACCESS_TOKEN_EXPIRE_MINUTES`  | Время жизни токена  | `30`           |
| `APP_HOST`                     | Хост сервера        | `0000`         |
| `APP_PORT`                     | Порт сервера        | `8001`         |
| `RELOAD`                       | Перезагрузка        | `true`         |
| `UVICORN_LOG_LEVEL`            | Уровень логов       | `info`         |


## Зависимости

- `fastapi` - API
- `uvicorn` - Сервер
- `sqlalchemy` - Работа с БД
- `psycopg2-binary` - Модуль для Postgres
- `python-jose[cryptography]` - Библиотека для широфания
- `passlib[bcrypt]` - Библиотека для шифрования паролей
- `python-dotenv` - Работа с .env
- `pydantic` - Работа с данными
- `pydantic-settings` - Модуль для pydantic