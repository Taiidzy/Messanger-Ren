from fastapi import FastAPI, Depends, HTTPException, status, Form, File, UploadFile, Body, Query
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from db import models
from schemas import schemas
from utils import utils
from db.database import get_db, engine
from config.config import settings
import logging
from jose import jwt, JWTError
from datetime import date, datetime
from schemas.schemas import ChatWithUserInfo
from sqlalchemy import create_engine, text
import secrets
import string
import json
import binascii
import base64
from utils.file_utils import save_encrypted_file, read_encrypted_file
import os
from fastapi import Response

# Создаем таблицы в базе данных (если они еще не созданы)
try:
    models.Base.metadata.create_all(bind=engine)
    logger = logging.getLogger(__name__)
    logger.info("База данных успешно инициализирована")
except Exception as e:
    logger = logging.getLogger(__name__)
    logger.error(f"Ошибка подключения к базе данных: {e}")
    # в production не выводим лишних предупреждений

# Настройка логирования
log_formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')

# Файл для логов
file_handler = logging.FileHandler('core-api.log', encoding='utf-8')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(log_formatter)

def _get_console_handler_level():
    level_name = os.getenv('LOG_LEVEL', 'ERROR').upper()
    return getattr(logging, level_name, logging.ERROR)

# Консоль по уровню из окружения (по умолчанию только ошибки)
console_handler = logging.StreamHandler()
console_handler.setLevel(_get_console_handler_level())
console_handler.setFormatter(log_formatter)

# Очищаем старые хендлеры и добавляем новые
logger = logging.getLogger(__name__)
logger.handlers = []
logger.addHandler(file_handler)
logger.addHandler(console_handler)
logger.setLevel(getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper(), logging.INFO))

# Создаем экземпляр FastAPI
app = FastAPI(
    title="Messenger Auth Service",
    description="Сервис аутентификации для мессенджера",
    version="1.0.0",
    docs_url="/docs",  # URL для документации Swagger
    redoc_url=None,     # Отключаем ReDoc
    # root_path="/api"
)

# СРАЗУ после создания app добавляем CORS middleware
cors_origins_env = os.getenv('CORS_ORIGINS')
allow_origins = [o.strip() for o in cors_origins_env.split(',')] if cors_origins_env else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/storage", StaticFiles(directory="storage"), name="storage")

# Схема для OAuth2 аутентификации
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    """
    Зависимость для получения текущего аутентифицированного пользователя.
    
    Параметры:
    - token: JWT токен из заголовка Authorization
    
    Возвращает:
    - Объект пользователя из базы данных
    
    Ошибки:
    - 401: Если токен невалиден или пользователь не найден
    """
    logger.info("Проверка токена пользователя...")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Декодируем и проверяем токен
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        # Извлекаем имя пользователя из токена
        username: str = payload.get("sub")
        if username is None:
            logger.warning("JWT токен не содержит sub")
            raise credentials_exception
    except JWTError as e:
        logger.error(f"Ошибка декодирования JWT: {e}")
        raise credentials_exception
    
    # Ищем пользователя в базе данных
    user = db.query(models.User).filter(models.User.login == username).first()
    if user is None:
        logger.warning(f"Пользователь {username} не найден по токену")
        raise credentials_exception
    
    logger.info(f"Пользователь {username} успешно аутентифицирован")
    return user

def generate_access_key(length: int = 8) -> str:
    """Генерирует случайный ключ доступа (A-Z, 0-9)"""
    if length <= 0:
        raise ValueError("Длина ключа должна быть положительным числом")
    
    alphabet = string.ascii_uppercase + string.digits
    key = ''.join(secrets.choice(alphabet) for _ in range(length))
    # Не логируем сам ключ доступа в production
    return key

@app.post("/register_step1", response_model=schemas.RegisterStep1Response, status_code=status.HTTP_201_CREATED)
async def register_step1(
    user_data: schemas.RegisterStep1Request,
    db: Session = Depends(get_db)
):
    """
    Первый этап регистрации - создание пользователя и генерация ключа доступа.
    """
    logger.info(f"Запрос на регистрацию (шаг 1): {user_data}")
    db_user_by_login = db.query(models.User).filter(models.User.login == user_data.login).first()
    if db_user_by_login:
        logger.warning(f"Попытка регистрации с занятым именем: {user_data.login}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя уже занято"
        )
    
    access_key = generate_access_key()
    
    db_user = models.User(
        login=user_data.login,
        userName=user_data.userName if user_data.userName else user_data.login,
        password=utils.get_password_hash(user_data.password),  # Хэшируем пароль на сервере
        publicKey=user_data.publicKey,
        encryptedPrivateKeyByUser=user_data.encryptedPrivateKeyByUser,
        salt=user_data.salt,
        created_at=date.today(),
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"Зарегистрирован новый пользователь: {user_data.login}")
    
    return schemas.RegisterStep1Response(
        accessKey=access_key,
        user_id=db_user.id,
        login=db_user.login
    )

@app.post("/register_step2", response_model=schemas.RegisterStep2Response)
async def register_step2(
    user_data: schemas.RegisterStep2Request,
    db: Session = Depends(get_db)
):
    """
    Второй этап регистрации - сохранение зашифрованного приватного ключа ключом доступа.
    """
    logger.info(f"Запрос на регистрацию (шаг 2): {user_data}")
    user = db.query(models.User).filter(models.User.login == user_data.login).first()
    if not user:
        logger.warning(f"Пользователь не найден при step2: {user_data.login}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    user.encryptedPrivateKeyByAccessKey = user_data.encryptedPrivateKeyByAccessKey
    db.commit()
    
    logger.info(f"Завершена регистрация пользователя: {user_data.login}")
    
    return schemas.RegisterStep2Response()

@app.post("/login", response_model=schemas.LoginResponse)
async def login_for_access_token(
    user_credentials: schemas.LoginRequest, 
    db: Session = Depends(get_db)
):
    """
    Аутентифицирует пользователя и возвращает JWT токен с криптографическими данными.
    """
    logger.info(f"Попытка входа: {user_credentials.login}")
    user = db.query(models.User).filter(models.User.login == user_credentials.login).first()
    
    if not user:
        logger.warning(f"Неудачная попытка входа для пользователя: {user_credentials.login}, не найден")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Неверное имя пользователя или пользователь с данным логином не существует",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not utils.verify_password(user_credentials.password, user.password):
        logger.warning(f"Неудачная попытка входа для пользователя: {user_credentials.login}, неверный пароль")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = utils.create_access_token(data={"sub": user.login})
    
    logger.info(f"Успешный вход пользователя: {user.login}")
    
    return schemas.LoginResponse(
        access_token=access_token,
        token_type="bearer",
        encryptedPrivateKeyByUser=user.encryptedPrivateKeyByUser,
        salt=user.salt,
        publicKey=user.publicKey
    )

@app.post("/recover_account_by_access_key", response_model=schemas.RecoveryResponse)
async def recover_account_by_access_key(
    recovery_data: schemas.RecoveryRequest,
    db: Session = Depends(get_db)
):
    """
    Восстановление аккаунта по ключу доступа.
    ВАЖНО: Здесь должен быть реализован строгий rate limiting!
    """
    logger.info(f"Запрос на восстановление аккаунта: {recovery_data.login}")
    user = db.query(models.User).filter(models.User.login == recovery_data.login).first()
    if not user:
        logger.warning(f"Пользователь не найден при восстановлении: {recovery_data.login}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    if not user.encryptedPrivateKeyByAccessKey:
        logger.warning(f"Ключ восстановления не найден для пользователя: {recovery_data.login}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ключ восстановления не найден"
        )
    
    logger.info(f"Восстановление аккаунта успешно: {recovery_data.login}")
    return schemas.RecoveryResponse(
        encryptedPrivateKeyByAccessKey=user.encryptedPrivateKeyByAccessKey
    )

@app.post("/update_password_and_keys", response_model=schemas.UpdatePasswordAndKeysResponse)
async def update_password_and_keys(
    update_data: schemas.UpdatePasswordAndKeysRequest,
    db: Session = Depends(get_db)
):
    """
    Обновление пароля и ключей пользователя.
    """
    logger.info(f"Запрос на обновление пароля и ключей: {update_data.login}")
    user = db.query(models.User).filter(models.User.login == update_data.login).first()
    if not user:
        logger.warning(f"Пользователь не найден при обновлении пароля: {update_data.login}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    user.password = utils.get_password_hash(update_data.newHashedPassword)
    user.encryptedPrivateKeyByUser = update_data.newEncryptedPrivateKeyByUser
    user.salt = update_data.newSalt
    
    db.commit()
    
    logger.info(f"Обновлен пароль пользователя: {update_data.login}")
    
    return schemas.UpdatePasswordAndKeysResponse()

@app.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def register_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    """
    УСТАРЕВШИЙ ЭНДПОИНТ - используйте /register_step1 и /register_step2
    """
    logger.warning("Вызван устаревший эндпоинт /register")
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Этот эндпоинт устарел. Используйте /register_step1 и /register_step2 для регистрации с криптографической защитой."
    )

@app.get("/user", response_model=schemas.User)
async def read_current_user(current_user: models.User = Depends(get_current_user)):
    """
    Возвращает данные текущего аутентифицированного пользователя.
    """
    logger.info(f"Получение данных текущего пользователя: {current_user.login}")
    return current_user

@app.post("/user/update/avatar")
async def update_avatar(
    avatar: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Обновляет аватар пользователя.
    """
    logger.info(f"Обновление аватара пользователя: {current_user.login}")
    current_user.avatar = utils.save_avatar(avatar, current_user.login)
    logger.info(f"Путь к аватару пользователя: {current_user.avatar}")
    db.commit()
    db.refresh(current_user)
    logger.info(f"Аватар пользователя {current_user.login} успешно обновлен")
    return current_user

@app.get("/user/avatar/{username}")
async def get_avatar(username: str, db: Session = Depends(get_db)):
    """
    Получить аватар пользователя по username.
    """
    logger.info(f"Запрос аватара пользователя: {username}")
    user = db.query(models.User).filter(models.User.login == username).first()
    if user is None:
        logger.warning(f"Пользователь не найден при запросе аватара: {username}")
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    avatar_path = "storage/avatars/" + user.avatar
    logger.info(f"Путь к аватару: {avatar_path}")
    return FileResponse(avatar_path)

@app.post("/user/update/name", response_model=schemas.User)
async def update_user_name(
    userName: str = Body(..., embed=True),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Обновляет имя пользователя (userName).
    """
    logger.info(f"Обновление имени пользователя: {current_user.login} -> {userName}")
    current_user.userName = userName
    db.commit()
    db.refresh(current_user)
    logger.info(f"Имя пользователя {current_user.login} успешно обновлено")
    return current_user

@app.get("/user/chats", response_model=list[ChatWithUserInfo])
async def get_user_chats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Получить список чатов пользователя с информацией о собеседниках.
    """
    logger.info(f"Получение чатов пользователя: {current_user.login}")
    chats = db.query(models.Chats).filter(
        (models.Chats.user1_id == current_user.id) | (models.Chats.user2_id == current_user.id)
    ).all()
    result = []
    for chat in chats:
        if chat.user1_id == current_user.id:
            companion_id = chat.user2_id
        else:
            companion_id = chat.user1_id
        companion = db.query(models.User).filter(models.User.id == companion_id).first()
        chat_table_name = f"chat_{chat.id}"
        sql = f"SELECT id, sender_id, ciphertext, nonce, envelopes, message_type, metadata, created_at, edited_at, is_read FROM {chat_table_name} ORDER BY created_at DESC LIMIT 1"
        messege = db.execute(text(sql)).fetchone()
        if messege:
            last_message = {
                "id": messege[0],
                "chat_id": chat.id,
                "sender_id": messege[1],
                "ciphertext": base64.b64encode(messege[2]).decode('utf-8') if messege[2] else "",
                "nonce": base64.b64encode(messege[3]).decode('utf-8') if messege[3] else "",
                "envelopes": messege[4],
                "message_type": messege[5],
                "metadata": messege[6],
                "created_at": messege[7].isoformat() if messege[7] else None,
                "edited_at": messege[8].isoformat() if messege[8] else None,
                "is_read": messege[9],
            }
        else:
            last_message = None
        
        result.append(ChatWithUserInfo(
            chat_id=chat.id,
            user_id=current_user.id,
            companion_id=companion_id,
            created_at=chat.created_at,
            companion_avatar=companion.avatar if companion else None,
            companion_userName=companion.userName if companion else None,
            companion_pubKey=companion.publicKey if companion else None,
            last_message=last_message
        ))
    logger.info(f"Найдено чатов: {len(result)}")
    return result

@app.post("/chat/create")
async def create_chat(
    companion_id: int = Body(..., embed=True),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Создать новый чат между пользователями (или вернуть существующий).
    Динамически создаёт таблицу для сообщений чата.
    """
    logger.info(f"Запрос на создание чата: user={current_user.id}, companion={companion_id}")
    chat = db.query(models.Chats).filter(
        ((models.Chats.user1_id == current_user.id) & (models.Chats.user2_id == companion_id)) |
        ((models.Chats.user1_id == companion_id) & (models.Chats.user2_id == current_user.id))
    ).first()
    if chat:
        logger.info(f"Чат уже существует: chat_id={chat.id}")
        return {"chat_id": chat.id, "user1_id": chat.user1_id, "user2_id": chat.user2_id, "created_at": chat.created_at}
    
    new_chat = models.Chats(user1_id=current_user.id, user2_id=companion_id, created_at=date.today())
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    chat_table_name = f"chat_{new_chat.id}"
    create_table_sql = f'''
        CREATE TABLE IF NOT EXISTS chat_{new_chat.id} (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL,
            ciphertext BYTEA NOT NULL,
            nonce BYTEA NOT NULL,
            envelopes JSONB NOT NULL,
            message_type VARCHAR(25) NOT NULL DEFAULT 'text',
            metadata JSONB,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            edited_at TIMESTAMP NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE
        );
    '''

    create_files_table_sql = f'''
        CREATE TABLE IF NOT EXISTS chat_{new_chat.id}_files (
            id SERIAL PRIMARY KEY,
            message_id INTEGER NOT NULL,
            file_id BIGINT NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            mimetype VARCHAR(100) NOT NULL,
            size BIGINT NOT NULL,
            nonce VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            FOREIGN KEY (message_id) REFERENCES chat_{new_chat.id}(id) ON DELETE CASCADE
        );
    '''

    try:
        ddl_engine = create_engine(
            settings.DATABASE_URL,
            isolation_level="AUTOCOMMIT"
        )
        with ddl_engine.connect() as connection:
            connection.execute(text(create_table_sql))
            connection.execute(text(create_files_table_sql))
        
        logger.info(f"Создана таблица для чата: {chat_table_name}")
        
    except Exception as e:
        logger.error(f"Ошибка при создании таблицы чата {chat_table_name}: {e}")
        db.delete(new_chat)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при создании чата"
        )

    logger.info(f"Чат успешно создан: chat_id={new_chat.id}")
    return {
        "chat_id": new_chat.id, 
        "user1_id": new_chat.user1_id, 
        "user2_id": new_chat.user2_id, 
        "created_at": new_chat.created_at
    }

@app.post("/user/search", response_model=list[schemas.User])
async def search_users(
    login: str = Body(..., embed=True),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Поиск пользователей по части имени (userName), кроме себя.
    """
    logger.info(f"Поиск пользователей: {login}")
    users = db.query(models.User).filter(
        models.User.userName.contains(login),
        models.User.id != current_user.id
    ).all()
    logger.info(f"Найдено пользователей: {len(users)}")
    logger.debug(f"Пользователи: {users}")
    return users

@app.get("/chat/{chatId}/messages", response_model=list[schemas.Message])
async def get_messages(chatId: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Получить все сообщения из чата по chatId.
    """
    chat_table_name = f"chat_{chatId}"
    sql = f"SELECT id, sender_id, ciphertext, nonce, envelopes, message_type, metadata, created_at, edited_at, is_read FROM {chat_table_name} ORDER BY created_at ASC"
    logger.info(f"Запрос сообщений чата: {chat_table_name}")
    try:
        result = db.execute(text(sql))
        messages = []
        for row in result.fetchall():
            # Обработка envelopes
            envelopes = row[4]
            if envelopes and isinstance(envelopes, str):
                try:
                    envelopes = json.loads(envelopes)
                except (json.JSONDecodeError, TypeError):
                    logger.warning(f"Ошибка парсинга envelopes для сообщения {row[0]}")
                    envelopes = {}
            
            # Обработка metadata
            metadata = row[6]
            logger.info(f"Raw metadata for message {row[0]}: {metadata}")
            if metadata and isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                    logger.info(f"Parsed metadata for message {row[0]}: {metadata}")
                except (json.JSONDecodeError, TypeError):
                    logger.warning(f"Ошибка парсинга metadata для сообщения {row[0]}")
                    metadata = None
            
            messages.append({
                "id": row[0],
                "chat_id": chatId,
                "sender_id": row[1],
                "ciphertext": base64.b64encode(row[2]).decode('utf-8') if row[2] else "",
                "nonce": base64.b64encode(row[3]).decode('utf-8') if row[3] else "",
                "envelopes": envelopes,
                "message_type": row[5],
                "metadata": metadata,
                "created_at": row[7].isoformat() if row[7] else None,
                "edited_at": row[8].isoformat() if row[8] else None,
                "is_read": row[9],
            })
        logger.info(f"Получено {len(messages)} сообщений из {chat_table_name}")
        return messages
    except Exception as e:
        logger.error(f"Ошибка при получении сообщений из {chat_table_name}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при получении сообщений")

@app.post("/chat/massage")
async def save_massage(
    message: schemas.Message,
    db: Session = Depends(get_db)
):
    """
    Сохраняет сообщение в таблицу чата. Если есть файлы, сохраняет их в файловую систему.
    """
    logger.info(f"Сохранение сообщения в чат {message.chat_id}")
    chat_table_name = f"chat_{message.chat_id}"

    def parse_datetime(dt_val):
        if dt_val is None:
            return datetime.now()
        if isinstance(dt_val, datetime):
            return dt_val
        try:
            if len(dt_val) == 8 and dt_val.count(":") == 2:
                today = datetime.now().date()
                return datetime.strptime(f"{today} {dt_val}", "%Y-%m-%d %H:%M:%S")
            return datetime.fromisoformat(dt_val)
        except Exception as e:
            logger.error(f"Ошибка преобразования времени: {dt_val} — {e}")
            return datetime.now()

    created_at = parse_datetime(message.created_at)
    edited_at = parse_datetime(message.edited_at) if message.edited_at else None

    def decode_bytes(val):
        if val is None:
            return b''
        try:
            return base64.b64decode(val)
        except Exception:
            try:
                return binascii.unhexlify(val)
            except Exception:
                logger.error(f"Не удалось декодировать bytes поле: {val}")
                return b''

    ciphertext_bytes = decode_bytes(message.ciphertext)
    nonce_bytes = decode_bytes(message.nonce)
    envelopes_json = json.dumps(message.envelopes) if message.envelopes is not None else '{}'
    
    # Подготавливаем metadata без зашифрованных файлов для сохранения в БД
    metadata_for_db = None
    if message.metadata and isinstance(message.metadata, list):
        metadata_for_db = []
        for file_info in message.metadata:
            if isinstance(file_info, dict):
                # Копируем метаданные без encFile, но сохраняем важные поля для видео
                clean_file_info = {
                    'file_id': file_info.get('file_id'),
                    'filename': file_info.get('filename'),
                    'file_creation_date': file_info.get('file_creation_date'),
                    'mimetype': file_info.get('mimetype'),
                    'size': file_info.get('size'),
                    'nonce': file_info.get('nonce')
                }
                
                # Добавляем поля для видео файлов (chunked upload)
                if file_info.get('chunk_count'):
                    clean_file_info['chunk_count'] = file_info.get('chunk_count')
                if file_info.get('chunk_size'):
                    clean_file_info['chunk_size'] = file_info.get('chunk_size')
                if file_info.get('nonces'):
                    clean_file_info['nonces'] = file_info.get('nonces')
                
                metadata_for_db.append(clean_file_info)
    
    metadata_json = json.dumps(metadata_for_db) if metadata_for_db is not None else None
    logger.info(f"Metadata for DB: {metadata_json}")

    sql = f"""
        INSERT INTO {chat_table_name} 
        (sender_id, ciphertext, nonce, envelopes, message_type, metadata, created_at, edited_at, is_read)
        VALUES 
        (:sender_id, :ciphertext, :nonce, :envelopes, :message_type, :metadata, :created_at, :edited_at, :is_read)
        RETURNING id
    """
    
    try:
        # Сохраняем сообщение и получаем его ID
        result = db.execute(text(sql), {
            "sender_id": message.sender_id,
            "ciphertext": ciphertext_bytes,
            "nonce": nonce_bytes,
            "envelopes": envelopes_json,
            "message_type": message.message_type,
            "metadata": metadata_json,
            "created_at": created_at,
            "edited_at": edited_at,
            "is_read": message.is_read
        })
        
        message_id = result.fetchone()[0]
        db.commit()
        
        # Если есть файлы в metadata, сохраняем их в файловую систему
        if message.metadata and isinstance(message.metadata, list):
            files_table_name = f"chat_{message.chat_id}_files"
            logger.info(f"Сохранение {len(message.metadata)} файлов для сообщения {message_id}")
            
            for i, file_info in enumerate(message.metadata):
                if isinstance(file_info, dict) and 'file_id' in file_info:
                    try:
                        logger.info(f"Сохраняется файл: chat_id={message.chat_id}, file_id={file_info['file_id']}, filename={file_info.get('filename')}")
                        # --- Поддержка chunked файлов ---
                        if 'chunks' in file_info:
                            encrypted_data = json.dumps({'chunks': file_info['chunks']})
                        else:
                            encrypted_data = file_info.get('encFile', '')
                        file_path = save_encrypted_file(
                            chat_id=message.chat_id,
                            file_id=file_info['file_id'],
                            filename=file_info.get('filename', f"file_{file_info['file_id']}"),
                            encrypted_data=encrypted_data
                        )
                        # --- конец блока ---
                        
                        logger.info(f"Файл сохранен: chat_id={message.chat_id}, file_id={file_info['file_id']}, filename={file_info.get('filename')}")
                        
                        # Сохраняем информацию о файле в БД
                        file_sql = f"""
                            INSERT INTO {files_table_name} 
                            (message_id, file_id, file_path, filename, mimetype, size, nonce, created_at)
                            VALUES 
                            (:message_id, :file_id, :file_path, :filename, :mimetype, :size, :nonce, :created_at)
                        """
                        
                        file_params = {
                            "message_id": message_id,
                            "file_id": file_info['file_id'],
                            "file_path": file_path,
                            "filename": file_info.get('filename', f"file_{file_info['file_id']}"),
                            "mimetype": file_info.get('mimetype', 'application/octet-stream'),
                            "size": file_info.get('size', 0),
                            "nonce": file_info.get('nonce', ''),
                            "created_at": created_at
                        }
                        
                        logger.info(f"Параметры файла: {file_params}")
                        
                        db.execute(text(file_sql), file_params)
                        logger.info(f"Файл {file_info.get('filename', 'unknown')} успешно сохранен в БД")
                        
                    except Exception as e:
                        logger.error(f"Ошибка сохранения файла {file_info.get('filename', 'unknown')}: {e}")
                        # Продолжаем обработку других файлов
                else:
                    logger.warning(f"Пропускаем файл {i+1}: отсутствуют file_id или encFile")
        else:
            logger.info("Нет файлов для сохранения")
        
        db.commit()
        logger.info(f"Сообщение {message_id} успешно сохранено в {chat_table_name}")
        return {"message": "Message saved successfully", "message_id": message_id}
        
    except Exception as e:
        logger.error(f"Ошибка при сохранении сообщения в {chat_table_name}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка при сохранении сообщений")

@app.get("/chat/{chatId}/messages/{messageId}/files", response_model=list[schemas.FileInfo])
async def get_message_files(
    chatId: int, 
    messageId: int, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Получить файлы для конкретного сообщения.
    """
    files_table_name = f"chat_{chatId}_files"
    table_name = f"chat_{chatId}"
    sql = f"""
        SELECT id, message_id, file_id, file_path, filename, mimetype, size, nonce, created_at 
        FROM {files_table_name} 
        WHERE message_id = :message_id 
        ORDER BY file_id
    """
    
    sql_2 = f"""
        SELECT id, metadata
        FROM {table_name}
        WHERE id = :message_id
    """
    
    try:
        result = db.execute(text(sql), {"message_id": messageId})
        result2 = db.execute(text(sql_2), {"message_id": messageId})
        metadata = None
        row2 = result2.fetchone()
        if row2 and row2[1]:
            try:
                metadata = json.loads(row2[1]) if isinstance(row2[1], str) else row2[1]
            except Exception as e:
                logger.warning(f"Не удалось декодировать metadata для message_id {messageId}: {e}")
                metadata = row2[1]
        files = [
            {
                "id": row[0],
                "message_id": row[1],
                "file_id": row[2],
                "file_path": row[3],
                "filename": row[4],
                "mimetype": row[5],
                "size": row[6],
                "nonce": row[7],
                "created_at": row[8].isoformat() if row[8] else None,
                "metadata": metadata
            }
            for row in result.fetchall()
        ]
        logger.info(f"Получено файлов: {len(files)} для chat_id={chatId}, message_id={messageId}")
        if files:
            logger.info(f"Файлы: {files}")
        else:
            logger.warning(f"Файлы не найдены для message_id {messageId}")
        return files
    except Exception as e:
        logger.error(f"Ошибка при получении файлов для сообщения {messageId}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при получении файлов")

@app.get("/chat/file/{file_path:path}")
async def get_file_content(
    file_path: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить содержимое файла по пути.
    """
    try:
        # Проверяем, что файл существует в БД (для безопасности)
        # Можно добавить дополнительную проверку доступа пользователя к файлу

        path = os.path.join("storage", file_path.replace("/", os.sep))
        logger.info(f"path: {path}")
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Файл не найден в хранилище")
        
        with open(path, 'rb') as f:
            file_data = f.read()

        encoded_data = base64.b64encode(file_data).decode('utf-8')
        
        return {
            "encrypted_data": encoded_data,
            "file_path": file_path
        }
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Файл не найден")
    except Exception as e:
        logger.error(f"Ошибка при получении файла {file_path}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при получении файла")

def get_video_dir(chat_id, file_id):
    base_dir = os.path.join("storage", "chats", f"chat_{chat_id}", f"{file_id}")
    os.makedirs(base_dir, exist_ok=True)
    return base_dir

@app.post("/chat/upload_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}")
async def upload_video_chunk(
    chat_id: int,
    message_id: int,
    file_id: int,
    chunk_index: int,
    chunk_data: dict,
    current_user: models.User = Depends(get_current_user),
):
    """
    Загружает один чанк видео (idempotent).
    """
    video_dir = get_video_dir(chat_id, file_id)
    chunk_path = os.path.join(video_dir, f"{chunk_index}.chenc")
    meta_path = os.path.join(video_dir, "metadata.json")
    try:
        # Логируем попытку записи чанка
        logger.info(f"[UPLOAD_CHUNK] chat_id={chat_id}, message_id={message_id}, file_id={file_id}, chunk_index={chunk_index}, path={chunk_path}")
        # Если чанк уже есть — не перезаписываем
        if os.path.exists(chunk_path):
            logger.info(f"[UPLOAD_CHUNK] Chunk {chunk_index} already exists at {chunk_path}")
            return {"status": "exists"}
        chunk_bytes = base64.b64decode(chunk_data["chunk"])
        with open(chunk_path, "wb") as f:
            f.write(chunk_bytes)
        logger.info(f"[UPLOAD_CHUNK] Saved chunk {chunk_index} ({len(chunk_bytes)} bytes) at {chunk_path}")
        # Nonce сохраняем в metadata (добавим/обновим ниже)
        meta = {}
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        if "nonces" not in meta:
            meta["nonces"] = []
        # Убедимся, что список nonces достаточно длинный
        while len(meta["nonces"]) <= chunk_index:
            meta["nonces"].append("")
        meta["nonces"][chunk_index] = chunk_data["nonce"]
        # Не сохраняем никаких base64-чанков в metadata!
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f)
        logger.info(f"[UPLOAD_CHUNK] Updated metadata nonces for chunk {chunk_index} at {meta_path}")
        # Логируем структуру папки
        logger.info(f"[UPLOAD_CHUNK] Dir listing: {os.listdir(video_dir)}")
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"[UPLOAD_CHUNK][ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении чанка: {e}")

@app.options("/chat/upload_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}")
async def options_upload_chunk():
    return Response(status_code=200)

@app.post("/chat/upload_metadata/{chat_id}/{message_id}/{file_id}")
async def upload_video_metadata(
    chat_id: int,
    message_id: int,
    file_id: int,
    metadata: dict,
    current_user: models.User = Depends(get_current_user),
):
    """
    Загружает metadata для видео.
    """
    video_dir = get_video_dir(chat_id, file_id)
    meta_path = os.path.join(video_dir, "metadata.json")
    try:
        # Логируем metadata
        logger.info(f"[UPLOAD_METADATA] chat_id={chat_id}, message_id={message_id}, file_id={file_id}, path={meta_path}")
        # Оставляем только нужные поля (без base64-чанков)
        allowed_keys = {"filename", "mimetype", "size", "chunk_count", "chunk_size", "nonces"}
        clean_metadata = {k: v for k, v in metadata.items() if k in allowed_keys}
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(clean_metadata, f)
        logger.info(f"[UPLOAD_METADATA] Saved metadata: {clean_metadata}")
        logger.info(f"[UPLOAD_METADATA] Dir listing: {os.listdir(video_dir)}")
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"[UPLOAD_METADATA][ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении metadata: {e}")

@app.get("/chat/file_metadata/{chat_id}/{message_id}/{file_id}")
async def get_video_metadata(
    chat_id: int,
    message_id: int,
    file_id: int,
    current_user: models.User = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    video_dir = get_video_dir(chat_id, file_id)
    meta_path = os.path.join(video_dir, "metadata.json")
    logger.info(f"[GET_METADATA] Looking for metadata at: {meta_path}")
    if not os.path.exists(meta_path):
        logger.error(f"[GET_METADATA] Metadata not found at: {meta_path}")
        raise HTTPException(status_code=404, detail="Metadata not found")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return meta

@app.get("/chat/file_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}")
async def get_video_chunk(
    chat_id: int,
    message_id: int,
    file_id: int,
    chunk_index: int,
    current_user: models.User = Depends(get_current_user),
):
    video_dir = get_video_dir(chat_id, file_id)
    chunk_path = os.path.join(video_dir, f"{chunk_index}.chenc")
    meta_path = os.path.join(video_dir, "metadata.json")
    if not os.path.exists(chunk_path) or not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Chunk or metadata not found")
    with open(chunk_path, "rb") as f:
        chunk_bytes = f.read()
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    nonce = meta.get("nonces", [""])[chunk_index] if "nonces" in meta and len(meta["nonces"]) > chunk_index else ""
    return {
        "chunk": base64.b64encode(chunk_bytes).decode("utf-8"),
        "nonce": nonce,
        "index": chunk_index
    }

@app.get("/auth/verify")
async def verify_token(current_user: models.User = Depends(get_current_user)):
    return {"user_id": current_user.id}

if __name__ == "__main__":
    import uvicorn
    # Запускаем сервер с горячей перезагрузкой
    logger.info("Запуск сервера FastAPI...")
    uvicorn.run(
        "app:app", 
        host=os.getenv('API_HOST', "0.0.0.0"), 
        port=int(os.getenv('API_PORT', 8000)), 
        reload=os.getenv('RELOAD', 'true').lower() == 'true',
        log_level=os.getenv('UVICORN_LOG_LEVEL', "info")
    )