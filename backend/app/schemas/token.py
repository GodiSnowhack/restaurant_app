from typing import Optional
from pydantic import BaseModel


class Token(BaseModel):
    """Схема токена аутентификации"""
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None
    user: Optional[dict] = None


class TokenPayload(BaseModel):
    """Схема полезной нагрузки токена"""
    sub: Optional[int] = None
    exp: Optional[int] = None
    role: Optional[str] = None 