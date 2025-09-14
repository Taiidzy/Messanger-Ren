// ================== Импорты ==================
const WebSocket = require('ws');
const http = require('http');

const config = require('@config');
const logger = require('@utils/logger');

class Server {
    constructor(port = Number(config.app.port)) {
        this.port = port;
        this.server = null;
        this.wss = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) {
            logger.warn('Сервер уже инициализирован, повторная инициализация не требуется.');
            return;
        }

        logger.info('Инициализация WebSocket сервера...');
        
        try {
            // Создаем стандартный HTTP сервер
            this.server = http.createServer((req, res) => {
                // Отвечаем на обычные HTTP запросы, если они приходят
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('WebSocket server is running.');
            });

            // Создаем WebSocket сервер
            this.wss = new WebSocket.Server({ noServer: true });
            logger.info('WebSocket.Server создан.');

            // Обработка upgrade только для /online-service
            this.server.on('upgrade', (request, socket, head) => {
                logger.info(`Получен запрос на upgrade для URL: ${request.url}`);
                if (request.url === '/online-service') {
                    this.wss.handleUpgrade(request, socket, head, (ws) => {
                        logger.info('Upgrade успешен. Имитируем событие "connection".');
                        this.wss.emit('connection', ws, request);
                    });
                } else {
                    logger.warn(`Отклонен запрос на upgrade для неверного URL: ${request.url}`);
                    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                    socket.destroy();
                }
            });

            // Обработка ошибок сервера
            this.server.on('error', (error) => {
                logger.error(`Критическая ошибка HTTP сервера: ${error.message}`);
                throw error;
            });

            // Запускаем HTTP сервер
            await new Promise((resolve, reject) => {
                this.server.listen(this.port, (error) => {
                    if (error) {
                        logger.error(`Не удалось запустить HTTP сервер на порту ${this.port}.`);
                        reject(error);
                    } else {
                        logger.info(`WebSocket сервер запущен и слушает порт ${this.port} по пути /online-service.`);
                        this.isInitialized = true;
                        resolve();
                    }
                });
            });

        } catch (error) {
            logger.error(`Критическая ошибка при инициализации сервера: ${error.message}`);
            throw error;
        }
    }

    async close() {
        logger.info('Остановка WebSocket сервера...');
        if (this.wss) {
            this.wss.close(() => logger.info('Сервер WebSocket.Server закрыт.'));
        }
        if (this.server) {
            this.server.close(() => logger.info('HTTP сервер закрыт.'));
        }
        this.isInitialized = false;
        logger.info('WebSocket сервер полностью остановлен');
    }
}

module.exports = Server;