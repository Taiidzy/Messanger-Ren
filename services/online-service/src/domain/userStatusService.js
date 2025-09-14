// ================== Импорты ==================
const RedisClient = require('@infrastructure/redisClient');
const logger = require('@utils/logger');
const MESSAGE_TYPES = require('@domain/userStatusType');
const WebSocket = require('ws'); // Импортируем WebSocket для проверки readyState

class UserStatusService {
    constructor() {
        this.redisClient = null;
    }

    async init() {
        logger.info('Инициализация UserStatusService...');
        try {
            this.redisClient = new RedisClient();
            await this.redisClient.init(); // Убедимся, что init RedisClient был вызван
            logger.info('UserStatusService инициализирован');
        } catch (error) {
            logger.error(`Критическая ошибка при инициализации UserStatusService: ${error.message}`);
            throw error;
        }
    }

    async setUserOnline(userId, contacts, token) {
        logger.info(`Попытка установить статус ОНЛАЙН для пользователя ${userId}`);
        try {
            const userKey = `onlineUsers:${userId}`;
            const currentTime = new Date().toISOString();
            
            const dataToSet = {
                'lastSeen': currentTime,
                'contacts': JSON.stringify(contacts),
                'token': token
            };

            await this.redisClient.hSet(userKey, dataToSet);
            
            logger.info(`Пользователь ${userId} успешно установлен как ОНЛАЙН.`);
            logger.debug(`Данные для ${userId}: ${JSON.stringify(dataToSet)}`);
        } catch (error) {
            logger.error(`Ошибка при установке онлайн статуса для ${userId}: ${error.message}`);
            throw error;
        }
    }
    
    async removeUserOnline(userId) {
        logger.info(`Удаление онлайн статуса для пользователя ${userId}...`);
        try {
            const result = await this.redisClient.del(`onlineUsers:${userId}`);
            if (result > 0) {
                logger.info(`Пользователь ${userId} успешно удален из онлайн статуса.`);
            } else {
                logger.warn(`Попытка удалить онлайн статус для ${userId}, но ключ не найден.`);
            }
        } catch (error) {
            logger.error(`Ошибка при удалении онлайн статуса для ${userId}: ${error.message}`);
            throw error;
        }
    }
    
    async setUserOffline(userId, contacts, lastSeen) {
        logger.info(`Попытка установить статус ОФЛАЙН для пользователя ${userId}`);
        try {
            const userKey = `offlineUsers:${userId}`;
            const dataToSet = {
                'lastSeen': lastSeen,
                'contacts': JSON.stringify(contacts)
            };
            
            await this.redisClient.hSet(userKey, dataToSet);
            
            logger.info(`Пользователь ${userId} успешно установлен как ОФЛАЙН. Last seen: ${lastSeen}`);
            logger.debug(`Данные для ${userId}: ${JSON.stringify(dataToSet)}`);
        } catch (error) {
            logger.error(`Ошибка при установке офлайн статуса для ${userId}: ${error.message}`);
            throw error;
        }
    }
    
    async removeUserOffline(userId) {
        logger.info(`Удаление офлайн статуса для пользователя ${userId}...`);
        try {
            const result = await this.redisClient.del(`offlineUsers:${userId}`);
            if (result > 0) {
                logger.info(`Пользователь ${userId} успешно удален из офлайн статуса.`);
            } else {
                logger.warn(`Попытка удалить офлайн статус для ${userId}, но ключ не найден.`);
            }
        } catch (error) {
            logger.error(`Ошибка при удалении офлайн статуса для ${userId}: ${error.message}`);
            throw error;
        }
    }
    
    async isUserOnline(userId) {
        logger.info(`Проверка онлайн статуса для пользователя ${userId}...`);
        try {
            const exists = await this.redisClient.exists(`onlineUsers:${userId}`);
            logger.debug(`Результат проверки онлайн для ${userId}: ${exists === 1}`);
            return exists === 1;
        } catch (error) {
            logger.error(`Ошибка при проверке онлайн статуса для ${userId}: ${error.message}`);
            return false;
        }
    }
    
    async getUserOnlineInfo(userId) {
        logger.info(`Получение онлайн информации для пользователя ${userId}...`);
        try {
            const userInfo = await this.redisClient.hGetAll(`onlineUsers:${userId}`);
            if (!userInfo || Object.keys(userInfo).length === 0) {
                logger.info(`Онлайн информация для ${userId} не найдена.`);
                return null;
            }
            
            const parsedInfo = {
                lastSeen: userInfo.lastSeen,
                contacts: JSON.parse(userInfo.contacts || '[]'),
                token: userInfo.token
            };
            logger.info(`Онлайн информация для ${userId} успешно получена.`);
            return parsedInfo;
        } catch (error) {
            logger.error(`Ошибка при получении онлайн информации для ${userId}: ${error.message}`);
            return null;
        }
    }

    async getUserOfflineInfo(userId) {
        logger.info(`Получение офлайн информации для пользователя ${userId}...`);
        try {
            const userInfo = await this.redisClient.hGetAll(`offlineUsers:${userId}`);
            if (!userInfo || Object.keys(userInfo).length === 0) {
                logger.info(`Офлайн информация для ${userId} не найдена.`);
                return null;
            }
            
            const parsedInfo = {
                lastSeen: userInfo.lastSeen,
                contacts: JSON.parse(userInfo.contacts || '[]')
            };
            logger.info(`Офлайн информация для ${userId} успешно получена.`);
            return parsedInfo;
        } catch (error) {
            logger.error(`Ошибка при получении офлайн информации для ${userId}: ${error.message}`);
            return null;
        }
    }

    async getUserContacts(userId) {
        logger.info(`Получение контактов для пользователя ${userId}...`);
        try {
            // Сначала проверяем онлайн пользователей
            let userInfo = await this.getUserOnlineInfo(userId);
            if (userInfo && userInfo.contacts) {
                logger.info(`Контакты для ${userId} найдены в ОНЛАЙН данных.`);
                return new Set(userInfo.contacts.map(c => c.toString()));
            }
            
            // Затем проверяем офлайн пользователей
            userInfo = await this.getUserOfflineInfo(userId);
            if (userInfo && userInfo.contacts) {
                logger.info(`Контакты для ${userId} найдены в ОФЛАЙН данных.`);
                return new Set(userInfo.contacts.map(c => c.toString()));
            }
            
            logger.warn(`Контакты для пользователя ${userId} не найдены ни в онлайн, ни в офлайн хранилище.`);
            return null;
        } catch (error) {
            logger.error(`Ошибка при получении контактов для ${userId}: ${error.message}`);
            return null;
        }
    }

    async notifyContactsStatusChange(userId, status, userContacts, lastSeen = null, userConnections) {
        logger.info(`Начало уведомления контактов о смене статуса пользователя ${userId} на '${status}'.`);
        if (!userContacts || userContacts.size === 0) {
            logger.warn(`У пользователя ${userId} нет контактов для уведомления.`);
            return;
        }
    
        const statusMessage = JSON.stringify({
            type: MESSAGE_TYPES.CONTACT_STATUS,
            data: {
                user_id: parseInt(userId),
                status: status,
                timestamp: new Date().toISOString(),
                last_seen: lastSeen
            }
        });
        logger.debug(`Сообщение для контактов: ${statusMessage}`);
    
        let notifiedCount = 0;
    
        logger.debug(`Всего онлайн-соединений для проверки: ${userConnections.size}.`);
        for (const [contactUserId, contactWs] of userConnections.entries()) {
            // Пропускаем самого пользователя
            if (contactUserId?.toString() === userId?.toString()) continue;

            try {
                logger.debug(`Проверка контакта ${contactUserId}...`);
                const contactContacts = await this.getUserContacts(contactUserId);
                if (!contactContacts) {
                    logger.info(`Не удалось получить контакты для ${contactUserId}. Пропускаем.`);
                    continue;
                }
    
                if (contactContacts.has(userId.toString())) {
                    logger.debug(`${contactUserId} является контактом ${userId}. Попытка отправки уведомления...`);
                    if (contactWs && contactWs.readyState === WebSocket.OPEN) {
                        contactWs.send(statusMessage);
                        notifiedCount++;
                        logger.debug(`Уведомление успешно отправлено контакту ${contactUserId}.`);
                    } else {
                        logger.warn(`Контакт ${contactUserId} является контактом ${userId}, но его WebSocket соединение недоступно (readyState: ${contactWs?.readyState}).`);
                    }
                }
            } catch (error) {
                logger.error(`Ошибка в цикле уведомления для контакта ${contactUserId}: ${error.message}`);
            }
        }
    }

    async sendContactsStatuses(ws, userId, contacts) {
        logger.info(`Запрос на отправку статусов ${contacts.size} контактов пользователю ${userId}`);
        const contactStatuses = [];
        
        for (const contactId of contacts) {
            try {
                let status = 'offline';
                let lastSeen = null;
                
                const isOnline = await this.isUserOnline(contactId);
                if (isOnline) {
                    status = 'online';
                    const onlineInfo = await this.getUserOnlineInfo(contactId);
                    lastSeen = onlineInfo?.lastSeen; // lastSeen у онлайн юзера - это время его последнего действия
                } else {
                    const offlineInfo = await this.getUserOfflineInfo(contactId);
                    if (offlineInfo) {
                        lastSeen = offlineInfo.lastSeen;
                    }
                }
                
                contactStatuses.push({
                    user_id: parseInt(contactId),
                    status: status,
                    last_seen: lastSeen
                });
                logger.debug(`Статус для контакта ${contactId} определен: status='${status}', last_seen='${lastSeen}'`);
            } catch (error) {
                logger.error(`Ошибка при получении статуса для контакта ${contactId} (для пользователя ${userId}): ${error.message}`);
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
            logger.debug(`Пользователю ${userId} отправлены статусы ${contactStatuses.length} контактов`);
        } else {
            logger.warn(`Не удалось отправить статусы контактов пользователю ${userId}, так как соединение уже закрыто.`);
        }
    }
}

module.exports = UserStatusService;