// ================== Импорты ==================
const logger = require('@utils/logger');
const Server = require('@api/websocket/wsServer');
const wsHandler = require('@api/websocket/wsHandler');

// Создаем экземпляры
const server = new Server();
const serverHandler = new wsHandler(server);

// Запускаем сервисы последовательно
async function startServer() {
    logger.info('===== Запуск онлайн сервиса =====');
    try {
        await server.init();
        await serverHandler.init();
        logger.info('===== Сервис запущен =====');
    } catch (error) {
        logger.error(`КРИТИЧЕСКАЯ ОШИБКА: Не удалось запустить сервис. ${error.message}`);
        process.exit(1); // Завершаем процесс с кодом ошибки
    }
}

startServer();