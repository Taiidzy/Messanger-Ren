from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import models
from db.database import get_db
from schemas import schemas
from utils import utils
from dependencies.auth import get_current_user


router = APIRouter(prefix="", tags=["auth"])


def generate_access_key(length: int = 8) -> str:
    import secrets
    import string

    if length <= 0:
        raise ValueError("Длина ключа должна быть положительным числом")
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/register_step1", response_model=schemas.RegisterStep1Response, status_code=status.HTTP_201_CREATED)
async def register_step1(
    user_data: schemas.RegisterStep1Request,
    db: Session = Depends(get_db),
):
    db_user_by_login = db.query(models.User).filter(models.User.login == user_data.login).first()
    if db_user_by_login:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Имя пользователя уже занято")

    access_key = generate_access_key()
    db_user = models.User(
        login=user_data.login,
        userName=user_data.userName if user_data.userName else user_data.login,
        password=utils.get_password_hash(user_data.password),
        publicKey=user_data.publicKey,
        encryptedPrivateKeyByUser=user_data.encryptedPrivateKeyByUser,
        salt=user_data.salt,
        created_at=date.today(),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return schemas.RegisterStep1Response(accessKey=access_key, user_id=db_user.id, login=db_user.login)


@router.post("/register_step2", response_model=schemas.RegisterStep2Response)
async def register_step2(
    user_data: schemas.RegisterStep2Request,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.login == user_data.login).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    user.encryptedPrivateKeyByAccessKey = user_data.encryptedPrivateKeyByAccessKey
    db.commit()
    return schemas.RegisterStep2Response()


@router.post("/login", response_model=schemas.LoginResponse)
async def login_for_access_token(
    user_credentials: schemas.LoginRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.login == user_credentials.login).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Неверное имя пользователя или пользователь с данным логином не существует",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not utils.verify_password(user_credentials.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный пароль", headers={"WWW-Authenticate": "Bearer"})

    access_token = utils.create_access_token(data={"sub": user.login})
    return schemas.LoginResponse(
        access_token=access_token,
        token_type="bearer",
        encryptedPrivateKeyByUser=user.encryptedPrivateKeyByUser,
        salt=user.salt,
        publicKey=user.publicKey,
        user_id=user.id,
    )


@router.post("/recover_account_by_access_key", response_model=schemas.RecoveryResponse)
async def recover_account_by_access_key(
    recovery_data: schemas.RecoveryRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.login == recovery_data.login).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    if not user.encryptedPrivateKeyByAccessKey:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ключ восстановления не найден")
    return schemas.RecoveryResponse(encryptedPrivateKeyByAccessKey=user.encryptedPrivateKeyByAccessKey)


@router.post("/update_password_and_keys", response_model=schemas.UpdatePasswordAndKeysResponse)
async def update_password_and_keys(
    update_data: schemas.UpdatePasswordAndKeysRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.login == update_data.login).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    user.password = utils.get_password_hash(update_data.newHashedPassword)
    user.encryptedPrivateKeyByUser = update_data.newEncryptedPrivateKeyByUser
    user.salt = update_data.newSalt
    db.commit()
    return schemas.UpdatePasswordAndKeysResponse()


@router.get("/auth/verify")
async def verify_token(current_user: models.User = Depends(get_current_user)):
    return {"user_id": current_user.id}


