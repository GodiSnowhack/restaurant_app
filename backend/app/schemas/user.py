from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


# Базовая схема пользователя
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    role: Optional[UserRole] = UserRole.GUEST


# Схема для создания пользователя
class UserCreate(UserBase):
    email: EmailStr
    password: str
    full_name: str


# Схема для обновления пользователя
class UserUpdate(UserBase):
    password: Optional[str] = None


# Схема для ответа пользователю
class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Схема для JWT токена
class Token(BaseModel):
    access_token: str
    token_type: str


# Схема для данных токена
class TokenPayload(BaseModel):
    sub: int
    exp: int


# Схема для аутентификации
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Класс для входа (переименованный LoginRequest для обратной совместимости)
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Класс для ответа с токеном
class UserResponseWithToken(UserResponse):
    token: Token


# Класс для обновления роли пользователя
class UserRoleUpdate(BaseModel):
    role: UserRole


# Класс для обновления пароля пользователя
class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str 