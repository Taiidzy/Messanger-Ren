// ================== Импорты ==================
const WebSocket = require('ws');
const http = require('http');
const axios = require('axios');
const winston = require('winston');
const redis = require('redis');

// ================== Логгер ==================
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(info => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`)
    ),
    transports: [new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)) })],
  });

// ================== Типы сообщений ==================
const MESSAGE_TYPES = {
    REGISTER: 'register',
    MESSAGE: 'message',
    EDIT_MESSAGE: 'edit_message',
    DELETE_MESSAGE: 'delete_message',
    REGISTERED: 'registered',
    NEW_MESSAGE: 'new_message',
    MESSAGE_SENT: 'message_sent',
    ERROR: 'error',
    STATUS_REGISTER: 'status_register',
    STATUS_REGISTERED: 'status_registered',
    STATUS_UPDATE: 'status_update',
    CONTACT_STATUS: 'contact_status',
    MESSAGE_DELETED: 'message_deleted',
    MESSAGE_EDITED: 'message_edited',
};

// ================== ChatServer ==================

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

        // Map для хранения локальных WebSocket соединений (не может быть заменено на Redis)
        // Ключ - объект WebSocket (ws), значение - информация о клиенте
        this.clients = new Map();
        
        // Map для быстрого поиска WebSocket по user_id (локально)
        this.userConnections = new Map();
        
        // Map для хранения токенов и соответствующих им user_id (локально)
        this.tokenCache = new Map();
        
        // Инициализация Redis клиента
        this.redisClient = null;
        
        this.init();
    }
    
    /**
     * Инициализирует Redis соединение и запускает HTTP и WebSocket серверы.
     */
    async init() {
        try {
            // Инициализация Redis
            this.redisClient = redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });

            this.redisClient.on('error', (err) => {
                logger.error(`Redis ошибка: ${err.message}`);
            });

            this.redisClient.on('connect', () => {
                logger.info('Подключение к Redis установлено');
            });

            await this.redisClient.connect();
            logger.info('Redis клиент подключен успешно');

        } catch (error) {
            logger.error(`Ошибка подключения к Redis: ${error.message}`);
            throw error;
        }

        // Создаем стандартный HTTP сервер
        this.server = http.createServer();

        // Создаем WebSocket сервер
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

        // Обработчик на событие 'connection'
        this.wss.on('connection', (ws, req) => {
            const ip = req.socket.remoteAddress;
            logger.info(`Новое подключение от IP: ${ip}`);

            ws.on('message', (data) => this.handleMessage(ws, data));
            ws.on('close', () => this.handleDisconnect(ws));
            ws.on('error', (error) => logger.error(`Ошибка WebSocket: ${error.message}`));
        });

        // Запускаем HTTP сервер
        this.server.listen(this.port, () => {
            logger.info(`WebSocket сервер запущен на порту ${this.port} (только путь /ws)`);
        });
    }
    
    /**
     * Главный обработчик входящих сообщений.
     * @param {WebSocket} ws - Экземпляр WebSocket соединения.
     * @param {Buffer} data - Входящие данные в виде Buffer.
     */
    async handleMessage(ws, data) {
        try {
            const parsedData = JSON.parse(data.toString());
            logger.info(`Получено сообщение типа "${parsedData.type}"`);

            switch (parsedData.type) {
                case MESSAGE_TYPES.REGISTER:
                    await this.registerUser(ws, parsedData);
                    break;
                case MESSAGE_TYPES.MESSAGE:
                    await this.processMessage(ws, parsedData);
                    break;
                case MESSAGE_TYPES.DELETE_MESSAGE:
                    await this.processDeleteMessage(ws, parsedData);
                    break;
                case MESSAGE_TYPES.EDIT_MESSAGE:
                    await this.processEditMessage(ws, parsedData);
                    break;
                case MESSAGE_TYPES.STATUS_REGISTER:
                    await this.registerUserStatus(ws, parsedData);
                    break;
                    
                default:
                    logger.warn(`Получен неизвестный тип сообщения: ${parsedData.type}`);
                    this.sendError(ws, 'Неизвестный тип сообщения');
            }
        } catch (error) {
            logger.error(`Ошибка обработки сообщения: ${error.message}`);
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
            const user_id = await this.verifyToken(token);
            
            const clientInfo = { user_id, chat_id, ws, token };
            this.clients.set(ws, clientInfo);
            this.tokenCache.set(ws, { token, user_id });
            
            // Добавляем клиента в комнату чата в Redis
            await this.addToChatRoom(chat_id, user_id);
            
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
        };
        
        logger.info(`Обработка сообщения от user_id: ${newMessage.sender_id} в chat_id: ${newMessage.chat_id}`);
        
        try {
            const savedMessage = await this.saveMessageToDatabase(newMessage);
            
            const messageWithDbId = {
                ...newMessage,
                id: savedMessage.message_id || newMessage.id
            };
            
            await this.broadcastToChat(clientInfo.chat_id, messageWithDbId, ws);
            
        } catch (error) {
            logger.error(`Ошибка при сохранении или рассылке сообщения: ${error.message}`);
            this.sendError(ws, 'Произошла ошибка при обработке вашего сообщения.');
        }
    }
    
    /**
     * Сохраняет сообщение в БД, отправляя POST-запрос.
     * @param {object} messageData - Объект сообщения для сохранения.
     * @returns {Promise<object>} - Промис с сохраненным объектом из ответа БД.
     */
    async saveMessageToDatabase(messageData) {
        try {
            logger.info(`Отправка сообщения в БД по адресу: ${this.dbServerUrl}`);
            const response = await axios.post(this.dbServerUrl, messageData, {
                headers: { 'Content-Type': 'application/json' }
            });

            logger.info(`Сообщение успешно сохранено в БД. Статус: ${response.status}`);
            return response.data;
        } catch (error) {
            const errorMessage = error.response 
                ? `HTTP ошибка: ${error.response.status} - ${JSON.stringify(error.response.data)}`
                : `Сетевая ошибка: ${error.message}`;

            logger.error(`Ошибка запроса к БД: ${errorMessage}`);
            throw new Error('Не удалось сохранить сообщение в базу данных.');
        }
    }
    
    /**
     * Рассылает сообщение всем участникам указанного чата.
     * @param {string|number} chatId - ID чата для рассылки.
     * @param {object} message - Объект сообщения для отправки.
     * @param {WebSocket} senderWs - Сокет отправителя.
     */
    async broadcastToChat(chatId, message, senderWs) {
        try {
            // Получаем список участников чата из Redis
            const chatMembers = await this.getChatMembers(chatId);
            
            if (!chatMembers || chatMembers.length === 0) {
                logger.warn(`Нет участников в чате ${chatId}`);
                return;
            }
            
            const messageForOthers = JSON.stringify({
                type: MESSAGE_TYPES.NEW_MESSAGE,
                data: message
            });

            const confirmationForSender = JSON.stringify({
                type: MESSAGE_TYPES.NEW_MESSAGE,
                data: message
            });
            
            let sentCount = 0;
            
            // Отправляем сообщения всем подключенным участникам
            for (const [ws, clientInfo] of this.clients.entries()) {
                if (clientInfo.chat_id == chatId && ws.readyState === WebSocket.OPEN) {
                    if (ws === senderWs) {
                        ws.send(confirmationForSender);
                    } else {
                        ws.send(messageForOthers);
                    }
                    sentCount++;
                }
            }
            
            logger.info(`Сообщение разослано ${sentCount} участникам чата ${chatId}`);
            
        } catch (error) {
            logger.error(`Ошибка рассылки сообщения в чат ${chatId}: ${error.message}`);
        }
    }

    /**
     * Обработка удаления сообщения.
     * @param {WebSocket} ws
     * @param {object} parsedData { data: { chat_id, message_id } }
     */
    async processDeleteMessage(ws, parsedData) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo) {
            this.sendError(ws, 'Пользователь не зарегистрирован.');
            return;
        }
        const tokenInfo = this.tokenCache.get(ws);
        const token = tokenInfo?.token;
        const { chat_id, message_id } = parsedData.data || {};
        if (!chat_id || !message_id) {
            this.sendError(ws, 'Для удаления необходимы chat_id и message_id.');
            return;
        }
        const baseUrl = process.env.CORE_API_URL || 'http://localhost:8000';
        const url = `${baseUrl}/chat/${chat_id}/messages/${message_id}`;
        try {
            const resp = await axios.delete(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                }
            });
            if (resp.status === 200) {
                await this.broadcastDeleteToChat(chat_id, message_id);
            } else {
                this.sendError(ws, `Не удалось удалить сообщение: ${resp.status}`);
            }
        } catch (error) {
            const msg = error.response ? `HTTP ${error.response.status}` : error.message;
            logger.error(`Ошибка удаления сообщения: ${msg}`);
            this.sendError(ws, 'Ошибка при удалении сообщения');
        }
    }

    /**
     * Рассылает событие удаления сообщения всем участникам чата.
     */
    async broadcastDeleteToChat(chatId, messageId) {
        try {
            const payload = JSON.stringify({
                type: MESSAGE_TYPES.MESSAGE_DELETED,
                data: { message_id: messageId }
            });
            
            let sentCount = 0;
            for (const [ws, clientInfo] of this.clients.entries()) {
                if (clientInfo.chat_id == chatId && ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                    sentCount++;
                }
            }
            
            logger.info(`Удаление сообщения ${messageId} разослано ${sentCount} участникам чата ${chatId}`);
        } catch (error) {
            logger.error(`Ошибка рассылки удаления сообщения: ${error.message}`);
        }
    }

    /**
     * Обработка редактирования сообщения.
     * @param {WebSocket} ws
     * @param {object} parsedData { data: { id, chat_id, ciphertext, nonce, envelopes, message_type, metadata } }
     */
    async processEditMessage(ws, parsedData) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo) {
            this.sendError(ws, 'Пользователь не зарегистрирован.');
            return;
        }
        const tokenInfo = this.tokenCache.get(ws);
        const token = tokenInfo?.token;
        const data = parsedData.data || {};
        const { id, chat_id } = data;
        if (!id || !chat_id) {
            this.sendError(ws, 'Для редактирования необходимы id и chat_id.');
            return;
        }
        const baseUrl = process.env.CORE_API_URL || 'http://localhost:8000';
        const url = `${baseUrl}/chat/${chat_id}/messages/${id}`;
        
        const payload = {};
        if (data.ciphertext !== undefined) payload.ciphertext = data.ciphertext;
        if (data.nonce !== undefined) payload.nonce = data.nonce;
        if (data.envelopes !== undefined) payload.envelopes = data.envelopes;
        if (data.message_type !== undefined) payload.message_type = data.message_type;
        if (data.metadata !== undefined) payload.metadata = data.metadata;
        
        try {
            const resp = await axios.patch(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                }
            });
            if (resp.status === 200) {
                const editedMessage = {
                    id: id,
                    chat_id: chat_id,
                    sender_id: clientInfo.user_id,
                    ciphertext: data.ciphertext || '',
                    nonce: data.nonce || '',
                    envelopes: data.envelopes || {},
                    message_type: data.message_type || 'text',
                    metadata: data.metadata || [],
                    edited_at: new Date().toISOString(),
                };
                await this.broadcastEditToChat(chat_id, editedMessage);
            } else {
                this.sendError(ws, `Не удалось обновить сообщение: ${resp.status}`);
            }
        } catch (error) {
            const msg = error.response ? `HTTP ${error.response.status}` : error.message;
            logger.error(`Ошибка редактирования сообщения: ${msg}`);
            this.sendError(ws, 'Ошибка при редактировании сообщения');
        }
    }

    /**
     * Рассылает событие редактирования сообщения всем участникам чата.
     */
    async broadcastEditToChat(chatId, message) {
        try {
            const payload = JSON.stringify({
                type: MESSAGE_TYPES.MESSAGE_EDITED,
                data: message
            });
            
            let sentCount = 0;
            for (const [ws, clientInfo] of this.clients.entries()) {
                if (clientInfo.chat_id == chatId && ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                    sentCount++;
                }
            }
            
            logger.info(`Редактирование сообщения ${message.id} разослано ${sentCount} участникам чата ${chatId}`);
        } catch (error) {
            logger.error(`Ошибка рассылки редактирования сообщения: ${error.message}`);
        }
    }
    
    // --- НОВЫЕ МЕТОДЫ ДЛЯ СТАТУСА ОНЛАЙН (с Redis) ---
    
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
            const user_id = await this.verifyToken(token);
            
            logger.info(`Регистрируем пользователя ${user_id} со следующими контактами: [${contacts.join(', ')}]`);
            
            // Если пользователь уже был онлайн, закрываем предыдущее соединение
            const existingWs = this.userConnections.get(user_id);
            if (existingWs && existingWs !== ws && existingWs.readyState === WebSocket.OPEN) {
                existingWs.close();
                logger.info(`Закрыто предыдущее соединение для пользователя ${user_id}`);
            }
            
            // Сохраняем информацию о пользователе в Redis
            await this.setUserOnline(user_id, contacts, token);
            
            // Удаляем из офлайна если был там
            await this.removeUserOffline(user_id);
            
            // Сохраняем локальные связи
            this.userConnections.set(user_id, ws);
            this.tokenCache.set(ws, { token, user_id });
            
            logger.info(`Пользователь ${user_id} зарегистрирован для отслеживания статуса с ${contacts.length} контактами.`);
            logger.debug(`Локальные соединения после регистрации: [${Array.from(this.userConnections.keys()).join(', ')}]`);
            
            // Проверяем что данные сохранились в Redis
            const savedInfo = await this.getUserOnlineInfo(user_id);
            logger.debug(`Данные в Redis для пользователя ${user_id}: ${JSON.stringify(savedInfo)}`);
            
            ws.send(JSON.stringify({
                type: MESSAGE_TYPES.STATUS_REGISTERED,
                message: 'Успешно зарегистрирован для отслеживания статуса.'
            }));
            
            // Уведомляем контакты о том, что пользователь стал онлайн
            await this.notifyContactsStatusChange(user_id, 'online', new Set(contacts));
            
            // Отправляем пользователю статусы его контактов
            await this.sendContactsStatuses(ws, user_id, new Set(contacts));
            
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
    async notifyContactsStatusChange(userId, status, userContacts, lastSeen = null) {
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
                last_seen: lastSeen
            }
        });
    
        let notifiedCount = 0;
    
        // В userConnections ключ = userId, значение = ws
        for (const [contactUserId, contactWs] of this.userConnections.entries()) {
            try {
                // Пропускаем самого пользователя
                if (contactUserId?.toString() === userId?.toString()) continue;
    
                // Получаем список контактов для онлайн/оффлайн пользователя (возвращает Set строк)
                const contactContacts = await this.getUserContacts(contactUserId);
                if (!contactContacts) continue;
    
                // Если в контактах есть наш пользователь — шлём уведомление
                if (contactContacts.has(userId.toString())) {
                    if (contactWs && contactWs.readyState === WebSocket.OPEN) {
                        contactWs.send(statusMessage);
                        notifiedCount++;
                    } else {
                        logger.debug(`Контакт ${contactUserId} найден, но ws недоступен (readyState: ${contactWs?.readyState})`);
                    }
                }
            } catch (error) {
                logger.error(`Ошибка при уведомлении контакта (contactUserId=${contactUserId}): ${error.message}`);
            }
        }
    
        logger.info(`Уведомлено ${notifiedCount} контактов о смене статуса пользователя ${userId} на ${status}${lastSeen ? ` (last_seen: ${lastSeen})` : ''}`);
    }
    
    
    /**
     * Отправляет пользователю статусы всех его контактов.
     * @param {WebSocket} ws - Сокет пользователя.
     * @param {string|number} userId - ID пользователя.
     * @param {Set} contacts - Set с ID контактов пользователя.
     */
    async sendContactsStatuses(ws, userId, contacts) {
        const contactStatuses = [];
        
        for (const contactId of contacts) {
            try {
                let status = 'offline';
                let lastSeen = null;
                
                const isOnline = await this.isUserOnline(contactId);
                if (isOnline) {
                    status = 'online';
                    const onlineInfo = await this.getUserOnlineInfo(contactId);
                    lastSeen = onlineInfo?.lastSeen;
                } else {
                    const offlineInfo = await this.getUserOfflineInfo(contactId);
                    if (offlineInfo) {
                        lastSeen = offlineInfo.lastSeen;
                    }
                }
                
                contactStatuses.push({
                    user_id: contactId,
                    status: status,
                    last_seen: lastSeen
                });
            } catch (error) {
                logger.error(`Ошибка получения статуса контакта ${contactId}: ${error.message}`);
            }
        }
        
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
     * Обрабатывает отключение клиента.
     * @param {WebSocket} ws - Экземпляр отключаемого WebSocket соединения.
     */
    async handleDisconnect(ws) {
        try {
            // Логика отключения из чата
            const clientInfo = this.clients.get(ws);
            if (clientInfo) {
                const { user_id, chat_id } = clientInfo;
                await this.removeFromChatRoom(chat_id, user_id);
                this.clients.delete(ws);
                logger.info(`Пользователь ${user_id} отключился от чата ${chat_id}.`);
            }

            // Логика отключения для статуса онлайн
            const userId = this.getUserIdByWs(ws);
            if (userId) {
                try {
                    // Получаем информацию о пользователе перед удалением
                    const userInfo = await this.getUserOnlineInfo(userId);
                    
                    if (userInfo) {
                        const currentTime = new Date().toISOString();
                        
                        // Сохраняем информацию в офлайн статусе
                        await this.setUserOffline(userId, userInfo.contacts, currentTime);
                        
                        // Удаляем пользователя из онлайн списков ПЕРЕД уведомлением
                        await this.removeUserOnline(userId);
                        this.userConnections.delete(userId);
                        this.tokenCache.delete(ws);
                        
                        // ЗАТЕМ уведомляем контакты об офлайне
                        const contactsSet = new Set(userInfo.contacts);
                        await this.notifyContactsStatusChange(userId, 'offline', contactsSet, currentTime);
                        
                        logger.info(`Пользователь ${userId} помечен как офлайн. Последняя активность: ${currentTime}`);
                    } else {
                        // Если userInfo не найден, просто удаляем связи
                        await this.removeUserOnline(userId);
                        this.userConnections.delete(userId);
                        this.tokenCache.delete(ws);
                    }
                } catch (error) {
                    logger.error(`Ошибка при обработке отключения пользователя ${userId}: ${error.message}`);
                }
            }

            if (!clientInfo && !userId) {
                logger.warn('Неизвестный клиент отключился.');
            }
        } catch (error) {
            logger.error(`Ошибка в handleDisconnect: ${error.message}`);
        }
    }
    
    /**
     * Получает user_id по WebSocket соединению.
     * @param {WebSocket} ws 
     * @returns {string|number|null}
     */
    getUserIdByWs(ws) {
        for (const [userId, wsConnection] of this.userConnections.entries()) {
            if (wsConnection === ws) {
                return userId;
            }
        }
        return null;
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
    
    // --- REDIS МЕТОДЫ ---
    
    /**
     * Добавляет пользователя в комнату чата в Redis.
     * @param {string|number} chatId 
     * @param {string|number} userId 
     */
    async addToChatRoom(chatId, userId) {
        try {
            await this.redisClient.sAdd(`chatRooms:${chatId}`, userId.toString());
            logger.debug(`Пользователь ${userId} добавлен в чат ${chatId}`);
        } catch (error) {
            logger.error(`Ошибка добавления в чат ${chatId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Удаляет пользователя из комнаты чата в Redis.
     * @param {string|number} chatId 
     * @param {string|number} userId 
     */
    async removeFromChatRoom(chatId, userId) {
        try {
            await this.redisClient.sRem(`chatRooms:${chatId}`, userId.toString());
            
            // Проверяем, остались ли участники в чате
            const membersCount = await this.redisClient.sCard(`chatRooms:${chatId}`);
            if (membersCount === 0) {
                await this.redisClient.del(`chatRooms:${chatId}`);
                logger.info(`Чат ${chatId} пуст и был удален.`);
            }
            
            logger.debug(`Пользователь ${userId} удален из чата ${chatId}`);
        } catch (error) {
            logger.error(`Ошибка удаления из чата ${chatId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Получает список участников чата из Redis.
     * @param {string|number} chatId 
     * @returns {Promise<Array>}
     */
    async getChatMembers(chatId) {
        try {
            const members = await this.redisClient.sMembers(`chatRooms:${chatId}`);
            return members || [];
        } catch (error) {
            logger.error(`Ошибка получения участников чата ${chatId}: ${error.message}`);
            return [];
        }
    }
    
    /**
     * Устанавливает пользователя как онлайн в Redis.
     * @param {string|number} userId 
     * @param {Array} contacts 
     * @param {string} token 
     */
    async setUserOnline(userId, contacts, token) {
        try {
            const userKey = `onlineUsers:${userId}`;
            const currentTime = new Date().toISOString();
            
            await this.redisClient.hSet(userKey, {
                'lastSeen': currentTime,
                'contacts': JSON.stringify(contacts),
                'token': token
            });
            
            logger.debug(`Пользователь ${userId} установлен как онлайн`);
        } catch (error) {
            logger.error(`Ошибка установки онлайн статуса для ${userId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Удаляет пользователя из онлайн статуса в Redis.
     * @param {string|number} userId 
     */
    async removeUserOnline(userId) {
        try {
            await this.redisClient.del(`onlineUsers:${userId}`);
            logger.debug(`Пользователь ${userId} удален из онлайн статуса`);
        } catch (error) {
            logger.error(`Ошибка удаления онлайн статуса для ${userId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Устанавливает пользователя как офлайн в Redis.
     * @param {string|number} userId 
     * @param {Array} contacts 
     * @param {string} lastSeen 
     */
    async setUserOffline(userId, contacts, lastSeen) {
        try {
            const userKey = `offlineUsers:${userId}`;
            
            await this.redisClient.hSet(userKey, {
                'lastSeen': lastSeen,
                'contacts': JSON.stringify(contacts)
            });
            
            logger.debug(`Пользователь ${userId} установлен как офлайн`);
        } catch (error) {
            logger.error(`Ошибка установки офлайн статуса для ${userId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Удаляет пользователя из офлайн статуса в Redis.
     * @param {string|number} userId 
     */
    async removeUserOffline(userId) {
        try {
            await this.redisClient.del(`offlineUsers:${userId}`);
            logger.debug(`Пользователь ${userId} удален из офлайн статуса`);
        } catch (error) {
            logger.error(`Ошибка удаления офлайн статуса для ${userId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Проверяет, онлайн ли пользователь.
     * @param {string|number} userId 
     * @returns {Promise<boolean>}
     */
    async isUserOnline(userId) {
        try {
            const exists = await this.redisClient.exists(`onlineUsers:${userId}`);
            return exists === 1;
        } catch (error) {
            logger.error(`Ошибка проверки онлайн статуса для ${userId}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Получает информацию об онлайн пользователе из Redis.
     * @param {string|number} userId 
     * @returns {Promise<object|null>}
     */
    async getUserOnlineInfo(userId) {
        try {
            const userInfo = await this.redisClient.hGetAll(`onlineUsers:${userId}`);
            if (Object.keys(userInfo).length === 0) {
                return null;
            }
            
            return {
                lastSeen: userInfo.lastSeen,
                contacts: JSON.parse(userInfo.contacts || '[]'),
                token: userInfo.token
            };
        } catch (error) {
            logger.error(`Ошибка получения онлайн информации для ${userId}: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Получает информацию об офлайн пользователе из Redis.
     * @param {string|number} userId 
     * @returns {Promise<object|null>}
     */
    async getUserOfflineInfo(userId) {
        try {
            const userInfo = await this.redisClient.hGetAll(`offlineUsers:${userId}`);
            if (Object.keys(userInfo).length === 0) {
                return null;
            }
            
            return {
                lastSeen: userInfo.lastSeen,
                contacts: JSON.parse(userInfo.contacts || '[]')
            };
        } catch (error) {
            logger.error(`Ошибка получения офлайн информации для ${userId}: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Получает контакты пользователя.
     * @param {string|number} userId 
     * @returns {Promise<Set|null>}
     */
    async getUserContacts(userId) {
        try {
            // Сначала проверяем онлайн пользователей
            let userInfo = await this.getUserOnlineInfo(userId);
            if (userInfo) {
                return new Set(userInfo.contacts.map(c => c.toString()));
            }
            
            // Затем проверяем офлайн пользователей
            userInfo = await this.getUserOfflineInfo(userId);
            if (userInfo) {
                return new Set(userInfo.contacts.map(c => c.toString()));
            }
            
            return null;
        } catch (error) {
            logger.error(`Ошибка получения контактов для ${userId}: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Собирает и возвращает статистику по работе сервера.
     * @returns {Promise<object>} - Объект со статистикой.
     */
    async getStats() {
        try {
            const onlineKeys = await this.redisClient.keys('onlineUsers:*');
            const offlineKeys = await this.redisClient.keys('offlineUsers:*');
            const chatKeys = await this.redisClient.keys('chatRooms:*');

            const onlineUsersDetails = [];
            for (const key of onlineKeys) {
                const userData = await this.redisClient.hGetAll(key);
                onlineUsersDetails.push({
                    userId: key.split(':')[1],
                    lastSeen: userData.lastSeen,
                    contacts: JSON.parse(userData.contacts || '[]')
                });
            }

            const offlineUsersDetails = [];
            for (const key of offlineKeys) {
                const userData = await this.redisClient.hGetAll(key);
                offlineUsersDetails.push({
                    userId: key.split(':')[1],
                    lastSeen: userData.lastSeen,
                    contacts: JSON.parse(userData.contacts || '[]')
                });
            }

            return {
                connectedClients: this.clients.size,
                activeChats: chatKeys.length,
                onlineUsers: onlineKeys.length,
                onlineUsersDetails,
                offlineUsers: offlineKeys.length,
                offlineUsersDetails
            };
        } catch (error) {
            logger.error(`Ошибка получения статистики: ${error.message}`);
            return {
                connectedClients: this.clients.size,
                activeChats: 0,
                onlineUsers: 0,
                onlineUsersDetails: [],
                offlineUsers: 0,
                offlineUsersDetails: [],
                error: error.message
            };
        }
    }
    
    /**
     * Закрывает соединение с Redis при завершении работы сервера.
     */
    async close() {
        try {
            if (this.redisClient && this.redisClient.isOpen) {
                await this.redisClient.quit();
                logger.info('Соединение с Redis закрыто');
            }
            
            if (this.server) {
                this.server.close();
                logger.info('HTTP сервер закрыт');
            }
        } catch (error) {
            logger.error(`Ошибка при закрытии соединений: ${error.message}`);
        }
    }
}

// --- Запуск Сервера ---
require('dotenv').config();

async function startServer() {
    let chatServer;
    try {
        chatServer = new ChatServer();
        
        // Обработчики для корректного завершения работы
        process.on('SIGINT', async () => {
            logger.info('Получен SIGINT, завершаем работу сервера...');
            if (chatServer) {
                await chatServer.close();
            }
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            logger.info('Получен SIGTERM, завершаем работу сервера...');
            if (chatServer) {
                await chatServer.close();
            }
            process.exit(0);
        });
        
    } catch (error) {
        logger.error(`Ошибка запуска сервера: ${error.message}`);
        process.exit(1);
    }
}

startServer();