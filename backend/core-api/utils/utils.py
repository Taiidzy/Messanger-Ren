from fastapi import UploadFile
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from config.config import settings
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    ) 

def save_avatar(avatar: UploadFile, login: str) -> str:
    if avatar.filename.split(".")[-1] not in ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico"]: # noqa: E501
        raise ValueError("Недопустимое расширение файла")
    
    file_name = login + "." + avatar.filename.split(".")[-1]
    file_path = f"storage/avatars/{file_name}"
    
    # Удаляем предыдущий аватар, если он существует
    if os.path.exists(file_path):
        os.remove(file_path)
    
    with open(file_path, "wb") as f:
        f.write(avatar.file.read())
    return file_name