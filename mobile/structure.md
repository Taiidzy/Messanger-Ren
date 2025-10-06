messenger_project/
├── android/                # Специфичные файлы для Android
├── ios/                    # Специфичные файлы для iOS
├── lib/                    # Основная папка с кодом Dart
│   ├── main.dart           # Главная точка входа в приложение
│   │
│   ├── core/               # Ядро приложения (общие компоненты)
│   │   ├── api/            # Взаимодействие с API (WebSocket, HTTP)
│   │   ├── config/         # Конфигурация (темы, роутинг, константы)
│   │   ├── encryption/     # Логика E2EE (генерация ключей, шифрование)
│   │   ├── models/         # Общие модели данных (User, Message)
│   │   ├── services/       # Абстрактные сервисы (AuthService, ChatService)
│   │   ├── storage/        # Локальное хранилище (secure_storage, hive)
│   │   └── utils/          # Вспомогательные утилиты (форматтеры, валидаторы)
│   │
│   └── ui/       # Слой представления (UI)
│       ├── pages/          # Экраны приложения
│       │   ├── auth/
│       │   │   ├── auth_page.dart
│       │   │   └── components/
│       │   │       ├── login_omponent.dart
│       │   │       ├── register_omponent.dart
│       │   │       └── recovery_omponent.dart
│       │   ├── chat/
│       │   │   ├── chat_list_page.dart
│       │   │   └── conversation_page.dart
│       │   ├── splash_screen/
│       │   │   └── splash_screen.dart
│       │   └── settings/
│       │       └── settings_page.dart
│       │
│       └── widgets/        # Переиспользуемые виджеты
│           ├── custom_button.dart
│           └── message_bubble.dart
│
├── assets/                 # Ресурсы (изображения, шрифты, JSON)
│
└── pubspec.yaml            # Файл зависимостей и конфигурации проекта