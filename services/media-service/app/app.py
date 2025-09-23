import logging
import os
import time
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .routers.media import router as media_router

# Logging setup
logger = logging.getLogger(__name__)
log_formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
file_handler = logging.FileHandler('media-service.log', encoding='utf-8')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(log_formatter)

console_handler = logging.StreamHandler()
console_handler.setLevel(getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper(), logging.INFO))
console_handler.setFormatter(log_formatter)

logger.handlers = []
logger.addHandler(file_handler)
logger.addHandler(console_handler)
logger.setLevel(getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper(), logging.INFO))

app = FastAPI(
    title="Media Service",
    description="Chunked encrypted file storage for chats",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
    root_path="/media-service",
)

# CORS: Explicit origins are required when allow_credentials=True
# Starlette/FastAPI will not send "Access-Control-Allow-Origin" with "*" if credentials are allowed.
# Allow both production domains and localhost for development.
allowed_origins = [
    "https://messanger-ren.ru",
    "https://www.messanger-ren.ru",
    "https://api.messanger-ren.ru",
    "http://localhost:5173",
    "http://localhost:4173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Middleware для логирования запросов
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        return response
    except Exception as e:
        process_time = time.time() - start_time
        raise

app.include_router(media_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=os.getenv('RELOAD', 'false').lower() == 'true',
        log_level=os.getenv('UVICORN_LOG_LEVEL', 'info')
    )
