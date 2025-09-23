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