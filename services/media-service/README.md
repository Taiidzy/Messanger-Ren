## Media Service

Сервис для загрузки/хранения зашифрованных файлов по чанкам для чатов. Аутентификация происходит через `auth-service`.

### Стек
- FastAPI
- PostgreSQL (доступ к таблицам `chat_{id}` и `chat_{id}_files`)
- Nginx как reverse-proxy `/media-service/`

### Структура
```
services/media-service/
  ├─ app/
  │  ├─ app.py
  │  ├─ core/
  │  │  ├─ config.py
  │  │  └─ auth.py
  │  ├─ routers/
  │  │  └─ media.py
  │  └─ db.py
  ├─ requirements.txt
  └─ Dockerfile
```

### Переменные окружения
- `APP_PORT` (default 8003)
- `AUTH_HOST` (пример: `http://auth-service:8001`)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_SSLMODE`
- `STORAGE_ROOT` (default `storage`)

### Маршруты
- `POST /media-service/upload_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}`
  Загружает зашифрованный чанк файла. Тело: `{ chunk: base64, nonce: string }`

- `POST /media-service/upload_metadata/{chat_id}/{message_id}/{file_id}`
  Сохраняет метаданные: `{ filename, mimetype, size, chunk_count, chunk_size, nonces, duration? }`

- `GET /media-service/file_metadata/{chat_id}/{message_id}/{file_id}`
  Возвращает сохранённые метаданные файла.

- `GET /media-service/file_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}`
  Возвращает `{ chunk: base64, nonce, index }`.

- `GET /media-service/file/{file_path}`
  Возвращает `{ encrypted_data, file_path }` для небольших файлов.

- `GET /media-service/messages/{chat_id}/{message_id}/files`
  Возвращает файлы сообщения по данным в `chat_{chat_id}_files` и metadata из `chat_{chat_id}`.

Все запросы требуют заголовок `Authorization: Bearer <token>`.

### Примеры
Загрузка чанка:
```
POST /media-service/upload_chunk/1/123/999/0
Authorization: Bearer <token>
{
  "chunk": "<base64>",
  "nonce": "<base64>"
}
```

Получение чанка:
```
GET /media-service/file_chunk/1/123/999/0
Authorization: Bearer <token>
```

### Nginx
Проксируется по пути `/media-service/` (см. `docker-services/nginx/nginx.conf`).

### Compose
Сервис добавлен в `compose.yaml` как `media-service` и доступен другим сервисам в сети `app-network`.