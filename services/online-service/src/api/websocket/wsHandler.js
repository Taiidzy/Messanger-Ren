// ================== Импорты ==================
const WebSocket = require('ws');

const logger = require('@utils/logger');
const MESSAGE_TYPES = require('@domain/userStatusType');
const UserStatusService = require('@domain/userStatusService');
const AuthService = require('@api/http/authService'); // Предполагается, что этот сервис существует

class wsHandler {
    constructor(wsServer) {
        this.wsServer = wsServer;
        this.userStatusService = new UserStatusService();
        this.connectedUsers = new Map(); // Map: userId -> ws
        this.authService = new AuthService(); // Убедитесь, что AuthService корректно реализован
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) {
            logger.warn('WebSocket Handler уже инициализирован.');
            return;
        }

        logger.info('Инициализация WebSocket Handler...');
        
        if (!this.wsServer || !this.wsServer.wss) {
            throw new Error('WebSocket сервер не был передан в wsHandler или не инициализирован.');
        }
        
        // Инициализируем сервис статусов
        await this.userStatusService.init();

        this.wsServer.wss.on('connection', (ws, req) => {
            const ip = req.socket.remoteAddress;
            // Генерируем уникальный ID для соединения, чтобы отслеживать его в логах
            const connectionId = this.generateConnectionId();
            ws.connectionId = connectionId;
            logger.info(`Новое WebSocket подключение [${connectionId}]`);

            ws.on('message', (data) => this.handleMessage(ws, data));
            ws.on('close', (code, reason) => this.handleDisconnect(ws, code, reason));
            ws.on('error', (error) => {
                logger.error(`Ошибка WebSocket соединения [${connectionId}]: ${error.message}`);
            });
        });

        this.isInitialized = true;
        logger.info('WebSocket Handler успешно инициализирован и слушает подключения');
    }

    generateConnectionId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    async handleMessage(ws, data) {
        logger.debug(`Получено сообщение от [${ws.connectionId}]...`);
        logger.debug(`RAW DATA [${ws.connectionId}]: ${data.toString()}`);
        
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (error) {
            logger.error(`Ошибка парсинга JSON от [${ws.connectionId}]: ${error.message}`);
            this.sendError(ws, 'Некорректный формат JSON.');
            return;
        }
        
        logger.debug(`Сообщение [${ws.connectionId}] тип: ${message.type}`);

        try {
            switch (message.type) {
                case MESSAGE_TYPES.STATUS_REGISTER:
                    // Поддерживаем оба формата: { type, data: { token, contacts } } и { type, token, contacts }
                    await this.handleStatusRegister(ws, message.data || message);
                    break;
                default:
                    logger.warn(`Получен неизвестный тип сообщения [${ws.connectionId}]: ${message.type}`);
                    this.sendError(ws, `Неизвестный тип сообщения: ${message.type}`);
            }
        } catch (error) {
            logger.error(`Критическая ошибка при обработке сообщения типа '${message.type}' от [${ws.connectionId}]: ${error.message}`);
            this.sendError(ws, 'Внутренняя ошибка сервера при обработке вашего сообщения.');
        }
    }

    async handleStatusRegister(ws, data = {}) {
        logger.info(`Обработка STATUS_REGISTER для [${ws.connectionId}]...`);
        const { token, contacts } = data || {};

        if (!token || !Array.isArray(contacts)) {
            logger.warn(`Некорректные данные для STATUS_REGISTER от [${ws.connectionId}]. data: ${JSON.stringify(data)}`);
            this.sendError(ws, 'Для регистрации статуса необходимы "token" и массив "contacts" в объекте "data" либо напрямую в сообщении.');
            return;
        }

        try {
            // Предполагаем, что validateToken возвращает ID пользователя или null/кидает ошибку
            const userId = await this.authService.validateToken(token);

            if (!userId) {
                logger.warn(`Невалидный токен от [${ws.connectionId}]. Регистрация отклонена.`);
                this.sendError(ws, 'Аутентификация не пройдена. Невалидный токен.');
                ws.close(); // Закрываем соединение
                return;
            }

            logger.debug(`Пользователь ${userId} прошел аутентификацию. Регистрация [${ws.connectionId}]...`);

            // Проверяем, есть ли уже активное соединение для этого пользователя
            const existingWs = this.connectedUsers.get(userId.toString());
            if (existingWs && existingWs.readyState === WebSocket.OPEN) {
                logger.warn(`Обнаружено активное соединение для пользователя ${userId}. Закрываем старое [${existingWs.connectionId}].`);
                existingWs.close(1000, 'Новое подключение установлено');
            }

            // Связываем соединение с ID пользователя
            ws.userId = userId.toString();
            this.connectedUsers.set(ws.userId, ws);

            logger.info(`Пользователь ${userId} [${ws.connectionId}] зарегистрирован с ${contacts.length} контактами`);
            logger.debug(`Текущие онлайн пользователи в Map: [${Array.from(this.connectedUsers.keys()).join(', ')}]`);

            // 1. Устанавливаем статус "онлайн" в Redis
            await this.userStatusService.setUserOnline(ws.userId, contacts, token);

            // 2. Удаляем из офлайн-списка (если был)
            await this.userStatusService.removeUserOffline(ws.userId);

            // 3. Отправляем подтверждение регистрации
            this.sendMessage(ws, {
                type: MESSAGE_TYPES.STATUS_REGISTERED,
                data: { message: 'Вы успешно зарегистрированы для отслеживания статуса.' }
            });
            
            // 4. Уведомляем контакты пользователя, что он теперь онлайн
            await this.userStatusService.notifyContactsStatusChange(ws.userId, 'online', new Set(contacts), null, this.connectedUsers);
            
            // 5. Отправляем новому пользователю статусы всех его контактов
            await this.userStatusService.sendContactsStatuses(ws, ws.userId, new Set(contacts));

            logger.debug(`Пользователь ${userId} [${ws.connectionId}] полностью обработан и находится в сети`);
        } catch (error) {
            logger.error(`Ошибка при регистрации статуса для [${ws.connectionId}]: ${error.message}`);
            this.sendError(ws, 'Внутренняя ошибка сервера при регистрации статуса.');
        }
    }

    async handleDisconnect(ws, code, reason) {
        if (ws.userId) {
            logger.info(`Пользователь ${ws.userId} [${ws.connectionId}] отключился. Код: ${code}, причина: ${reason}`);
            
            // Проверяем, действительно ли это то соединение, которое мы храним
            const storedWs = this.connectedUsers.get(ws.userId);
            if (storedWs && storedWs.connectionId !== ws.connectionId) {
                logger.warn(`Пользователь ${ws.userId} отключился, но это было старое соединение [${ws.connectionId}]. Активное соединение [${storedWs.connectionId}] остается.`);
                return; // Не обрабатываем отключение, если это было старое соединение
            }

            try {
                const lastSeen = new Date().toISOString();
                const userContacts = await this.userStatusService.getUserContacts(ws.userId);
                
                // 1. Удаляем из онлайна
                await this.userStatusService.removeUserOnline(ws.userId);
                
                if (userContacts && userContacts.size > 0) {
                    // 2. Добавляем в офлайн
                    await this.userStatusService.setUserOffline(ws.userId, Array.from(userContacts), lastSeen);
                    
                    // 3. Уведомляем контакты
                    await this.userStatusService.notifyContactsStatusChange(ws.userId, 'offline', userContacts, lastSeen, this.connectedUsers);
                } else {
                    logger.warn(`Не удалось найти контакты для отключившегося пользователя ${ws.userId}. Уведомления не отправлены.`);
                }
                
                // 4. Удаляем из локальной карты
                this.connectedUsers.delete(ws.userId);
                logger.debug(`Пользователь ${ws.userId} удален из локального списка подключений.`);
                logger.debug(`Текущие онлайн пользователи в Map: [${Array.from(this.connectedUsers.keys()).join(', ')}]`);

            } catch (error) {
                logger.error(`Ошибка при обработке отключения пользователя ${ws.userId} [${ws.connectionId}]: ${error.message}`);
            }
        } else {
            logger.info(`Анонимное соединение [${ws.connectionId}] закрыто. Код: ${code}, причина: ${reason}`);
        }
    }

    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            const msgString = JSON.stringify(message);
            logger.debug(`Отправка сообщения [${ws.connectionId}] | User: ${ws.userId || 'anon'} | Type: ${message.type}`);
            ws.send(msgString);
        } else {
            logger.warn(`Попытка отправить сообщение [${ws.connectionId}] | User: ${ws.userId || 'anon'}, но соединение уже закрыто.`);
        }
    }

    sendError(ws, errorMessage) {
        logger.warn(`Отправка ошибки [${ws.connectionId}] | User: ${ws.userId || 'anon'}: "${errorMessage}"`);
        this.sendMessage(ws, {
            type: MESSAGE_TYPES.ERROR,
            data: { message: errorMessage }
        });
    }
}

module.exports = wsHandler;