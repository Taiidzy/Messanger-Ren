// ================== Импорты ==================
const redis = require('redis');

const config = require('@config');
const logger = require('@utils/logger');

class RedisClient {
    constructor() {
        this.host = config.redis.host;
        this.name = config.redis.name;
        this.redisClient = null; // Инициализируем как null
    }

    async init() {
        if (this.redisClient && this.redisClient.isOpen) {
            logger.warn('Redis клиент уже инициализирован и подключен.');
            return;
        }

        logger.info(`Инициализация Redis клиента для подключения к ${this.host}...`);
        try {
            this.redisClient = redis.createClient({
                url: this.host
            });

            this.redisClient.on('error', (err) => {
                logger.error(`Критическая ошибка Redis клиента: ${err.message}`);
            });

            this.redisClient.on('connect', () => {
                logger.info('Устанавливается соединение с Redis...');
            });

            this.redisClient.on('ready', () => {
                logger.info('Redis клиент готов к работе.');
            });

            this.redisClient.on('end', () => {
                logger.warn('Соединение с Redis закрыто.');
            });

            await this.redisClient.connect();
            logger.info('>>> Redis клиент успешно подключен <<<');

        } catch (error) {
            logger.error(`Критическая ошибка при подключении к Redis: ${error.message}`);
            throw error;
        }
    }

    async hSet(key, field, value) {
        logger.debug(`REDIS HSET: key='${key}', field='${JSON.stringify(field)}'`);
        return await this.redisClient.hSet(key, field, value);
    }
    
    async hGetAll(key) {
        logger.debug(`REDIS HGETALL: key='${key}'`);
        const result = await this.redisClient.hGetAll(key);
        logger.debug(`REDIS HGETALL RESULT for key='${key}': ${JSON.stringify(result)}`);
        return result;
    }
    
    async del(key) {
        logger.debug(`REDIS DEL: key='${key}'`);
        return await this.redisClient.del(key);
    }
    
    async exists(key) {
        logger.debug(`REDIS EXISTS: key='${key}'`);
        const result = await this.redisClient.exists(key);
        logger.debug(`REDIS EXISTS RESULT for key='${key}': ${result}`);
        return result;
    }
}

module.exports = RedisClient;