from fastapi import APIRouter, Depends, File, UploadFile, Body
from sqlalchemy.orm import Session

from app.db import models
from app.db.base import get_db
from app.schemas.user import User
from app.core.auth import get_current_user

from app.services.user_service import save_avatar

router = APIRouter(prefix="/user", tags=["user"])

@router.post("/update/avatar", response_model=User)
async def update_avatar(
    avatar: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.avatar = save_avatar(avatar, current_user.login)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/update/name", response_model=User)
async def update_user_name(
    userName: str = Body(..., embed=True),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.userName = userName
    db.commit()
    db.refresh(current_user)
    return current_user