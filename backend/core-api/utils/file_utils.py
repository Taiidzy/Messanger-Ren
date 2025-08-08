import os
import base64
import hashlib
from datetime import datetime
from pathlib import Path
import logging
import json

logger = logging.getLogger(__name__)

def ensure_chat_directory(chat_id: int) -> str:
    """
    Создает директорию для чата если она не существует.
    
    Args:
        chat_id: ID чата
        
    Returns:
        Путь к директории чата
    """
    chat_dir = f"storage/chats/chat_{chat_id}"
    Path(chat_dir).mkdir(parents=True, exist_ok=True)
    return chat_dir

def create_timestamp_directory(chat_dir: str) -> str:
    """
    Создает директорию с временной меткой для группировки файлов.
    
    Args:
        chat_dir: Путь к директории чата
        
    Returns:
        Путь к директории с временной меткой
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    timestamp_dir = os.path.join(chat_dir, timestamp)
    Path(timestamp_dir).mkdir(parents=True, exist_ok=True)
    return timestamp_dir

def generate_file_path(chat_id: int, file_id: int, filename: str) -> tuple[str, str]:
    """
    Генерирует путь для сохранения файла.
    
    Args:
        chat_id: ID чата
        file_id: ID файла
        filename: Имя файла
        
    Returns:
        Кортеж (полный путь к файлу, относительный путь для БД)
    """
    chat_dir = ensure_chat_directory(chat_id)
    timestamp_dir = create_timestamp_directory(chat_dir)
    
    # Генерируем хэш для уникальности имени файла
    file_hash = hashlib.md5(f"{file_id}_{filename}_{datetime.now().timestamp()}".encode()).hexdigest()[:8]
    
    # Получаем расширение файла
    file_ext = os.path.splitext(filename)[1] if '.' in filename else ''
    
    # Формируем имя файла: fileid_hash.enc
    encrypted_filename = f"{file_id}_{file_hash}.enc"
    
    # Полный путь для сохранения
    full_path = os.path.join(timestamp_dir, encrypted_filename)
    
    # Относительный путь для БД (от storage/)
    relative_path = os.path.relpath(full_path, "storage")
    
    return full_path, relative_path

def save_encrypted_file(chat_id: int, file_id: int, filename: str, encrypted_data: str) -> str:
    """
    Сохраняет зашифрованный файл в файловую систему.
    Поддержка chunked файлов (JSON с ключом 'chunks').
    
    Args:
        chat_id: ID чата
        file_id: ID файла
        filename: Имя файла
        encrypted_data: Зашифрованные данные в base64
        
    Returns:
        Относительный путь к файлу для сохранения в БД
    """
    try:
        full_path, relative_path = generate_file_path(chat_id, file_id, filename)

        # Попробуем распарсить как JSON (chunked)
        try:
            data = json.loads(encrypted_data)
            if isinstance(data, dict) and "chunks" in data:
                with open(full_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f)
                logger.info(f"Чанк-файл сохранен: {full_path}")
                return relative_path
        except Exception:
            pass  # Не JSON, значит обычный файл

        # Обычный base64
        file_data = base64.b64decode(encrypted_data)
        with open(full_path, 'wb') as f:
            f.write(file_data)
        logger.info(f"Файл сохранен: {full_path}")
        return relative_path

    except Exception as e:
        logger.error(f"Ошибка сохранения файла: {e}")
        raise

def read_encrypted_file(file_path: str) -> str:
    """
    Читает зашифрованный файл из файловой системы.
    Если файл chunked (JSON с ключом 'chunks'), возвращает JSON-строку.
    
    Args:
        file_path: Относительный путь к файлу (от storage/)
        
    Returns:
        Зашифрованные данные в base64
    """

    logger.info(f"Читаем файл: {file_path}")
    try:
        full_path = os.path.join("storage", file_path)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Файл не найден: {full_path}")

        # Пробуем как JSON (chunked)
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, dict) and "chunks" in data:
                return json.dumps(data)
        except Exception:
            pass  # Не JSON, значит обычный файл

        # Обычный base64
        with open(full_path, 'rb') as f:
            file_data = f.read()
        return base64.b64encode(file_data).decode('utf-8')

    except Exception as e:
        logger.error(f"Ошибка чтения файла {file_path}: {e}")
        raise

def delete_file(file_path: str) -> bool:
    """
    Удаляет файл из файловой системы.
    
    Args:
        file_path: Относительный путь к файлу (от storage/)
        
    Returns:
        True если файл удален, False если файл не найден
    """
    try:
        full_path = os.path.join("storage", file_path)
        
        if os.path.exists(full_path):
            os.remove(full_path)
            logger.info(f"Файл удален: {full_path}")
            return True
        else:
            logger.warning(f"Файл не найден для удаления: {full_path}")
            return False
            
    except Exception as e:
        logger.error(f"Ошибка удаления файла {file_path}: {e}")
        return False

def get_file_size(file_path: str) -> int:
    """
    Получает размер файла.
    
    Args:
        file_path: Относительный путь к файлу (от storage/)
        
    Returns:
        Размер файла в байтах
    """
    try:
        full_path = os.path.join("storage", file_path)
        return os.path.getsize(full_path)
    except Exception as e:
        logger.error(f"Ошибка получения размера файла {file_path}: {e}")
        return 0 