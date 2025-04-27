import os
import secrets
from typing import Any, Dict, List, Optional, Union

from pydantic import validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    # 60 минут * 24 часа * 8 дней = 8 дней
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    SERVER_NAME: str = "restaurant_app"
    SERVER_HOST: str = "0.0.0.0"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.10:3000",
        "http://192.168.0.11:3000",
        "http://192.168.0.12:3000",
        "http://192.168.0.13:3000",
        "http://192.168.0.14:3000",
        "http://192.168.0.15:3000",
        "http://192.168.0.16:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:3001",
        "http://localhost",
        "http://127.0.0.1",
        # HTTPS варианты
        "https://localhost:3000",
        "https://127.0.0.1:3000",
        "https://192.168.0.16:3000",
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
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # SQLite
    SQLITE_DATABASE_URI: str = "sqlite:///"+os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "data", "restaurant.db")
    
    # Redis (для очередей и кэширования)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    # Настройки сервера
    SERVER_PORT: int = 8000
    DEBUG: bool = True
    WORKERS_COUNT: int = 1
    
    # Настройки JWT
    JWT_SECRET: str = SECRET_KEY
    JWT_ALGORITHM: str = "HS256"
    
    # Настройки пользователей
    FIRST_SUPERUSER: str = "admin1@example.com"
    FIRST_SUPERUSER_PASSWORD: str = "admin123"

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings() 