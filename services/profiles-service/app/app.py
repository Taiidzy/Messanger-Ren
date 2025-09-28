import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.profiles import router as profiles_router
from app.api.v1.user import router as user_router

from app.db import models
from app.db.base import engine

from app.core.config import settings

# Logging setup
logger = logging.getLogger(__name__)
log_formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
file_handler = logging.FileHandler('profiles-service.log', encoding='utf-8')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(log_formatter)

console_handler = logging.StreamHandler()
console_handler.setLevel(getattr(logging, os.getenv('LOG_LEVEL', 'ERROR').upper(), logging.ERROR))
console_handler.setFormatter(log_formatter)

logger.handlers = []
logger.addHandler(file_handler)
logger.addHandler(console_handler)
logger.setLevel(getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper(), logging.INFO))

# Create tables
try:
    models.Base.metadata.create_all(bind=engine)
    logger.info("База данных успешно инициализирована")
except Exception as e:
    logger.error(f"Ошибка подключения к базе данных: {e}")


app = FastAPI(
    title="Auth API Ren",
    description="Auth API Ren",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
    root_path="/profiles-service",
)

# CORS
cors_origins_env = os.getenv('CORS_ORIGINS')
allow_origins = [o.strip() for o in cors_origins_env.split(',')] if cors_origins_env else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directory exists before mounting
os.makedirs("storage/avatars", exist_ok=True)
app.mount("/storage/avatars", StaticFiles(directory="storage/avatars"), name="avatar storage")

app.include_router(profiles_router)
app.include_router(user_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.RELOAD,
        log_level=settings.UVICORN_LOG_LEVEL,
    )