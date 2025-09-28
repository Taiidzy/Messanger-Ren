from fastapi import UploadFile
import os
import logging

def save_avatar(avatar: UploadFile, login: str) -> str:
    if avatar.filename.split(".")[-1] not in ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico"]: # noqa: E501
        raise ValueError("Недопустимое расширение файла")
    
    file_name = login + "." + avatar.filename.split(".")[-1]
    file_path = f"storage/avatars/{file_name}"
    # Ensure target directory exists (works with mounted volume at /app/storage)
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
    except Exception as e:
        logging.getLogger(__name__).error(f"Failed to create directory: {e}")
    
    abs_path = os.path.abspath(file_path)
    logging.getLogger(__name__).info(f"Saving avatar for '{login}' to: {abs_path}")
    
    # Удаляем предыдущий аватар, если он существует
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Ensure we read from the beginning of the uploaded file
    try:
        avatar.file.seek(0)
    except Exception:
        pass
    
    with open(file_path, "wb") as f:
        f.write(avatar.file.read())
    return file_name