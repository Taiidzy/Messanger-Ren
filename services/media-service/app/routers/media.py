import base64
import json
import logging
import os
import shutil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status, Request

from ..core.auth import verify_token
from ..core.config import settings
from ..db import get_cursor

# Настройка логгера
logger = logging.getLogger(__name__)

router = APIRouter()

# Добавляем явную обработку OPTIONS для всех эндпоинтов
@router.options("/{path:path}")
async def options_handler(path: str):
    """Обработка preflight OPTIONS запросов"""
    logger.info(f"OPTIONS request for path: {path}")
    return Response(status_code=200)


def get_video_dir(chat_id: int, file_id: int) -> str:
    base_dir = os.path.join(settings.STORAGE_ROOT, "chats", f"chat_{chat_id}", f"{file_id}")
    os.makedirs(base_dir, exist_ok=True)
    logger.info(f"Created/accessed video directory: {base_dir}")
    return base_dir


@router.post("/upload_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}")
async def upload_video_chunk(
    request: Request,
    chat_id: int,
    message_id: int,
    file_id: int,
    chunk_index: int,
    chunk_data: dict,
    user_id: int = Depends(verify_token),
):
    # Логируем заголовки запроса для диагностики CORS
    origin = request.headers.get("origin", "No Origin")
    user_agent = request.headers.get("user-agent", "No User-Agent")
    content_type = request.headers.get("content-type", "No Content-Type")
    
    logger.info(f"Starting chunk upload - chat_id: {chat_id}, message_id: {message_id}, file_id: {file_id}, chunk_index: {chunk_index}, user_id: {user_id}")
    logger.info(f"Request headers - Origin: {origin}, User-Agent: {user_agent[:100]}..., Content-Type: {content_type}")
    logger.info(f"Chunk data keys: {list(chunk_data.keys()) if isinstance(chunk_data, dict) else 'Not a dict'}")
    
    video_dir = get_video_dir(chat_id, file_id)
    chunk_path = os.path.join(video_dir, f"{chunk_index}.chenc")
    meta_path = os.path.join(video_dir, "metadata.json")
    
    try:
        if os.path.exists(chunk_path):
            logger.info(f"Chunk already exists: {chunk_path}")
            return {"status": "exists"}
        
        chunk_bytes = base64.b64decode(chunk_data["chunk"]) if isinstance(chunk_data.get("chunk"), str) else b""
        logger.debug(f"Decoded chunk size: {len(chunk_bytes)} bytes")
        
        with open(chunk_path, "wb") as f:
            f.write(chunk_bytes)
        logger.info(f"Successfully wrote chunk to: {chunk_path}")
        
        meta: dict = {}
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                try:
                    meta = json.load(f)
                    logger.debug(f"Loaded existing metadata: {len(meta)} keys")
                except Exception as e:
                    logger.warning(f"Failed to load metadata, using empty dict: {e}")
                    meta = {}
        
        if "nonces" not in meta:
            meta["nonces"] = []
            
        while len(meta["nonces"]) <= chunk_index:
            meta["nonces"].append("")
            
        meta["nonces"][chunk_index] = chunk_data.get("nonce", "")
        
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f)
        logger.info(f"Updated metadata with nonce for chunk {chunk_index}")
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error uploading chunk {chunk_index} for file {file_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении чанка: {e}")


@router.post("/upload_metadata/{chat_id}/{message_id}/{file_id}")
async def upload_video_metadata(
    chat_id: int,
    message_id: int,
    file_id: int,
    metadata: dict,
    user_id: int = Depends(verify_token),
):
    logger.info(f"Uploading metadata - chat_id: {chat_id}, message_id: {message_id}, file_id: {file_id}, user_id: {user_id}")
    logger.debug(f"Metadata keys: {list(metadata.keys())}")
    
    video_dir = get_video_dir(chat_id, file_id)
    meta_path = os.path.join(video_dir, "metadata.json")
    
    try:
        allowed_keys = {"filename", "mimetype", "size", "chunk_count", "chunk_size", "nonces", "duration"}
        clean_metadata = {k: v for k, v in metadata.items() if k in allowed_keys}
        
        filtered_keys = set(metadata.keys()) - allowed_keys
        if filtered_keys:
            logger.warning(f"Filtered out metadata keys: {filtered_keys}")
        
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(clean_metadata, f)
        logger.info(f"Successfully saved metadata to: {meta_path}")
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error saving metadata for file {file_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении metadata: {e}")


@router.get("/file_metadata/{chat_id}/{message_id}/{file_id}")
async def get_video_metadata(
    chat_id: int,
    message_id: int,
    file_id: int,
    user_id: int = Depends(verify_token),
):
    logger.info(f"Getting metadata - chat_id: {chat_id}, message_id: {message_id}, file_id: {file_id}, user_id: {user_id}")
    
    video_dir = get_video_dir(chat_id, file_id)
    meta_path = os.path.join(video_dir, "metadata.json")
    
    if not os.path.exists(meta_path):
        logger.warning(f"Metadata not found: {meta_path}")
        raise HTTPException(status_code=404, detail="Metadata not found")
    
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        logger.info(f"Successfully retrieved metadata with {len(meta)} keys")
        return meta
    except Exception as e:
        logger.error(f"Error reading metadata from {meta_path}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка при чтении metadata")


@router.get("/file_chunk/{chat_id}/{message_id}/{file_id}/{chunk_index}")
async def get_video_chunk(
    chat_id: int,
    message_id: int,
    file_id: int,
    chunk_index: int,
    user_id: int = Depends(verify_token),
):
    logger.info(f"Getting chunk - chat_id: {chat_id}, message_id: {message_id}, file_id: {file_id}, chunk_index: {chunk_index}, user_id: {user_id}")
    
    video_dir = get_video_dir(chat_id, file_id)
    chunk_path = os.path.join(video_dir, f"{chunk_index}.chenc")
    meta_path = os.path.join(video_dir, "metadata.json")
    
    if not os.path.exists(chunk_path):
        logger.warning(f"Chunk not found: {chunk_path}")
        raise HTTPException(status_code=404, detail="Chunk not found")
    
    if not os.path.exists(meta_path):
        logger.warning(f"Metadata not found: {meta_path}")
        raise HTTPException(status_code=404, detail="Metadata not found")
    
    try:
        with open(chunk_path, "rb") as f:
            chunk_bytes = f.read()
        logger.debug(f"Read chunk size: {len(chunk_bytes)} bytes")
        
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        
        nonce = meta.get("nonces", [""])[chunk_index] if "nonces" in meta and len(meta["nonces"]) > chunk_index else ""
        
        logger.info(f"Successfully retrieved chunk {chunk_index}")
        return {"chunk": base64.b64encode(chunk_bytes).decode("utf-8"), "nonce": nonce, "index": chunk_index}
    except Exception as e:
        logger.error(f"Error reading chunk {chunk_index}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка при чтении чанка")


@router.get("/file/{file_path:path}")
async def get_file_content(
    file_path: str,
    user_id: int = Depends(verify_token),
):
    logger.info(f"Getting file content - file_path: {file_path}, user_id: {user_id}")
    
    try:
        # Normalize and prevent path traversal
        requested = os.path.normpath(file_path).lstrip("/\\")
        requested = requested.replace("..", "")
        logger.debug(f"Normalized requested path: {requested}")

        # If path already starts with STORAGE_ROOT (e.g., "storage/...") use as-is
        storage_root_norm = os.path.normpath(settings.STORAGE_ROOT)
        if os.path.isabs(requested) or requested.startswith(storage_root_norm):
            path = requested
        else:
            path = os.path.join(storage_root_norm, requested)

        # Ensure final path stays under storage root when absolute
        if os.path.isabs(path):
            # no-op
            pass
        else:
            # Convert to absolute based on CWD if needed
            path = os.path.normpath(path)
        
        logger.debug(f"Final resolved path: {path}")
        
        if not os.path.exists(path):
            logger.warning(f"File not found: {path}")
            raise HTTPException(status_code=404, detail="Файл не найден в хранилище")
        
        with open(path, "rb") as f:
            file_data = f.read()
        
        logger.info(f"Successfully read file: {path}, size: {len(file_data)} bytes")
        
        encoded_data = base64.b64encode(file_data).decode("utf-8")
        return {"encrypted_data": encoded_data, "file_path": file_path}
    except FileNotFoundError as e:
        logger.warning(f"File not found: {file_path} - {e}")
        raise HTTPException(status_code=404, detail="Файл не найден")
    except Exception as e:
        logger.error(f"Error getting file content for {file_path}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка при получении файла")


@router.get("/messages/{chat_id}/{message_id}/files")
async def get_message_files(
    chat_id: int,
    message_id: int,
    user_id: int = Depends(verify_token),
):
    logger.info(f"Getting message files - chat_id: {chat_id}, message_id: {message_id}, user_id: {user_id}")
    
    files_table = f"chat_{chat_id}_files"
    chat_table = f"chat_{chat_id}"
    
    sql_files = f"""
        SELECT id, message_id, file_id, file_path, filename, mimetype, size, nonce, created_at
        FROM {files_table}
        WHERE message_id = %s
        ORDER BY file_id
    """
    sql_meta = f"""
        SELECT id, metadata
        FROM {chat_table}
        WHERE id = %s
    """
    
    try:
        with get_cursor() as cur:
            logger.debug(f"Executing query on {files_table} for message_id: {message_id}")
            cur.execute(sql_files, (message_id,))
            rows = cur.fetchall()
            logger.debug(f"Found {len(rows)} files for message {message_id}")
            
            logger.debug(f"Executing metadata query on {chat_table} for message_id: {message_id}")
            cur.execute(sql_meta, (message_id,))
            meta_row = cur.fetchone()
        
        metadata = None
        if meta_row and meta_row.get("metadata"):
            try:
                metadata = meta_row["metadata"] if isinstance(meta_row["metadata"], dict) else json.loads(meta_row["metadata"])  # type: ignore
                logger.debug("Successfully parsed message metadata")
            except Exception as e:
                logger.warning(f"Failed to parse metadata JSON: {e}")
                metadata = meta_row["metadata"]
        
        files = [
            {
                "id": row["id"],
                "message_id": row["message_id"],
                "file_id": row["file_id"],
                "file_path": row["file_path"],
                "filename": row["filename"],
                "mimetype": row["mimetype"],
                "size": row["size"],
                "nonce": row["nonce"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "metadata": metadata,
            }
            for row in rows
        ]
        
        logger.info(f"Successfully retrieved {len(files)} files for message {message_id}")
        return files
    except Exception as e:
        logger.error(f"Error getting files for message {message_id} in chat {chat_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка при получении файлов")

@router.delete("/message/{chat_id}/{file_id}")
async def delete_message_file(
    chat_id: int,
    file_id: int,
    user_id: int = Depends(verify_token),
):
    logger.info(f"Deleting message file - chat_id: {chat_id}, file_id: {file_id}, user_id: {user_id}")
    # Build the expected directory path WITHOUT creating it
    storage_root = os.path.realpath(settings.STORAGE_ROOT)
    file_dir = os.path.join(storage_root, "chats", f"chat_{chat_id}", f"{file_id}")
    file_dir_real = os.path.realpath(file_dir)

    # Safety: ensure we're deleting only inside STORAGE_ROOT
    if not file_dir_real.startswith(storage_root):
        logger.warning(f"Refusing to delete outside storage root: {file_dir_real}")
        raise HTTPException(status_code=400, detail="Некорректный путь файла")

    try:
        if not os.path.exists(file_dir_real):
            logger.warning(f"File or directory to delete not found: {file_dir_real}")
            raise HTTPException(status_code=404, detail="Файл не найден")

        if os.path.isdir(file_dir_real):
            shutil.rmtree(file_dir_real)
            logger.info(f"Successfully deleted directory with chunks: {file_dir_real}")
        elif os.path.isfile(file_dir_real):
            os.remove(file_dir_real)
            logger.info(f"Successfully deleted file: {file_dir_real}")
        else:
            logger.warning(f"Path exists but is neither file nor directory: {file_dir_real}")
            raise HTTPException(status_code=404, detail="Файл не найден")

        return {"message": "Файл успешно удален"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting message file - chat_id: {chat_id}, file_id: {file_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка при удалении файла")
    
