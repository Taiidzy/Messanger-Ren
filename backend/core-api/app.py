import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Gauge

from db import models
from db.database import engine

# Logging setup
logger = logging.getLogger(__name__)
log_formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
file_handler = logging.FileHandler('core-api.log', encoding='utf-8')
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


def generate_access_key(length: int = 8) -> str:
    import secrets
    import string
    if length <= 0:
        raise ValueError("Длина ключа должна быть положительным числом")
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


app = FastAPI(
    title="Messenger Core API",
    description="Core API for Messenger",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

# Создаем метрику для отслеживания активных запросов
http_requests_in_progress = Gauge(
    'http_requests_in_progress',
    'Number of in progress HTTP requests',
    ['method', 'endpoint', 'app_name']
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

# Middleware для отслеживания активных запросов
@app.middleware("http")
async def track_requests(request: Request, call_next):
    # Увеличиваем счетчик активных запросов
    http_requests_in_progress.labels(
        method=request.method,
        endpoint=request.url.path,
        app_name="messenger-backend"
    ).inc()
    
    try:
        response = await call_next(request)
        return response
    finally:
        # Уменьшаем счетчик активных запросов
        http_requests_in_progress.labels(
            method=request.method,
            endpoint=request.url.path,
            app_name="messenger-backend"
        ).dec()

# Static
app.mount("/storage/avatars", StaticFiles(directory="storage/avatars"), name="avatar storage")
Instrumentator().instrument(app).expose(app, include_in_schema=True)

# Routers
from routers.auth_router import router as auth_router  # noqa: E402
from routers.user_router import router as user_router  # noqa: E402
from routers.chat_router import router as chat_router  # noqa: E402
from routers.files_router import router as files_router  # noqa: E402

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(chat_router)
app.include_router(files_router)

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", 8000)),
        reload=os.getenv("RELOAD", "true").lower() == "true",
        log_level=os.getenv("UVICORN_LOG_LEVEL", "info"),
    )