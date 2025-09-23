from fastapi import UploadFile
import os

def save_avatar(avatar: UploadFile, login: str) -> str:
    if avatar.filename.split(".")[-1] not in ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico"]: # noqa: E501
        raise ValueError("Недопустимое расширение файла")
    
    file_name = login + "." + avatar.filename.split(".")[-1]
    file_path = f"storage/avatars/{file_name}"
    # Ensure target directory exists (works with mounted volume at /app/storage)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    # Удаляем предыдущий аватар, если он существует
    if os.path.exists(file_path):
        os.remove(file_path)
    
    with open(file_path, "wb") as f:
        f.write(avatar.file.read())
    return file_name