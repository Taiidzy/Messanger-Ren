import os
from pydantic import BaseModel

class Settings(BaseModel):
    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("APP_PORT", "8003"))
    ROOT_PATH: str = os.getenv("ROOT_PATH", "/media-service")

    AUTH_HOST: str = os.getenv("AUTH_HOST", "http://localhost:8000")

    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", os.getenv("POSTGRES_SERVER", "localhost"))
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "postgres")
    POSTGRES_SSLMODE: str = os.getenv("POSTGRES_SSLMODE", "disable")

    STORAGE_ROOT: str = os.getenv("STORAGE_ROOT", "storage")

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgres://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}?sslmode={self.POSTGRES_SSLMODE}"
        )

settings = Settings()
