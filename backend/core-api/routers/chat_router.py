import base64
import binascii
import json
from datetime import datetime, date
import os

from fastapi import APIRouter, Depends, HTTPException, status, Body, Response
from sqlalchemy.orm import Session
from sqlalchemy import text, create_engine

from db import models
from db.database import get_db
from dependencies.auth import get_current_user
from schemas import schemas
from utils.file_utils import save_encrypted_file, delete_file
from config.config import settings
import shutil


router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/create")
async def create_chat(
    companion_id: int = Body(..., embed=True),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chat = db.query(models.Chats).filter(
        ((models.Chats.user1_id == current_user.id) & (models.Chats.user2_id == companion_id))
        | ((models.Chats.user1_id == companion_id) & (models.Chats.user2_id == current_user.id))
    ).first()
    if chat:
        return {"chat_id": chat.id, "user1_id": chat.user1_id, "user2_id": chat.user2_id, "created_at": chat.created_at}

    new_chat = models.Chats(user1_id=current_user.id, user2_id=companion_id, created_at=date.today())
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)

    chat_table_name = f"chat_{new_chat.id}"
    create_table_sql = f'''
        CREATE TABLE IF NOT EXISTS chat_{new_chat.id} (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL,
            ciphertext BYTEA NOT NULL,
            nonce BYTEA NOT NULL,
            envelopes JSONB NOT NULL,
            message_type VARCHAR(25) NOT NULL DEFAULT 'text',
            metadata JSONB,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            edited_at TIMESTAMP NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE
        );
    '''

    create_files_table_sql = f'''
        CREATE TABLE IF NOT EXISTS chat_{new_chat.id}_files (
            id SERIAL PRIMARY KEY,
            message_id INTEGER NOT NULL,
            file_id BIGINT NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            mimetype VARCHAR(100) NOT NULL,
            size BIGINT NOT NULL,
            nonce VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            FOREIGN KEY (message_id) REFERENCES chat_{new_chat.id}(id) ON DELETE CASCADE
        );
    '''

    try:
        ddl_engine = create_engine(settings.DATABASE_URL, isolation_level="AUTOCOMMIT")
        with ddl_engine.connect() as connection:
            connection.execute(text(create_table_sql))
            connection.execute(text(create_files_table_sql))
    except Exception:
        db.delete(new_chat)
        db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ошибка при создании чата")

    return {"chat_id": new_chat.id, "user1_id": new_chat.user1_id, "user2_id": new_chat.user2_id, "created_at": new_chat.created_at}


@router.get("/{chatId}/messages", response_model=list[schemas.Message])
async def get_messages(chatId: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat_table_name = f"chat_{chatId}"
    sql = f"SELECT id, sender_id, ciphertext, nonce, envelopes, message_type, metadata, created_at, edited_at, is_read FROM {chat_table_name} ORDER BY created_at ASC"
    try:
        result = db.execute(text(sql))
        messages = []
        for row in result.fetchall():
            envelopes = row[4]
            if envelopes and isinstance(envelopes, str):
                try:
                    envelopes = json.loads(envelopes)
                except (json.JSONDecodeError, TypeError):
                    envelopes = {}
            metadata = row[6]
            if metadata and isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except (json.JSONDecodeError, TypeError):
                    metadata = None
            messages.append(
                {
                    "id": row[0],
                    "chat_id": chatId,
                    "sender_id": row[1],
                    "ciphertext": base64.b64encode(row[2]).decode("utf-8") if row[2] else "",
                    "nonce": base64.b64encode(row[3]).decode("utf-8") if row[3] else "",
                    "envelopes": envelopes,
                    "message_type": row[5],
                    "metadata": metadata,
                    "created_at": row[7].isoformat() if row[7] else None,
                    "edited_at": row[8].isoformat() if row[8] else None,
                    "is_read": row[9],
                }
            )
        return messages
    except Exception:
        raise HTTPException(status_code=500, detail="Ошибка при получении сообщений")


@router.post("/massage")
async def save_massage(
    message: schemas.Message,
    db: Session = Depends(get_db),
):
    chat_table_name = f"chat_{message.chat_id}"

    def parse_datetime(dt_val):
        if dt_val is None:
            return datetime.now()
        if isinstance(dt_val, datetime):
            return dt_val
        try:
            if isinstance(dt_val, str) and len(dt_val) == 8 and dt_val.count(":") == 2:
                today = datetime.now().date()
                return datetime.strptime(f"{today} {dt_val}", "%Y-%m-%d %H:%M:%S")
            return datetime.fromisoformat(dt_val)
        except Exception:
            return datetime.now()

    created_at = parse_datetime(message.created_at)
    edited_at = parse_datetime(message.edited_at) if message.edited_at else None

    def decode_bytes(val):
        if val is None:
            return b""
        try:
            return base64.b64decode(val)
        except Exception:
            try:
                return binascii.unhexlify(val)
            except Exception:
                return b""

    ciphertext_bytes = decode_bytes(message.ciphertext)
    nonce_bytes = decode_bytes(message.nonce)
    envelopes_json = json.dumps(message.envelopes) if message.envelopes is not None else "{}"

    metadata_for_db = None
    if message.metadata and isinstance(message.metadata, list):
        metadata_for_db = []
        for file_info in message.metadata:
            if isinstance(file_info, dict):
                clean_file_info = {
                    "file_id": file_info.get("file_id"),
                    "filename": file_info.get("filename"),
                    "file_creation_date": file_info.get("file_creation_date"),
                    "mimetype": file_info.get("mimetype"),
                    "size": file_info.get("size"),
                    "nonce": file_info.get("nonce"),
                }
                if file_info.get("chunk_count"):
                    clean_file_info["chunk_count"] = file_info.get("chunk_count")
                if file_info.get("chunk_size"):
                    clean_file_info["chunk_size"] = file_info.get("chunk_size")
                if file_info.get("nonces"):
                    clean_file_info["nonces"] = file_info.get("nonces")
                metadata_for_db.append(clean_file_info)

    metadata_json = json.dumps(metadata_for_db) if metadata_for_db is not None else None

    sql = f"""
        INSERT INTO {chat_table_name}
        (sender_id, ciphertext, nonce, envelopes, message_type, metadata, created_at, edited_at, is_read)
        VALUES
        (:sender_id, :ciphertext, :nonce, :envelopes, :message_type, :metadata, :created_at, :edited_at, :is_read)
        RETURNING id
    """

    try:
        result = db.execute(
            text(sql),
            {
                "sender_id": message.sender_id,
                "ciphertext": ciphertext_bytes,
                "nonce": nonce_bytes,
                "envelopes": envelopes_json,
                "message_type": message.message_type,
                "metadata": metadata_json,
                "created_at": created_at,
                "edited_at": edited_at,
                "is_read": message.is_read,
            },
        )
        message_id = result.fetchone()[0]
        db.commit()

        if message.metadata and isinstance(message.metadata, list):
            files_table_name = f"chat_{message.chat_id}_files"
            for file_info in message.metadata:
                if isinstance(file_info, dict) and "file_id" in file_info:
                    if "chunks" in file_info:
                        encrypted_data = json.dumps({"chunks": file_info["chunks"]})
                    else:
                        encrypted_data = file_info.get("encFile", "")
                    file_path = save_encrypted_file(
                        chat_id=message.chat_id,
                        file_id=file_info["file_id"],
                        filename=file_info.get("filename", f"file_{file_info['file_id']}"),
                        encrypted_data=encrypted_data,
                    )
                    file_sql = f"""
                        INSERT INTO {files_table_name}
                        (message_id, file_id, file_path, filename, mimetype, size, nonce, created_at)
                        VALUES
                        (:message_id, :file_id, :file_path, :filename, :mimetype, :size, :nonce, :created_at)
                    """
                    file_params = {
                        "message_id": message_id,
                        "file_id": file_info["file_id"],
                        "file_path": file_path,
                        "filename": file_info.get("filename", f"file_{file_info['file_id']}"),
                        "mimetype": file_info.get("mimetype", "application/octet-stream"),
                        "size": file_info.get("size", 0),
                        "nonce": file_info.get("nonce", ""),
                        "created_at": created_at,
                    }
                    db.execute(text(file_sql), file_params)
        db.commit()
        return {"message": "Message saved successfully", "message_id": message_id}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка при сохранении сообщений")


@router.get("/{chatId}/messages/{messageId}/files", response_model=list[schemas.FileInfo])
async def get_message_files(
    chatId: int,
    messageId: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    files_table_name = f"chat_{chatId}_files"
    table_name = f"chat_{chatId}"
    sql = f"""
        SELECT id, message_id, file_id, file_path, filename, mimetype, size, nonce, created_at
        FROM {files_table_name}
        WHERE message_id = :message_id
        ORDER BY file_id
    """
    sql_2 = f"""
        SELECT id, metadata
        FROM {table_name}
        WHERE id = :message_id
    """
    try:
        result = db.execute(text(sql), {"message_id": messageId})
        result2 = db.execute(text(sql_2), {"message_id": messageId})
        metadata = None
        row2 = result2.fetchone()
        if row2 and row2[1]:
            try:
                metadata = json.loads(row2[1]) if isinstance(row2[1], str) else row2[1]
            except Exception:
                metadata = row2[1]
        files = [
            {
                "id": row[0],
                "message_id": row[1],
                "file_id": row[2],
                "file_path": row[3],
                "filename": row[4],
                "mimetype": row[5],
                "size": row[6],
                "nonce": row[7],
                "created_at": row[8].isoformat() if row[8] else None,
                "metadata": metadata,
            }
            for row in result.fetchall()
        ]
        return files
    except Exception:
        raise HTTPException(status_code=500, detail="Ошибка при получении файлов")


def get_video_dir(chat_id, file_id):
    base_dir = os.path.join("storage", "chats", f"chat_{chat_id}", f"{file_id}")
    os.makedirs(base_dir, exist_ok=True)
    return base_dir


@router.post("/upload_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}")
async def upload_video_chunk(
    chat_id: int,
    message_id: int,
    file_id: int,
    chunk_index: int,
    chunk_data: dict,
    current_user: models.User = Depends(get_current_user),
):
    video_dir = get_video_dir(chat_id, file_id)
    chunk_path = os.path.join(video_dir, f"{chunk_index}.chenc")
    meta_path = os.path.join(video_dir, "metadata.json")
    try:
        if os.path.exists(chunk_path):
            return {"status": "exists"}
        chunk_bytes = base64.b64decode(chunk_data["chunk"])
        with open(chunk_path, "wb") as f:
            f.write(chunk_bytes)
        meta = {}
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        if "nonces" not in meta:
            meta["nonces"] = []
        while len(meta["nonces"]) <= chunk_index:
            meta["nonces"].append("")
        meta["nonces"][chunk_index] = chunk_data["nonce"]
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении чанка: {e}")


@router.options("/upload_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}")
async def options_upload_chunk():
    return Response(status_code=200)


@router.post("/upload_metadata/{chat_id}/{message_id}/{file_id}")
async def upload_video_metadata(
    chat_id: int,
    message_id: int,
    file_id: int,
    metadata: dict,
    current_user: models.User = Depends(get_current_user),
):
    video_dir = get_video_dir(chat_id, file_id)
    meta_path = os.path.join(video_dir, "metadata.json")
    try:
        allowed_keys = {"filename", "mimetype", "size", "chunk_count", "chunk_size", "nonces"}
        clean_metadata = {k: v for k, v in metadata.items() if k in allowed_keys}
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(clean_metadata, f)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении metadata: {e}")


@router.get("/file_metadata/{chat_id}/{message_id}/{file_id}")
async def get_video_metadata(
    chat_id: int,
    message_id: int,
    file_id: int,
    current_user: models.User = Depends(get_current_user),
):
    video_dir = get_video_dir(chat_id, file_id)
    meta_path = os.path.join(video_dir, "metadata.json")
    if not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Metadata not found")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return meta


@router.get("/file_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}")
async def get_video_chunk(
    chat_id: int,
    message_id: int,
    file_id: int,
    chunk_index: int,
    current_user: models.User = Depends(get_current_user),
):
    video_dir = get_video_dir(chat_id, file_id)
    chunk_path = os.path.join(video_dir, f"{chunk_index}.chenc")
    meta_path = os.path.join(video_dir, "metadata.json")
    if not os.path.exists(chunk_path) or not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Chunk or metadata not found")
    with open(chunk_path, "rb") as f:
        chunk_bytes = f.read()
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    nonce = meta.get("nonces", [""])[chunk_index] if "nonces" in meta and len(meta["nonces"]) > chunk_index else ""
    return {"chunk": base64.b64encode(chunk_bytes).decode("utf-8"), "nonce": nonce, "index": chunk_index}

def _assert_user_in_chat(db: Session, chat_id: int, user_id: int) -> None:
    chat = db.query(models.Chats).filter(
        (models.Chats.id == chat_id)
        & ((models.Chats.user1_id == user_id) | (models.Chats.user2_id == user_id))
    ).first()
    if not chat:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к чату")


@router.delete("/{chat_id}/messages/{message_id}")
async def delete_message(
    chat_id: int,
    message_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_user_in_chat(db, chat_id, current_user.id)
    chat_table = f"chat_{chat_id}"
    files_table = f"chat_{chat_id}_files"

    try:
        # Собираем файлы для удаления
        files_rows = db.execute(
            text(f"SELECT id, file_id, file_path FROM {files_table} WHERE message_id = :mid"),
            {"mid": message_id},
        ).fetchall()

        # Удаляем файлы из ФС
        for row in files_rows:
            file_id = row[1]
            file_path = row[2]
            if file_path:
                try:
                    delete_file(file_path)
                except Exception:
                    pass
            # Удаляем каталог для chunked, если есть
            chunk_dir = os.path.join("storage", "chats", f"chat_{chat_id}", f"{file_id}")
            if os.path.isdir(chunk_dir):
                try:
                    shutil.rmtree(chunk_dir, ignore_errors=True)
                except Exception:
                    pass

        # Удаляем записи о файлах
        db.execute(text(f"DELETE FROM {files_table} WHERE message_id = :mid"), {"mid": message_id})
        # Удаляем само сообщение
        result = db.execute(text(f"DELETE FROM {chat_table} WHERE id = :mid"), {"mid": message_id})
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сообщение не найдено")
        return {"status": "ok"}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка при удалении сообщения")


@router.patch("/{chat_id}/messages/{message_id}")
async def update_message(
    chat_id: int,
    message_id: int,
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Обновляет поля сообщения: ciphertext, nonce, envelopes, message_type, metadata, is_read.
    edited_at устанавливается автоматически.
    Только отправитель сообщения может редактировать.
    """
    _assert_user_in_chat(db, chat_id, current_user.id)
    chat_table = f"chat_{chat_id}"

    # Проверяем, что сообщение существует и принадлежит пользователю
    row = db.execute(
        text(f"SELECT sender_id FROM {chat_table} WHERE id = :mid"), {"mid": message_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сообщение не найдено")
    if row[0] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Можно редактировать только свои сообщения")

    # Подготовка полей
    allowed_fields = {"ciphertext", "nonce", "envelopes", "message_type", "metadata", "is_read"}
    fields = {k: v for k, v in payload.items() if k in allowed_fields}
    if not fields:
        return {"status": "noop"}

    # Обработка двоичных полей
    def decode_bytes(val):
        if val is None:
            return b""
        try:
            return base64.b64decode(val)
        except Exception:
            try:
                return binascii.unhexlify(val)
            except Exception:
                return b""

    params: dict = {"mid": message_id}
    sets: list[str] = ["edited_at = NOW()"]
    if "ciphertext" in fields:
        params["ciphertext"] = decode_bytes(fields["ciphertext"]) if fields["ciphertext"] else b""
        sets.append("ciphertext = :ciphertext")
    if "nonce" in fields:
        params["nonce"] = decode_bytes(fields["nonce"]) if fields["nonce"] else b""
        sets.append("nonce = :nonce")
    if "envelopes" in fields:
        params["envelopes"] = json.dumps(fields["envelopes"]) if fields["envelopes"] is not None else "{}"
        sets.append("envelopes = :envelopes")
    if "message_type" in fields:
        params["message_type"] = fields["message_type"]
        sets.append("message_type = :message_type")
    if "metadata" in fields:
        params["metadata"] = json.dumps(fields["metadata"]) if fields["metadata"] is not None else None
        sets.append("metadata = :metadata")
    if "is_read" in fields:
        params["is_read"] = bool(fields["is_read"])
        sets.append("is_read = :is_read")

    sql = f"UPDATE {chat_table} SET " + ", ".join(sets) + " WHERE id = :mid"
    try:
        db.execute(text(sql), params)
        db.commit()
        return {"status": "ok"}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка при обновлении сообщения")
