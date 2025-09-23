from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, List
from datetime import date

class LoginRequest(BaseModel):
    login: str
    password: str  # Обычный пароль

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    encryptedPrivateKeyByUser: str
    salt: str
    publicKey: str
    user_id: int