from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import logging

from db import models
from db.database import get_db
from config.config import settings


logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
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


