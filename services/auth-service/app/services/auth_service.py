from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import logging

from app.db import models
from app.db.base import get_db
from app.db.models import User

from app.schemas import auth
from app.core.config import settings
from app.core import security
# Настройка логгера
logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def login(user_credentials: auth.LoginRequest, db: Session) -> auth.LoginResponse | int:
    logger.info(f"Login attempt for user '{user_credentials.login}'")
    """
    Функция для логина пользователя.
    Принимает db как обычный параметр Session.
    """
    user = db.query(User).filter(models.User.login == user_credentials.login).first()
    if not user:
        return 404
    if not security.verify_password(user_credentials.password, user.password):
        return 401

    access_token = security.create_access_token(data={"sub": user.login})
    return auth.LoginResponse(
        access_token=access_token,
        token_type="bearer",
        encryptedPrivateKeyByUser=user.encryptedPrivateKeyByUser,
        salt=user.salt,
        publicKey=user.publicKey,
        user_id=user.id,
    )

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User | None:
    """
    Возвращает текущего пользователя по JWT токену из заголовка Authorization.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        username: str | None = payload.get("sub")
        if username is None:
            logger.warning("JWT токен не содержит sub")
            raise credentials_exception
    except JWTError as e:
        logger.error(f"Ошибка декодирования JWT: {e}")
        raise credentials_exception

    user = db.query(models.User).filter(models.User.login == username).first()
    if user is None:
        logger.warning(f"Пользователь {username} не найден по токену")
        raise credentials_exception

    return user