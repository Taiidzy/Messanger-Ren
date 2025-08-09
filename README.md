## REN Messenger — современный E2EE‑мессенджер

Удобный, безопасный и быстрый. Сквозное шифрование для сообщений и файлов, децентрализованное управление ключами, дружелюбный интерфейс и продуманная архитектура.

Будущее: планируется мобильное приложение (iOS/Android) с полным E2EE и совместимой криптомоделью.

### Основные возможности
- Сквозное шифрование (E2EE) всего контента на клиенте
- Двойное шифрование приватных ключей (пароль и access key)
- Отправка изображений, документов и видео (чанковая загрузка крупных файлов)
- Кеширование расшифрованных файлов в IndexedDB для быстрого повторного просмотра
- Реал‑тайм через WebSocket сервис (статусы/сообщения)
- Backend: FastAPI + SQLAlchemy + PostgreSQL
- Frontend: React 19 + TypeScript + Vite + Tailwind

---

## Содержание
- [Обзор архитектуры](#обзор-архитектуры)
- [Требования](#требования)
- [Быстрый старт (3 шага)](#быстрый-старт-3-шага)
- [Настройка переменных окружения](#настройка-переменных-окружения)
- [Запуск сервисов (Backend, Realtime, Frontend)](#запуск-сервисов)
- [Краткая документация API (REST + WebSocket)](#краткая-документация-api)
- [Модель E2EE: как это работает](#модель-e2ee-как-это-работает)
- [Работа с файлами и чанками](#работа-с-файлами-и-чанками)
- [Безопасность и best practices](#безопасность-и-best-practices)
- [Разработка и скрипты](#разработка-и-скрипты)
- [FAQ и устранение неполадок](#faq-и-устранение-неполадок)
- [Roadmap (включая мобильное приложение)](#roadmap)
- [Лицензия](#лицензия)
---

## Обзор архитектуры

Структура монорепозитория:
```
Messenger-Ren/
├─ backend/
│  ├─ core-api/               # FastAPI (REST, хранение, файлы)
│  │  ├─ app.py               # Основной вход FastAPI
│  │  ├─ db/                  # SQLAlchemy engine, модели
│  │  ├─ schemas/             # Pydantic‑схемы
│  │  ├─ utils/               # JWT, файловые утилиты
│  │  └─ storage/             # Хранилище зашифрованных файлов
│  └─ realtime-service/       # Node.js WebSocket‑сервер (ws://.../ws)
└─ frontend/                  # React + TS (Vite)
   └─ src/components          # UI, API‑клиенты, E2EE‑утилиты
```

Высокоуровневый поток:
- Клиент генерирует ключи, шифрует контент и управляет приватными ключами на своей стороне
- Backend хранит только зашифрованные данные и метаданные, выдает JWT
- Realtime‑сервис обеспечивает регистрацию в комнатах/статусы и маршрутизацию сообщений

---

## Требования
- Node.js 18+
- Python 3.8+
- PostgreSQL 12+
- Современный браузер с Web Crypto API

---

## Быстрый старт (3 шага)

1) Клонирование
```bash
git clone <repository-url>
cd Messenger-Ren
```

2) Настройка переменных окружения
- Создайте `backend/core-api/.env` из примера (см. ниже)
- Создайте `frontend/.env` из примера
- Создайте `backend/realtime-service/.env` из примера

3) Установка и запуск
```bash
# Backend
cd backend/core-api
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Realtime (WebSocket)
cd ../realtime-service
npm install
npm run dev

# Frontend
cd ../../frontend
npm install
npm run dev
```

Документация API (Swagger UI): `http://localhost:8000/docs`

---

## Настройка переменных окружения

### Backend (`backend/core-api/.env`)
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_DB=messenger_ren

SECRET_KEY=your_super_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Логи/сервер
LOG_LEVEL=INFO
API_HOST=0.0.0.0
API_PORT=8000
RELOAD=true
UVICORN_LOG_LEVEL=info

# CORS (опционально, через запятую)
# CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:3000/ws
```

### Realtime‑service (`backend/realtime-service/.env`)
```env
WS_PORT=3000
CORE_API_URL=http://localhost:8000
```

Примечания:
- В проде URL задаются соответствующе окружению.
- Для Vite все переменные клиентской сборки должны начинаться с `VITE_`.

---

## Запуск сервисов

### Backend (FastAPI)
```bash
cd backend/core-api
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### Realtime (WebSocket)
```bash
cd backend/realtime-service
npm install
npm run dev
# слушает ws на ws://localhost:3000/ws
```

### Frontend (Vite)
```bash
cd frontend
npm install
npm run dev
# откроется на http://localhost:5173
```

---

## Краткая документация API

Авторизация: JWT через заголовок `Authorization: Bearer <token>`.

Основные эндпоинты (REST):
- `POST /register_step1` — регистрация, шаг 1 (создание пользователя, выдача access key)
- `POST /register_step2` — регистрация, шаг 2 (сохранение зашифрованного приватного ключа по access key)
- `POST /login` — вход, выдаёт JWT и криптоданные
- `GET /user` — профиль текущего пользователя
- `POST /user/update/name` — обновить `userName`
- `POST /user/update/avatar` — загрузка аватара
- `GET /user/chats` — список чатов с информацией о собеседниках и последнем сообщении
- `POST /chat/create` — создать (или вернуть) чат
- `GET /chat/{chatId}/messages` — сообщения чата
- `POST /chat/massage` — отправка сообщения (шифртекст/метаданные/файлы)

Файлы и видео (REST):
- `POST /chat/upload_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}` — загрузка чанка
- `POST /chat/upload_metadata/{chat_id}/{message_id}/{file_id}` — метаданные видео
- `GET /chat/file_metadata/{chat_id}/{message_id}/{file_id}` — получить метаданные
- `GET /chat/file_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}` — получить чанк
- `GET /chat/file/{file_path}` — получить содержимое файла (base64)

WebSocket (Realtime):
- Путь: `/ws`
- Регистрация в чате, отправка/получение событий сообщений и статусов «онлайн»

Пример запроса входа:
```bash
curl -X POST "http://localhost:8000/login" \
  -H "Content-Type: application/json" \
  -d '{"login":"testuser","password":"your_password_hash_or_password"}'
```

---

## Модель E2EE: как это работает

Регистрация:
- Клиент генерирует пару ключей ECDH P‑256
- Деривирует мастер‑ключ (PBKDF2‑SHA256, 100k итераций) из пароля + соли
- Шифрует приватный ключ мастер‑ключом
- Сервер генерирует и отдаёт access key; клиент шифрует приватный ключ ещё и им

Вход:
- Сервер возвращает JWT и криптоданные (публичный ключ, соль, зашифрованный приватный ключ)
- Клиент деривирует ключ, расшифровывает приватный ключ и хранит его только в памяти (и IndexedDB как CryptoKey — при включённом сохранении)

Восстановление:
- По access key запрашивается соответствующая версия зашифрованного приватного ключа, далее — смена пароля и перешифровка

---

## Работа с файлами и чанками
- Малые файлы передаются как часть сообщения (E2EE шифрование на клиенте)
- Большие файлы и видео — чанковая передача через HTTP эндпоинты
- Метаданные видео (nonce для чанков, размеры, типы) хранятся отдельно
- Локальный кеш (IndexedDB) ускоряет повторный просмотр; старые файлы очищаются автоматически

---

## Безопасность и best practices
- Приватные ключи никогда не покидают клиент в открытом виде
- Пароли на сервер не передаются в открытом виде
- JWT с корректными сроками жизни
- Логи без чувствительных данных; уровень логов управляется `LOG_LEVEL`
- CORS управляется `CORS_ORIGINS`
- Рекомендуется включать rate limiting на критичных эндпоинтах

---

## Разработка и скрипты

Backend (FastAPI):
- Установка: `pip install -r requirements.txt`
- Запуск: `uvicorn app:app --host 0.0.0.0 --port 8000 --reload`
- Тесты: см. `backend/core-api/tests/`

Realtime (Node.js):
- Установка: `npm install`
- Запуск: `npm run dev`

Frontend (Vite):
- Установка: `npm install`
- Разработка: `npm run dev`
- Сборка: `npm run build`
- Lint: `npm run lint`

---

## FAQ и устранение неполадок
- Ошибки CORS: укажите корректные домены в `CORS_ORIGINS`
- Не подключается WebSocket: проверьте `VITE_WS_URL` и что realtime‑service запущен
- Сообщения не расшифровываются: убедитесь, что приватный ключ загружен/разблокирован на клиенте
- Проблемы с большими файлами: проверьте стабильность сети и конфигурацию чанков; изучите логи backend

---

## Roadmap
- Групповые чаты (E2EE)
- Голосовые и видеозвонки (E2EE)
- Оптимизация производительности файлового контура
- Мобильное приложение (iOS/Android) с совместимым E2EE
- CI/CD, мониторинг, расширенные метрики

---

## Лицензия
MIT — см. `LICENSE.md`.

При создании форка, использовании всего проекта или его частей **обязательно** указывайте:
- Ссылку на автора: [https://github.com/Taiidzy](https://github.com/Taiidzy)  
- Ссылку на проект: [https://github.com/Taiidzy/Messanger-Ren](https://github.com/Taiidzy/Messanger-Ren)  

Это требование основано на условиях лицензии MIT и направлено на сохранение авторства и исходных ссылок.
