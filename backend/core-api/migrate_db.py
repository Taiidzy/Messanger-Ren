#!/usr/bin/env python3
"""Скрипт для миграции базы данных с новыми полями для криптосистемы."""

import sys
import os
from sqlalchemy import text, create_engine
from db.database import engine, SessionLocal
from db import models
from config.config import settings
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def migrate_database():
    """Выполняет миграцию базы данных"""
    logger.info("Начинаем миграцию базы данных...")
    
    try:
        # Создаем сессию базы данных
        db = SessionLocal()
        
        # Проверяем существование таблицы users
        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        """))
        
        table_exists = result.scalar()
        
        if not table_exists:
            logger.info("Таблица users не существует. Создаем новую таблицу...")
            models.Base.metadata.create_all(bind=engine)
            logger.info("Таблица users создана успешно")
        else:
            logger.info("Таблица users существует. Проверяем наличие новых полей...")
            
            # Проверяем наличие новых полей
            columns_to_check = [
                'publicKey',
                'encryptedPrivateKeyByUser', 
                'encryptedPrivateKeyByAccessKey',
                'salt'
            ]
            
            for column in columns_to_check:
                result = db.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'users' 
                        AND column_name = '{column}'
                    );
                """))
                
                column_exists = result.scalar()
                
                if not column_exists:
                    logger.info(f"Добавляем поле {column}...")
                    
                    if column == 'publicKey':
                        db.execute(text("ALTER TABLE users ADD COLUMN publicKey TEXT"))
                    elif column == 'encryptedPrivateKeyByUser':
                        db.execute(text("ALTER TABLE users ADD COLUMN encryptedPrivateKeyByUser TEXT"))
                    elif column == 'encryptedPrivateKeyByAccessKey':
                        db.execute(text("ALTER TABLE users ADD COLUMN encryptedPrivateKeyByAccessKey TEXT"))
                    elif column == 'salt':
                        db.execute(text("ALTER TABLE users ADD COLUMN salt VARCHAR(255)"))
                    
                    logger.info(f"Поле {column} добавлено")
                else:
                    logger.info(f"Поле {column} уже существует")
                    
                    # Проверяем тип поля и изменяем на TEXT если нужно
                    if column in ['publicKey', 'encryptedPrivateKeyByUser', 'encryptedPrivateKeyByAccessKey']:
                        result = db.execute(text(f"""
                            SELECT data_type 
                            FROM information_schema.columns 
                            WHERE table_schema = 'public' 
                            AND table_name = 'users' 
                            AND column_name = '{column}'
                        """))
                        
                        data_type = result.scalar()
                        
                        if data_type == 'character varying':
                            logger.info(f"Изменяем тип поля {column} с VARCHAR на TEXT...")
                            db.execute(text(f"ALTER TABLE users ALTER COLUMN {column} TYPE TEXT"))
                            logger.info(f"Тип поля {column} изменен на TEXT")
                        else:
                            logger.info(f"Поле {column} уже имеет правильный тип: {data_type}")
        
        # Коммитим изменения
        db.commit()
        logger.info("Миграция завершена успешно")
        
    except Exception as e:
        logger.error(f"Ошибка при миграции: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

def migrate_chat_tables():
    """
    Мигрирует существующие таблицы чатов, добавляя поле files для поддержки файлов.
    """
    try:
        # Создаем подключение к базе данных
        engine = create_engine(settings.DATABASE_URL, isolation_level="AUTOCOMMIT")
        
        with engine.connect() as connection:
            # Получаем список всех таблиц чатов
            result = connection.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name LIKE 'chat_%' 
                AND table_schema = 'public'
            """))
            
            chat_tables = [row[0] for row in result.fetchall()]
            logger.info(f"Найдено таблиц чатов для миграции: {len(chat_tables)}")
            
            for table_name in chat_tables:
                try:
                    # Проверяем, есть ли уже поле files
                    check_result = connection.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = '{table_name}' 
                        AND column_name = 'files'
                    """))
                    
                    if not check_result.fetchone():
                        # Добавляем поле files
                        connection.execute(text(f"""
                            ALTER TABLE {table_name} 
                            ADD COLUMN files JSONB
                        """))
                        logger.info(f"Добавлено поле files в таблицу {table_name}")
                    else:
                        logger.info(f"Поле files уже существует в таблице {table_name}")
                        
                except Exception as e:
                    logger.error(f"Ошибка при миграции таблицы {table_name}: {e}")
                    
        logger.info("Миграция завершена успешно")
        
    except Exception as e:
        logger.error(f"Ошибка при выполнении миграции: {e}")
        raise

def migrate_message_type_field():
    """Миграция для увеличения размера поля message_type в таблицах чатов"""
    logger.info("Начинаем миграцию поля message_type...")
    
    try:
        # Создаем подключение к БД
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Получаем список всех таблиц чатов
            result = connection.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name LIKE 'chat_%' 
                AND table_name NOT LIKE '%_files'
                ORDER BY table_name
            """))
            
            chat_tables = [row[0] for row in result.fetchall()]
            logger.info(f"Найдено таблиц чатов: {len(chat_tables)}")
            
            for table_name in chat_tables:
                try:
                    # Проверяем текущий размер поля message_type
                    result = connection.execute(text(f"""
                        SELECT character_maximum_length 
                        FROM information_schema.columns 
                        WHERE table_name = '{table_name}' 
                        AND column_name = 'message_type'
                    """))
                    
                    current_length = result.fetchone()
                    if current_length and current_length[0] < 25:
                        logger.info(f"Обновляем поле message_type в таблице {table_name}...")
                        
                        # Изменяем размер поля
                        connection.execute(text(f"""
                            ALTER TABLE {table_name} 
                            ALTER COLUMN message_type TYPE VARCHAR(25)
                        """))
                        
                        logger.info(f"Таблица {table_name} обновлена")
                    else:
                        logger.info(f"Таблица {table_name} уже имеет правильный размер поля")
                        
                except Exception as e:
                    logger.error(f"Ошибка при обновлении таблицы {table_name}: {e}")
                    continue
            
            connection.commit()
            logger.info("Миграция завершена успешно")
            
    except Exception as e:
        logger.error(f"Ошибка при выполнении миграции: {e}")
        return False
    
    return True

if __name__ == "__main__":
    migrate_database()
    migrate_chat_tables()
    migrate_message_type_field() 