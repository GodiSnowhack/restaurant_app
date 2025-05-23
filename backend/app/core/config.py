import os
import secrets
from typing import Any, Dict, List, Optional, Union
from pathlib import Path

from pydantic import validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    # Используем значение из .env или фиксированное значение по умолчанию
    JWT_SECRET: str = "your-super-secret-key-keep-it-safe-and-secure-123"
    JWT_ALGORITHM: str = "HS256"
    # 60 минут * 24 часа * 8 дней = 8 дней
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    SERVER_NAME: str = "restaurant_app"
    SERVER_HOST: str = "0.0.0.0"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://localhost:3000",
        "http://localhost:8000",
        "https://localhost:8000",
        "http://frontend:3000",
        "https://frontend:3000",
        "http://backend:8000",
        "https://backend:8000",
        "https://frontend-production-8eb6.up.railway.app",
        "https://backend-production-1a78.up.railway.app"
    ]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    PROJECT_NAME: str = "Restaurant SPPR"
    
    # Окружение (development, staging, production)
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    
    # SQLite
    SQLITE_DATABASE_URI: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{Path(__file__).parent.parent.parent}/data/restaurant.db"
    )
    
    # Redis (для очередей и кэширования)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    # Настройки сервера
    SERVER_PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = False
    WORKERS_COUNT: int = 1  # Уменьшаем количество воркеров для Railway
    
    # Настройки пользователей
    FIRST_SUPERUSER: str = "admin1@example.com"
    FIRST_SUPERUSER_PASSWORD: str = "admin123"

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings() 