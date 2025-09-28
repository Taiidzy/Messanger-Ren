from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db import models
from app.db.base import get_db
from app.schemas.user import User
from app.core.auth import get_current_user

router = APIRouter(prefix="/profiles", tags=["profiles"])

@router.get("", response_model=User)
async def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.get("/search", response_model=list[User])
async def search_users(
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = db.query(models.User).filter(
        models.User.userName.contains(username),
        models.User.id != current_user.id,
    ).all()
    return users

@router.get("/avatar/{username}")
async def get_avatar(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.login == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    avatar_path = "storage/avatars/" + user.avatar
    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    return FileResponse(avatar_path, headers=headers)