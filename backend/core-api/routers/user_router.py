from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from db import models
from db.database import get_db
from schemas import schemas
from dependencies.auth import get_current_user
from utils import utils


router = APIRouter(prefix="/user", tags=["user"])


@router.get("", response_model=schemas.User)
async def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/update/avatar", response_model=schemas.User)
async def update_avatar(
    avatar: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.avatar = utils.save_avatar(avatar, current_user.login)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/avatar/{username}")
async def get_avatar(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.login == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    avatar_path = "storage/avatars/" + user.avatar
    return FileResponse(avatar_path)


@router.post("/update/name", response_model=schemas.User)
async def update_user_name(
    userName: str = Body(..., embed=True),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.userName = userName
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/chats", response_model=list[schemas.ChatWithUserInfo])
async def get_user_chats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    from sqlalchemy import text
    import base64
    chats = db.query(models.Chats).filter(
        (models.Chats.user1_id == current_user.id) | (models.Chats.user2_id == current_user.id)
    ).all()
    result: list[schemas.ChatWithUserInfo] = []
    for chat in chats:
        companion_id = chat.user2_id if chat.user1_id == current_user.id else chat.user1_id
        companion = db.query(models.User).filter(models.User.id == companion_id).first()
        chat_table_name = f"chat_{chat.id}"
        sql = f"SELECT id, sender_id, ciphertext, nonce, envelopes, message_type, metadata, created_at, edited_at, is_read FROM {chat_table_name} ORDER BY created_at DESC LIMIT 1"
        messege = db.execute(text(sql)).fetchone()
        last_message = None
        if messege:
            last_message = {
                "id": messege[0],
                "chat_id": chat.id,
                "sender_id": messege[1],
                "ciphertext": base64.b64encode(messege[2]).decode("utf-8") if messege[2] else "",
                "nonce": base64.b64encode(messege[3]).decode("utf-8") if messege[3] else "",
                "envelopes": messege[4],
                "message_type": messege[5],
                "metadata": messege[6],
                "created_at": messege[7].isoformat() if messege[7] else None,
                "edited_at": messege[8].isoformat() if messege[8] else None,
                "is_read": messege[9],
            }
        result.append(
            schemas.ChatWithUserInfo(
                chat_id=chat.id,
                user_id=current_user.id,
                companion_id=companion_id,
                created_at=chat.created_at,
                companion_avatar=companion.avatar if companion else None,
                companion_userName=companion.userName if companion else None,
                companion_pubKey=companion.publicKey if companion else None,
                last_message=last_message,
            )
        )
    return result


@router.get("/search", response_model=list[schemas.User])
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


