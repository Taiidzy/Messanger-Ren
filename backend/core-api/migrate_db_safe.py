#!/usr/bin/env python3
"""Безопасная миграция базы данных с пересозданием таблицы."""

import sys
import os
import logging
from sqlalchemy import text
from db.database import engine, SessionLocal
from db import models

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def migrate_database_safe():
    """Выполняет безопасную миграцию базы данных"""
    logger.info("Начинаем безопасную миграцию базы данных...")
    
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
        
        if table_exists:
            logger.info("Таблица users существует. Проверяем структуру...")
            
            # Проверяем тип полей
            columns_to_check = [
                ('publicKey', 'TEXT'),
                ('encryptedPrivateKeyByUser', 'TEXT'),
                ('encryptedPrivateKeyByAccessKey', 'TEXT'),
                ('salt', 'VARCHAR(255)')
            ]
            
            needs_recreation = False
            
            for column_name, expected_type in columns_to_check:
                result = db.execute(text(f"""
                    SELECT data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users' 
                    AND column_name = '{column_name}'
                """))
                
                data_type = result.scalar()
                
                if data_type:
                    if expected_type == 'TEXT' and data_type == 'character varying':
                        logger.warning(f"Поле {column_name} имеет тип VARCHAR, нужно TEXT")
                        needs_recreation = True
                    elif expected_type == 'VARCHAR(255)' and data_type == 'character varying':
                        logger.info(f"Поле {column_name} имеет правильный тип")
                    else:
                        logger.info(f"Поле {column_name} имеет тип: {data_type}")
                else:
                    logger.error(f"Поле {column_name} не найдено")
                    needs_recreation = True
            
            if needs_recreation:
                logger.info("Пересоздаем таблицу users с правильными типами полей...")
                
                # Создаем временную таблицу с правильной структурой
                db.execute(text("""
                    CREATE TABLE users_new (
                        id SERIAL PRIMARY KEY,
                        login VARCHAR(50) UNIQUE NOT NULL,
                        "userName" VARCHAR(100),
                        password VARCHAR(255) NOT NULL,
                        "publicKey" TEXT,
                        "encryptedPrivateKeyByUser" TEXT,
                        "encryptedPrivateKeyByAccessKey" TEXT,
                        salt VARCHAR(255),
                        avatar VARCHAR(255),
                        created_at DATE NOT NULL
                    )
                """))
                
                # Копируем данные из старой таблицы (если есть)
                try:
                    db.execute(text("""
                        INSERT INTO users_new (id, login, "userName", password, avatar, created_at)
                        SELECT id, login, "userName", password, avatar, created_at
                        FROM users
                    """))
                    logger.info("Данные скопированы во временную таблицу")
                except Exception as e:
                    logger.warning(f"Ошибка при копировании данных: {e}")
                
                # Удаляем старую таблицу
                db.execute(text("DROP TABLE users"))
                
                # Переименовываем новую таблицу
                db.execute(text("ALTER TABLE users_new RENAME TO users"))
                
                # Создаем индексы
                db.execute(text('CREATE UNIQUE INDEX ix_users_id ON users (id)'))
                db.execute(text('CREATE UNIQUE INDEX ix_users_login ON users (login)'))
                
                logger.info("Таблица users пересоздана с правильными типами полей")
            else:
                logger.info("Структура таблицы users корректна")
        else:
            logger.info("Таблица users не существует. Создаем новую таблицу...")
            models.Base.metadata.create_all(bind=engine)
            logger.info("Таблица users создана успешно")
        
        # Коммитим изменения
        db.commit()
        logger.info("Миграция завершена успешно")
        
    except Exception as e:
        logger.error(f"Ошибка при миграции: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate_database_safe() 