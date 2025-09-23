from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, List
from datetime import date

class RegisterStep1Request(BaseModel):
    login: str
    userName: Optional[str] = None
    password: str 
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