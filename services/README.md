## Структура микросервисов

## Содержание
- [Структура](#структура)
- [Детали сервисов](#детали-сервисов)
- [Легенда статусов](#легенда-статусов)

---

## Структура

```
services/               
├─ auth-service/                # Сервис управления аккаунтами
├─ chat-service/                # Сервис чатов
├─ media-service/               # Сервис для обмена большими файлами
├─ message-service/             # Сервис для обмена сообщениями
├─ online-service/              # Сервис управления статусами (Онлайн/Оффлайн)
├─ profiles-service/            # Сервис управляния профилями пользователей
└─ storage-service/             # Сервис хранилища
```

---

## Детали сервисов

| Сервис                                           | Язык       | Статус           |
|--------------------------------------------------|------------|------------------|
| [auth-service](./auth-service/README.md)         |   Python   | 🟡 В разработке |
| [chat-service](./chat-service/README.md)         |     TS     | 🟡 В разработке |
| [media-service](./media-service/README.md)       |    ----    | 🔴 Не начат     |
| [message-service](./message-service/README.md)   |     Go     | 🟡 В разработке |
| [online-service](./online-service/README.md)     |     JS     | ✅ Готов        |
| [profiles-service](./profiles-service/README.md) |    ----    | 🔴 Не начат     |
| [storage-service](./storage-service/README.md)   |    ----    | 🔴 Не начат     |

### Легенда статусов:
- ✅ Готов - сервис завершен и протестирован
- 🟡 В разработке - активная разработка
- 🔴 Не начат - разработка ещё не начиналась