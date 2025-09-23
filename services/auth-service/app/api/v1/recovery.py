from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import models
from app.db.base import get_db
from app.schemas import recovery

from app.core import security


router = APIRouter(prefix="/recovery", tags=["recovery"])


@router.post("/recover_account_by_access_key", response_model=recovery.RecoveryResponse)
async def recover_account_by_access_key(
    recovery_data: recovery.RecoveryRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.login == recovery_data.login).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    if not user.encryptedPrivateKeyByAccessKey:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ключ восстановления не найден")
    return recovery.RecoveryResponse(encryptedPrivateKeyByAccessKey=user.encryptedPrivateKeyByAccessKey)


@router.post("/update_password_and_keys", response_model=recovery.UpdatePasswordAndKeysResponse)
async def update_password_and_keys(
    update_data: recovery.UpdatePasswordAndKeysRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.login == update_data.login).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    user.password = security.get_password_hash(update_data.newPassword)
    user.encryptedPrivateKeyByUser = update_data.newEncryptedPrivateKeyByUser
    user.salt = update_data.newSalt
    db.commit()
    return recovery.UpdatePasswordAndKeysResponse()
