import os
import secrets
from typing import Any, Dict, List, Optional, Union, ClassVar
from pathlib import Path

from pydantic import validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    # Используем значение из .env или фиксированное значение по умолчанию
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-super-secret-key-keep-it-safe-and-secure-123")
    JWT_ALGORITHM: str = "HS256"
    # 60 минут * 24 часа * 8 дней = 8 дней
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    SERVER_NAME: str = "restaurant_app"
    SERVER_HOST: str = "0.0.0.0"
    
    # CORS
    # Этот список используется как значение ПО УМОЛЧАНИЮ, если переменная окружения BACKEND_CORS_ORIGINS не установлена.
    # Pydantic-settings автоматически попытается загрузить BACKEND_CORS_ORIGINS из окружения.
    # Валидатор assemble_cors_origins обработает строку из переменной окружения.
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000", # Для локальной разработки фронтенда
        "http://localhost:3001", # Для локальной разработки фронтенда
        "http://127.0.0.1:3000", # Для локальной разработки фронтенда
        "http://127.0.0.1:3001", # Для локальной разработки фронтенда
        "http://frontend-production-8eb6.up.railway.app",  # HTTP вариант
        "https://frontend-production-8eb6.up.railway.app", # HTTPS вариант
        "http://backend-production-1a78.up.railway.app",   # HTTP бэкенд
        "https://backend-production-1a78.up.railway.app",  # HTTPS бэкенд
    ]

    # Railway specific settings
    ROOT_PATH: str = ""
    
    @validator("ROOT_PATH", pre=True)
    def assemble_root_path(cls, v: Optional[str], values: Dict[str, Any]) -> str:
        return ""  # Отключаем root_path для избежания конфликтов маршрутизации

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return v # pragma: no cover

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

    # Настройки безопасности
    SECURITY_HEADERS: ClassVar[Dict[str, str]] = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    }

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings() 