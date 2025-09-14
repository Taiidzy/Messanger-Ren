import base64
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from dependencies.auth import get_current_user
from db import models


router = APIRouter(prefix="/chat", tags=["files"])


@router.get("/file/{file_path:path}")
async def get_file_content(
    file_path: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # Препятствуем выходу за пределы каталога storage
        normalized = os.path.normpath(file_path).replace("..", "")
        path = os.path.join("storage", normalized.replace("/", os.sep))
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Файл не найден в хранилище")
        with open(path, "rb") as f:
            file_data = f.read()
        encoded_data = base64.b64encode(file_data).decode("utf-8")
        return {"encrypted_data": encoded_data, "file_path": file_path}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Файл не найден")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Ошибка при получении файла")


