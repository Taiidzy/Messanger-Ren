// Импорт внешних зависимостей
const WebSocket = require('ws');
const http = require('http');
const axios = require('axios'); // Улучшенный HTTP-клиент для взаимодействия с БД
const winston = require('winston'); // Профессиональная библиотека для логгирования

// --- Конфигурация логгера (Winston) ---
const logger = winston.createLogger({
  level: 'info', // Минимальный уровень логов для отображения (info, warn, error)
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Добавляем временную метку
    winston.format.printf(info => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`) // Форматируем вывод
  ),
  transports: [
    // В данном случае выводим все логи в консоль
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(), // Раскрашиваем вывод для наглядности
            winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
        )
    }),
    // При необходимости можно добавить сохранение логов в файл:
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// --- Константы для типов сообщений ---
const MESSAGE_TYPES = {
    // Существующие типы для чата
    REGISTER: 'register',
    MESSAGE: 'message',
    REGISTERED: 'registered',
    NEW_MESSAGE: 'new_message',
    MESSAGE_SENT: 'message_sent',
    ERROR: 'error',
    
    // Новые типы для статуса онлайн
    STATUS_REGISTER: 'status_register',
    STATUS_REGISTERED: 'status_registered',
    STATUS_UPDATE: 'status_update',
    CONTACT_STATUS: 'contact_status'
};

/**
 * Класс ChatServer управляет WebSocket-соединениями, комнатами чатов, 
 * статусами пользователей и взаимодействием с базой данных.
 */
class ChatServer {
    /**
     * @param {number} port Порт для запуска WebSocket сервера.
     * @param {string} dbServerUrl URL для отправки сообщений на сохранение в БД.
     * @param {string} authServerUrl URL для проверки токенов аутентификации.
     */
    constructor(
        port = Number(process.env.WS_PORT || 3000),
        dbServerUrl = process.env.CORE_API_URL ? `${process.env.CORE_API_URL}/chat/massage` : 'http://localhost:8000/chat/massage',
        authServerUrl = process.env.CORE_API_URL ? `${process.env.CORE_API_URL}/auth/verify` : 'http://localhost:8000/auth/verify'
    ) {
        this.port = port;
        this.dbServerUrl = dbServerUrl;
        this.authServerUrl = authServerUrl;

        // Map для хранения данных о клиентах чата. Ключ - объект WebSocket (ws), значение - информация о клиенте.
        this.clients = new Map();

        // Map для группировки клиентов по чатам. Ключ - ID чата, значение - Set объектов WebSocket.
        this.chatRooms = new Map();
        
        // --- НОВЫЕ СТРУКТУРЫ ДЛЯ СТАТУСА ОНЛАЙН ---
        
        // Map для хранения пользователей со статусом онлайн
        // Ключ - user_id, значение - { ws, contacts: Set([contact_ids]), lastSeen: Date }
        this.onlineUsers = new Map();
        
        // Map для быстрого поиска WebSocket по user_id
        // Ключ - user_id, значение - WebSocket объект
        // Map для хранения токенов и соответствующих им user_id
        // Ключ - WebSocket, значение - { token, user_id }
        this.tokenCache = new Map();
        
        // Map для быстрого поиска WebSocket по user_id
        // Ключ - user_id, значение - WebSocket объект
        this.userConnections = new Map();
        
        // НОВОЕ: Map для хранения информации о последнем времени онлайн пользователей
        // Ключ - user_id, значение - { lastSeen: string, contacts: Set([contact_ids]) }
        this.offlineUsers = new Map();
        
        this.init();
    }
    
    /**
     * Инициализирует и запускает HTTP и WebSocket серверы.
     */
    init() {
        // Создаем стандартный HTTP сервер. Он нужен как "основа" для WebSocket сервера.
        this.server = http.createServer();

        // Создаем WebSocket сервер, но не привязываем его напрямую к серверу, чтобы фильтровать путь
        this.wss = new WebSocket.Server({ noServer: true });

        // Обработка upgrade только для /ws
        this.server.on('upgrade', (request, socket, head) => {
            if (request.url === '/ws') {
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit('connection', ws, request);
                });
            } else {
                socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                socket.destroy();
            }
        });

        // Устанавливаем обработчик на событие 'connection' - новое подключение.
        this.wss.on('connection', (ws, req) => {
            // req - объект входящего запроса, можно получить IP и другие заголовки
            const ip = req.socket.remoteAddress;
            logger.info(`Новое подключение от IP: ${ip}`);

            // Обработчик входящих сообщений от этого клиента
            ws.on('message', (data) => this.handleMessage(ws, data));

            // Обработчик закрытия соединения
            ws.on('close', () => this.handleDisconnect(ws));

            // Обработчик ошибок
            ws.on('error', (error) => logger.error(`Ошибка WebSocket: ${error.message}`));
        });

        // Запускаем HTTP сервер на прослушивание указанного порта.
        this.server.listen(this.port, () => {
            logger.info(`WebSocket сервер запущен на порту ${this.port} (только путь /ws)`);
        });
    }
    
    /**
     * Главный обработчик входящих сообщений. Парсит JSON и направляет на дальнейшую обработку.
     * @param {WebSocket} ws - Экземпляр WebSocket соединения.
     * @param {Buffer} data - Входящие данные в виде Buffer.
     */
    async handleMessage(ws, data) {
        try {
            const parsedData = JSON.parse(data.toString());
            logger.info(`Получено сообщение типа "${parsedData.type}"`);

            // В зависимости от типа сообщения, вызываем соответствующий метод.
            switch (parsedData.type) {
                // Существующие обработчики для чата
                case MESSAGE_TYPES.REGISTER:
                    this.registerUser(ws, parsedData);
                    break;
                case MESSAGE_TYPES.MESSAGE:
                    await this.processMessage(ws, parsedData);
                    break;
                    
                // Новые обработчики для статуса онлайн
                case MESSAGE_TYPES.STATUS_REGISTER:
                    this.registerUserStatus(ws, parsedData);
                    break;
                    
                default:
                    logger.warn(`Получен неизвестный тип сообщения: ${parsedData.type}`);
                    this.sendError(ws, 'Неизвестный тип сообщения');
            }
        } catch (error) {
            logger.error(`Ошибка обработки сообщения (невалидный JSON?): ${error.message}`);
            this.sendError(ws, 'Неверный формат сообщения. Ожидается JSON.');
        }
    }
    
    // --- СУЩЕСТВУЮЩИЕ МЕТОДЫ ДЛЯ ЧАТА ---
    
    /**
     * Регистрирует нового пользователя в системе и добавляет его в комнату чата.
     * @param {WebSocket} ws - Экземпляр WebSocket соединения.
     * @param {object} data - Данные для регистрации ({ token, chat_id }).
     */
    async registerUser(ws, data) {
        const { token, chat_id } = data;
        
        if (!token || !chat_id) {
            this.sendError(ws, 'Для регистрации необходимы token и chat_id.');
            return;
        }
        
        try {
            // Проверяем токен через auth сервер
            const user_id = await this.verifyToken(token);
            
            const clientInfo = { user_id, chat_id, ws, token };
            this.clients.set(ws, clientInfo);
            this.tokenCache.set(ws, { token, user_id });
            
            // Если комнаты для этого чата еще нет, создаем ее.
            if (!this.chatRooms.has(chat_id)) {
                this.chatRooms.set(chat_id, new Set());
            }
            // Добавляем клиента в комнату.
            this.chatRooms.get(chat_id).add(ws);
            
            logger.info(`Пользователь ${user_id} подключился к чату ${chat_id}.`);
            
            ws.send(JSON.stringify({
                type: MESSAGE_TYPES.REGISTERED,
                message: 'Успешно подключен к чату.'
            }));
            
        } catch (error) {
            logger.error(`Ошибка аутентификации при регистрации в чат: ${error.message}`);
            if (error.message.includes('401')) {
                this.sendError(ws, 'Недействительный токен аутентификации.');
            } else {
                this.sendError(ws, 'Ошибка проверки токена.');
            }
        }
    }
    
    /**
     * Обрабатывает новое сообщение чата: сохраняет в БД и рассылает участникам.
     * @param {WebSocket} ws - Экземпляр WebSocket соединения отправителя.
     * @param {object} data - Данные сообщения ({ message, original_user_id, message_type }).
     */
    async processMessage(ws, parsedData) {
        const clientInfo = this.clients.get(ws);
        
        if (!clientInfo) {
            this.sendError(ws, 'Пользователь не зарегистрирован. Отправьте сперва сообщение о регистрации.');
            return;
        }
        
        // Получаем фактические данные сообщения из вложенного поля 'data'
        const messagePayload = parsedData.data;

        const newMessage = {
            id: messagePayload.id,
            chat_id: clientInfo.chat_id,
            sender_id: messagePayload.sender_id || clientInfo.user_id, 
            message_type: messagePayload.message_type || 'text',
            created_at: messagePayload.created_at,
            edited_at: messagePayload.edited_at,
            is_read: messagePayload.is_read,
            ciphertext: messagePayload.ciphertext || '',
            nonce: messagePayload.nonce || '',
            metadata: messagePayload.metadata || null,
            envelopes: messagePayload.envelopes || {},
            metadata: messagePayload.metadata || null
        };
        
        logger.info(`Обработка сообщения от user_id: ${newMessage.sender_id} в chat_id: ${newMessage.chat_id}`);
        
        try {
            // 1. Сохраняем сообщение в базу данных
            const savedMessage = await this.saveMessageToDatabase(newMessage);
            
            // 2. Обновляем ID сообщения на тот, который вернула БД
            const messageWithDbId = {
                ...newMessage,
                id: savedMessage.message_id || newMessage.id
            };
            
            // 3. Рассылаем сообщение всем участникам чата (включая подтверждение отправителю)
            this.broadcastToChat(clientInfo.chat_id, messageWithDbId, ws);
            
        } catch (error) {
            logger.error(`Ошибка при сохранении или рассылке сообщения: ${error.message}`);
            this.sendError(ws, 'Произошла ошибка при обработке вашего сообщения.');
        }
    }
    
    /**
     * Сохраняет сообщение в БД, отправляя POST-запрос. Использует axios для простоты и надежности.
     * @param {object} messageData - Объект сообщения для сохранения.
     * @returns {Promise<object>} - Промис, который разрешается сохраненным объектом из ответа БД.
     */
    async saveMessageToDatabase(messageData) {
        try {
            logger.info(`Отправка сообщения в БД по адресу: ${this.dbServerUrl}`);
            const response = await axios.post(this.dbServerUrl, messageData, {
                headers: { 'Content-Type': 'application/json' }
            });

            logger.info(`Сообщение успешно сохранено в БД. Статус: ${response.status}`);
            // Возвращаем данные, которые вернул сервер БД (может содержать, например, финальный ID)
            return response.data;
        } catch (error) {
            const errorMessage = error.response 
                ? `HTTP ошибка: ${error.response.status} - ${JSON.stringify(error.response.data)}`
                : `Сетевая ошибка: ${error.message}`;

            logger.error(`Ошибка запроса к БД: ${errorMessage}`);
            // Пробрасываем ошибку выше, чтобы ее можно было обработать в processMessage
            throw new Error('Не удалось сохранить сообщение в базу данных.');
        }
    }
    
    /**
     * Рассылает сообщение всем участникам указанного чата.
     * @param {string|number} chatId - ID чата для рассылки.
     * @param {object} message - Объект сообщения для отправки.
     * @param {WebSocket} senderWs - Сокет отправителя, чтобы не отправлять ему то же самое сообщение.
     */
    broadcastToChat(chatId, message, senderWs) {
        const chatClients = this.chatRooms.get(chatId);
        
        if (!chatClients) {
            logger.warn(`Попытка рассылки в несуществующий чат ${chatId}`);
            return;
        }
        
        // Сообщение для всех остальных участников чата
        const messageForOthers = JSON.stringify({
            type: MESSAGE_TYPES.NEW_MESSAGE,
            data: message
        });

        // Сообщение-подтверждение для отправителя (с полным сообщением для правильного отображения файлов)
        const confirmationForSender = JSON.stringify({
            type: MESSAGE_TYPES.NEW_MESSAGE, // Используем NEW_MESSAGE вместо MESSAGE_SENT
            data: message
        });
        
        chatClients.forEach(clientWs => {
            // Проверяем, что клиент все еще онлайн
            if (clientWs.readyState === WebSocket.OPEN) {
                if (clientWs === senderWs) {
                    // Отправляем полное сообщение отправителю для правильного отображения файлов
                    clientWs.send(confirmationForSender);
                } else {
                    // Отправляем новое сообщение всем остальным
                    clientWs.send(messageForOthers);
                }
            }
        });
        
        logger.info(`Сообщение разослано ${chatClients.size} участникам чата ${chatId}`);
    }
    
    // --- НОВЫЕ МЕТОДЫ ДЛЯ СТАТУСА ОНЛАЙН ---
    
    /**
     * Проверяет токен через auth сервер и возвращает user_id.
     * @param {string} token - Токен для проверки.
     * @returns {Promise<number>} - Промис, который разрешается user_id.
     */
    async verifyToken(token) {
        try {
            logger.info(`Проверка токена через auth сервер: ${this.authServerUrl}`);
            const response = await axios.get(this.authServerUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 200 && response.data.user_id) {
                logger.info(`Токен валиден для пользователя ${response.data.user_id}`);
                return response.data.user_id;
            } else {
                throw new Error('Неверный ответ от auth сервера');
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                logger.warn(`Недействительный токен: ${token.substring(0, 10)}...`);
                throw new Error('401: Недействительный токен');
            }
            
            const errorMessage = error.response 
                ? `HTTP ошибка: ${error.response.status} - ${JSON.stringify(error.response.data)}`
                : `Сетевая ошибка: ${error.message}`;

            logger.error(`Ошибка проверки токена: ${errorMessage}`);
            throw new Error('Ошибка проверки токена на auth сервере');
        }
    }
    
    /**
     * Регистрирует пользователя для отслеживания статуса онлайн.
     * @param {WebSocket} ws - Экземпляр WebSocket соединения.
     * @param {object} data - Данные для регистрации ({ token, contacts: [contact_ids] }).
     */
    async registerUserStatus(ws, data) {
        const { token, contacts } = data;
        
        if (!token || !Array.isArray(contacts)) {
            this.sendError(ws, 'Для регистрации статуса необходимы token и массив contacts.');
            return;
        }
        
        try {
            // Проверяем токен через auth сервер
            const user_id = await this.verifyToken(token);
            
            // Если пользователь уже был онлайн, закрываем предыдущее соединение
            if (this.onlineUsers.has(user_id)) {
                const oldConnection = this.onlineUsers.get(user_id);
                if (oldConnection.ws !== ws && oldConnection.ws.readyState === WebSocket.OPEN) {
                    oldConnection.ws.close();
                    logger.info(`Закрыто предыдущее соединение для пользователя ${user_id}`);
                }
            }
            
            // Создаем Set из контактов для быстрого поиска
            const contactsSet = new Set(contacts);
            
            // Сохраняем информацию о пользователе
            this.onlineUsers.set(user_id, {
                ws: ws,
                contacts: contactsSet,
                token: token,
                lastSeen: new Date() // НОВОЕ: добавляем текущее время как время последней активности
            });
            
            // Сохраняем связь WebSocket -> user_id для быстрого поиска
            this.userConnections.set(ws, user_id);
            this.tokenCache.set(ws, { token, user_id });
            
            // НОВОЕ: Если пользователь был в офлайне, удаляем его оттуда
            if (this.offlineUsers.has(user_id)) {
                this.offlineUsers.delete(user_id);
                logger.info(`Пользователь ${user_id} удален из списка офлайн пользователей`);
            }
            
            logger.info(`Пользователь ${user_id} зарегистрирован для отслеживания статуса с ${contacts.length} контактами.`);
            
            // Отправляем подтверждение регистрации
            ws.send(JSON.stringify({
                type: MESSAGE_TYPES.STATUS_REGISTERED,
                message: 'Успешно зарегистрирован для отслеживания статуса.'
            }));
            
            // Уведомляем контакты о том, что пользователь стал онлайн
            this.notifyContactsStatusChange(user_id, 'online', contactsSet);
            
            // Отправляем пользователю статусы его контактов
            this.sendContactsStatuses(ws, user_id, contactsSet);
            
        } catch (error) {
            logger.error(`Ошибка аутентификации при регистрации статуса: ${error.message}`);
            if (error.message.includes('401')) {
                this.sendError(ws, 'Недействительный токен аутентификации.');
            } else {
                this.sendError(ws, 'Ошибка проверки токена.');
            }
        }
    }
    
    /**
     * Уведомляет контакты пользователя об изменении его статуса.
     * @param {string|number} userId - ID пользователя, чей статус изменился.
     * @param {string} status - Новый статус ('online' или 'offline').
     * @param {Set} userContacts - Контакты пользователя.
     * @param {string} [lastSeen] - Время последней активности (только для статуса 'offline').
     */
    notifyContactsStatusChange(userId, status, userContacts, lastSeen = null) {
        if (!userContacts || userContacts.size === 0) {
            logger.warn(`Не найдены контакты для пользователя ${userId}`);
            return;
        }
        
        const statusMessage = JSON.stringify({
            type: MESSAGE_TYPES.CONTACT_STATUS,
            data: {
                user_id: userId,
                status: status,
                timestamp: new Date().toISOString(),
                last_seen: lastSeen // НОВОЕ: добавляем last_seen в уведомление
            }
        });
        
        let notifiedCount = 0;
        
        // Проходим по всем онлайн пользователям и проверяем, есть ли наш пользователь в их контактах
        this.onlineUsers.forEach((onlineUserInfo, onlineUserId) => {
            // Не уведомляем самого пользователя
            if (onlineUserId === userId) return;
            
            // Проверяем, есть ли наш пользователь в контактах этого онлайн пользователя
            if (onlineUserInfo.contacts.has(userId)) {
                if (onlineUserInfo.ws.readyState === WebSocket.OPEN) {
                    onlineUserInfo.ws.send(statusMessage);
                    notifiedCount++;
                }
            }
        });
        
        logger.info(`Уведомлено ${notifiedCount} контактов о смене статуса пользователя ${userId} на ${status}${lastSeen ? ` (last_seen: ${lastSeen})` : ''}`);
    }
    
    /**
     * Отправляет пользователю статусы всех его контактов.
     * @param {WebSocket} ws - Сокет пользователя.
     * @param {string|number} userId - ID пользователя.
     * @param {Set} contacts - Set с ID контактов пользователя.
     */
    sendContactsStatuses(ws, userId, contacts) {
        const contactStatuses = [];
        
        contacts.forEach(contactId => {
            let status = 'offline';
            let lastSeen = null;
            
            // ОБНОВЛЕНО: проверяем статус контакта и получаем last_seen
            if (this.onlineUsers.has(contactId)) {
                status = 'online';
                lastSeen = this.onlineUsers.get(contactId).lastSeen.toISOString();
            } else if (this.offlineUsers.has(contactId)) {
                // Если пользователь в офлайне, получаем его последнее время активности
                status = 'offline';
                lastSeen = this.offlineUsers.get(contactId).lastSeen; // Уже строка
            }
                
            contactStatuses.push({
                user_id: contactId,
                status: status,
                last_seen: lastSeen
            });
        });
        
        const statusesMessage = JSON.stringify({
            type: MESSAGE_TYPES.STATUS_UPDATE,
            data: {
                contacts: contactStatuses
            }
        });
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(statusesMessage);
            logger.info(`Отправлены статусы ${contactStatuses.length} контактов пользователю ${userId}`);
        }
    }
    
    /**
     * Обрабатывает отключение клиента: удаляет его из списков и из комнаты чата.
     * @param {WebSocket} ws - Экземпляр отключаемого WebSocket соединения.
     */
    handleDisconnect(ws) {
        // Логика отключения из чата
        const clientInfo = this.clients.get(ws);
        if (clientInfo) {
          const { user_id, chat_id } = clientInfo;
          const chatRoom = this.chatRooms.get(chat_id);
          if (chatRoom) {
            chatRoom.delete(ws);
            if (chatRoom.size === 0) {
              this.chatRooms.delete(chat_id);
              logger.info(`Чат ${chat_id} пуст и был удален.`);
            }
          }
          this.clients.delete(ws);
          logger.info(`Пользователь ${user_id} отключился от чата ${chat_id}.`);
        }
    
        // ОБНОВЛЕНО: Логика отключения для статуса онлайн с сохранением lastSeen
        const userId = this.userConnections.get(ws);
        if (userId) {
          // Получаем информацию о пользователе перед удалением
          const userInfo = this.onlineUsers.get(userId);
          
          if (userInfo) {
            // НОВОЕ: Сохраняем информацию о пользователе в офлайн статусе
            const currentTime = new Date().toISOString();
            
            // ИСПРАВЛЕНО: Сначала сохраняем в offlineUsers
            this.offlineUsers.set(userId, {
              lastSeen: currentTime,
              contacts: userInfo.contacts // Сохраняем контакты для уведомлений
            });
            
            // Удаляем пользователя из онлайн списков ПЕРЕД уведомлением
            this.onlineUsers.delete(userId);
            this.userConnections.delete(ws);
            this.tokenCache.delete(ws);
            
            // ЗАТЕМ уведомляем контакты об офлайне с указанием времени последней активности
            this.notifyContactsStatusChange(userId, 'offline', userInfo.contacts, currentTime);
            
            logger.info(`Пользователь ${userId} помечен как офлайн. Последняя активность: ${currentTime}`);
          } else {
            // Если userInfo не найден, просто удаляем связи
            this.onlineUsers.delete(userId);
            this.userConnections.delete(ws);
            this.tokenCache.delete(ws);
          }
        }
    
        if (!clientInfo && !userId) {
          logger.warn('Неизвестный клиент отключился.');
        }
      }
    
    
    /**
     * Отправляет сообщение об ошибке конкретному клиенту.
     * @param {WebSocket} ws - Сокет клиента.
     * @param {string} errorMessage - Текст ошибки.
     */
    sendError(ws, errorMessage) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: MESSAGE_TYPES.ERROR,
                message: errorMessage
            }));
        }
    }
    
    /**
     * Собирает и возвращает статистику по работе сервера.
     * @returns {object} - Объект со статистикой.
     */
    getStats() {
        return {
            // Статистика чата
            connectedClients: this.clients.size,
            activeChats: this.chatRooms.size,
            chatDetails: Array.from(this.chatRooms.entries()).map(([chatId, clients]) => ({
                chatId,
                clientsCount: clients.size,
                users: Array.from(clients).map(ws => this.clients.get(ws)?.user_id)
            })),
            
            // Статистика онлайн статусов
            onlineUsers: this.onlineUsers.size,
            onlineUsersDetails: Array.from(this.onlineUsers.entries()).map(([userId, userInfo]) => ({
                userId,
                contactsCount: userInfo.contacts.size,
                lastSeen: userInfo.lastSeen.toISOString(),
                contacts: Array.from(userInfo.contacts),
                hasToken: !!userInfo.token
            })),
            
            // НОВОЕ: Статистика офлайн пользователей
            offlineUsers: this.offlineUsers.size,
            offlineUsersDetails: Array.from(this.offlineUsers.entries()).map(([userId, userInfo]) => ({
                userId,
                lastSeen: userInfo.lastSeen,
                contactsCount: userInfo.contacts.size,
                contacts: Array.from(userInfo.contacts)
            }))
        };
    }
}

// --- Запуск Сервера ---
require('dotenv').config();
new ChatServer();