from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, List
from datetime import date

class RecoveryRequest(BaseModel):
    login: str

class RecoveryResponse(BaseModel):
    encryptedPrivateKeyByAccessKey: str

class UpdatePasswordAndKeysRequest(BaseModel):
    login: str
    oldPassword: str 
    newPassword: str
    newEncryptedPrivateKeyByUser: str
    newSalt: str

class UpdatePasswordAndKeysResponse(BaseModel):
    message: str = "Password updated successfully"