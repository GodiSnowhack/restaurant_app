from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models.user import UserRole, AgeGroup


# Базовая схема пользователя
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    role: Optional[UserRole] = UserRole.CLIENT
    birthday: Optional[date] = None
    age_group: Optional[AgeGroup] = None

    model_config = ConfigDict(from_attributes=True)


# Схема для создания пользователя
class UserCreate(UserBase):
    password: str


# Схема для обновления пользователя
class UserUpdate(UserBase):
    password: Optional[str] = None


# Схема для ответа пользователю
class UserInDBBase(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Схема для JWT токена
class Token(BaseModel):
    access_token: str
    token_type: str


# Схема для данных токена
class TokenPayload(BaseModel):
    sub: int
    exp: int


# Схема для запроса авторизации
class LoginRequest(BaseModel):
    """Схема для запроса авторизации"""
    email: EmailStr
    password: str


# Класс для входа (переименованный LoginRequest для обратной совместимости)
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Класс для ответа с токеном
class UserResponseWithToken(UserInDBBase):
    token: Token


# Класс для обновления роли пользователя
class UserRoleUpdate(BaseModel):
    role: UserRole


# Класс для обновления пароля пользователя
class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str


# Класс для хранения пользователя в базе данных
class UserInDB(UserInDBBase):
    hashed_password: str


# Класс для пользователя
class User(UserInDBBase):
    pass


# Схема для ответа пользователю
class UserResponse(UserInDBBase):
    pass 