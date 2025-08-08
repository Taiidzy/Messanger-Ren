#!/usr/bin/env python3
"""
Скрипт миграции для изменения типа данных file_id с INTEGER на BIGINT
в существующих таблицах файлов чатов.
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect
from config.config import settings
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def get_existing_chat_tables(engine):
    """Получает список существующих таблиц чатов"""
    inspector = inspect(engine)
    all_tables = inspector.get_table_names()
    
    # Ищем таблицы чатов (chat_X)
    chat_tables = [table for table in all_tables if table.startswith('chat_') and not table.endswith('_files')]
    
    # Ищем таблицы файлов (chat_X_files)
    files_tables = [table for table in all_tables if table.startswith('chat_') and table.endswith('_files')]
    
    return chat_tables, files_tables

def migrate_file_id_column(engine, files_table_name):
    """Изменяет тип данных file_id с INTEGER на BIGINT"""
    try:
        with engine.connect() as connection:
            # Проверяем текущий тип данных file_id
            check_sql = f"""
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_name = '{files_table_name}' 
                AND column_name = 'file_id'
            """
            result = connection.execute(text(check_sql))
            current_type = result.fetchone()
            
            if current_type and current_type[0] == 'integer':
                logger.info(f"Изменяем тип данных file_id в таблице {files_table_name} с INTEGER на BIGINT")
                
                # Изменяем тип данных
                alter_sql = f"ALTER TABLE {files_table_name} ALTER COLUMN file_id TYPE BIGINT"
                connection.execute(text(alter_sql))
                connection.commit()
                
                logger.info(f"Успешно изменен тип данных file_id в таблице {files_table_name}")
                return True
            else:
                logger.info(f"Тип данных file_id в таблице {files_table_name} уже BIGINT или не найден")
                return False
                
    except Exception as e:
        logger.error(f"Ошибка при миграции таблицы {files_table_name}: {e}")
        return False

def main():
    """Основная функция миграции"""
    logger.info("Начинаем миграцию file_id с INTEGER на BIGINT")
    
    try:
        # Создаем подключение к БД
        engine = create_engine(settings.DATABASE_URL)
        
        # Получаем список существующих таблиц
        chat_tables, files_tables = get_existing_chat_tables(engine)
        
        logger.info(f"Найдено таблиц чатов: {len(chat_tables)}")
        logger.info(f"Найдено таблиц файлов: {len(files_tables)}")
        
        if not files_tables:
            logger.info("Таблицы файлов не найдены. Миграция не требуется.")
            return
        
        # Мигрируем каждую таблицу файлов
        migrated_count = 0
        for files_table in files_tables:
            if migrate_file_id_column(engine, files_table):
                migrated_count += 1
        
        logger.info(f"Миграция завершена. Обработано таблиц: {migrated_count}/{len(files_tables)}")
        
    except Exception as e:
        logger.error(f"Ошибка при выполнении миграции: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 