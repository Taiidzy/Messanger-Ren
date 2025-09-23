from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from datetime import date
import logging

from app.db import models
from app.db.base import get_db
from app.db.models import User

from app.core import security

from app.schemas import register

def register_step1(user_credentials: register.RegisterStep1Response, db: Session) -> register.RegisterStep1Response | int:
    db_user_by_login = db.query(models.User).filter(models.User.login == user_credentials.login).first()
    if db_user_by_login:
        return 404

    access_key = security.generate_access_key()
    db_user = models.User(
        login=user_credentials.login,
        userName=user_credentials.userName if user_credentials.userName else user_credentials.login,
        password=security.get_password_hash(user_credentials.password),
        publicKey=user_credentials.publicKey,
        encryptedPrivateKeyByUser=user_credentials.encryptedPrivateKeyByUser,
        salt=user_credentials.salt,
        created_at=date.today(),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return register.RegisterStep1Response(accessKey=access_key, user_id=db_user.id, login=db_user.login)

def register_step2(user_credentials: register.RegisterStep2Request, db: Session) -> register.RegisterStep2Response | None:
    user = db.query(models.User).filter(models.User.login == user_credentials.login).first()
    if not user:
        return None
    user.encryptedPrivateKeyByAccessKey = user_credentials.encryptedPrivateKeyByAccessKey
    db.commit()
    return register.RegisterStep2Response()