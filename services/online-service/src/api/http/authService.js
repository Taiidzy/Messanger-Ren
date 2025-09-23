// ================== Импорты ==================
const axios = require('axios');

const config = require('@config');
const logger = require('@utils/logger');

class AuthService {
    constructor() {
        this.host = config.auth.host
    }

    async validateToken(token) {
        try {
            logger.debug(`Проверка токена через auth сервер: ${this.host}`);
            const authUrl = `${this.host}/auth-service/auth/verify`;
            logger.info(`Проверка токена через auth сервер: ${authUrl}`);
            const response = await axios.get(authUrl, {
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
}

module.exports = AuthService;