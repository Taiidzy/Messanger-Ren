from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import models
from app.db.base import get_db
from app.schemas import register

from app.services import register_service as registerService


router = APIRouter(prefix="/register", tags=["register"])


@router.post("/step1", response_model=register.RegisterStep1Response, status_code=status.HTTP_201_CREATED)
async def register_step1(
    user_data: register.RegisterStep1Request,
    db: Session = Depends(get_db),
):
    result = registerService.register_step1(user_data, db)

    if result == 400:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Данный логин уже занят")

    return result


@router.post("/step2", response_model=register.RegisterStep2Response)
async def register_step2(
    user_data: register.RegisterStep2Request,
    db: Session = Depends(get_db),
):
    user = registerService.register_step2(user_data, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    return user
