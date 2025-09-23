from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.auth import LoginResponse, LoginRequest

from app.services import auth_service as auth

from app.db.base import get_db

from app.db import models


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login_for_access_token(
    user_credentials: LoginRequest,
    db: Session = Depends(get_db),
):
    user = auth.login(user_credentials, db)
    if user == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Неверное имя пользователя или пользователь с данным логином не существует",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user == 401:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный пароль", headers={"WWW-Authenticate": "Bearer"})

    return user

@router.get("/verify")
async def verify_token(current_user: models.User = Depends(auth.get_current_user)):
    return {"user_id": current_user.id}


