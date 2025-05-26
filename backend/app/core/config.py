import os
import secrets
from typing import Any, Dict, List, Optional, Union
from pathlib import Path

from pydantic import validator, BaseModel, EmailStr, Field, ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Restaurant App"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "your-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 дней
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 дней
    
    # Настройки базы данных
    DATABASE_URL: str = "sqlite:///./restaurant.db"
    
    # Настройки CORS
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost",
        "https://localhost",
        "https://localhost:3000",
        "https://localhost:8000",
    ]
    
    # Настройки сервера
    SERVER_HOST: str = "localhost"
    SERVER_PORT: int = 8000
    DEBUG: bool = True
    WORKERS_COUNT: int = 1
    
    # Email настройки
    SMTP_TLS: bool = True
    SMTP_PORT: Optional[int] = None
    SMTP_HOST: Optional[str] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[EmailStr] = None
    EMAILS_FROM_NAME: Optional[str] = None
    
    # Настройки для первого пользователя
    FIRST_SUPERUSER_EMAIL: EmailStr = "admin@example.com"
    FIRST_SUPERUSER_PASSWORD: str = "admin"
    FIRST_SUPERUSER_FULL_NAME: str = "Administrator"
    FIRST_SUPERUSER_PHONE: str = "+7 (999) 123-45-67"
    
    # Настройки для тестов
    TEST_USER_EMAIL: EmailStr = "test@example.com"
    TEST_USER_PASSWORD: str = "test"
    TEST_USER_FULL_NAME: str = "Test User"
    TEST_USER_PHONE: str = "+7 (999) 765-43-21"
    
    # Дополнительные настройки
    LOGGING_LEVEL: str = "INFO"
    DEFAULT_LOCALE: str = "ru"
    TIMEZONE: str = "Europe/Moscow"
    
    # Настройки для JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_SECRET_KEY: str = "your-secret-key"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 дней

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


settings = Settings() 