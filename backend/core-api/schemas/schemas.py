from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, List
from datetime import date

class UserBase(BaseModel):
    login: str
    userName: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(UserBase):
    password: str

class User(UserBase):
    id: int
    avatar: Optional[str]
    createdAt: date = Field(..., alias='created_at')
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# Новые схемы для криптографической системы
class RegisterStep1Request(BaseModel):
    login: str
    userName: Optional[str] = None
    password: str  # Обычный пароль (будет хэширован на сервере)
    publicKey: str
    encryptedPrivateKeyByUser: str
    salt: str

class RegisterStep1Response(BaseModel):
    accessKey: str
    user_id: int
    login: str

class RegisterStep2Request(BaseModel):
    login: str
    encryptedPrivateKeyByAccessKey: str

class RegisterStep2Response(BaseModel):
    message: str = "Registration completed successfully"

class LoginRequest(BaseModel):
    login: str
    password: str  # Обычный пароль

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    encryptedPrivateKeyByUser: str
    salt: str
    publicKey: str

class RecoveryRequest(BaseModel):
    login: str

class RecoveryResponse(BaseModel):
    encryptedPrivateKeyByAccessKey: str

class UpdatePasswordAndKeysRequest(BaseModel):
    login: str
    newHashedPassword: str  # Новый обычный пароль (будет хэширован на сервере)
    newEncryptedPrivateKeyByUser: str
    newSalt: str

class UpdatePasswordAndKeysResponse(BaseModel):
    message: str = "Password updated successfully"

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None 

class ChatBase(BaseModel):
    id: int
    user1_id: int
    user2_id: int
    created_at: date

class UserInfo(BaseModel):
    id: int
    userName: str

class Message(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    ciphertext: str         
    nonce: str               
    envelopes: dict          
    message_type: str        # text / file / message_with_files
    metadata: Optional[list] = None

    created_at: Optional[str] = None
    edited_at: Optional[str] = None
    is_read: bool = False

class ChatWithUserInfo(BaseModel):
    chat_id: int
    user_id: int  # id текущего пользователя
    companion_id: int  # id собеседника
    created_at: date
    companion_avatar: Optional[str]
    companion_userName: Optional[str]
    companion_pubKey: Optional[str]
    last_message: Optional[Message] = None

class FileInfo(BaseModel):
    id: int
    message_id: int
    file_id: int
    file_path: str
    filename: str
    mimetype: str
    size: int
    nonce: str
    created_at: Optional[str] = None
    metadata: Optional[list]
