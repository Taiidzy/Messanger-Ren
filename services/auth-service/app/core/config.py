from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional
from urllib.parse import quote_plus
import os

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    POSTGRES_USER: str = Field(...)
    POSTGRES_PASSWORD: str = Field(...)
    POSTGRES_SERVER: str = Field(...)
    POSTGRES_PORT: str = Field(...)
    POSTGRES_DB: str = Field(...)
    
    @property
    def DATABASE_URL(self):
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{encoded_password}@postgres:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    SECRET_KEY: str = Field(...)
    ALGORITHM: str = Field(...)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(...)

    APP_HOST: str = Field(...)
    APP_PORT: int = Field(...)
    RELOAD: bool = Field(...)
    UVICORN_LOG_LEVEL: str = Field(...)

settings = Settings()