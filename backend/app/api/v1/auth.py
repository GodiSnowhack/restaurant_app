from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    authenticate_user,
    get_current_active_user,
    get_password_hash
)
from app.database.session import get_db
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserResponse, LoginRequest

router = APIRouter()


@router.get("/")
async def auth_info():
    """Информация об API авторизации"""
    return {
        "message": "API авторизации работает",
        "endpoints": [
            {"path": "/login", "method": "POST", "description": "Авторизация пользователя"},
            {"path": "/register", "method": "POST", "description": "Регистрация пользователя"},
            {"path": "/_log", "method": "POST", "description": "Логирование ошибок авторизации"}
        ],
        "status": "ok"
    }


@router.post("/login", response_model=Token)
async def login(
    db: Session = Depends(get_db),
    login_data: LoginRequest = None,
    form_data: OAuth2PasswordRequestForm = Depends(None)
) -> Any:
    """
    Аутентификация пользователя и получение токена.
    Поддерживает JSON и form-data форматы.
    """
    try:
        # Определяем, какой формат данных используется
        if login_data:
            username = login_data.email
            password = login_data.password
        elif form_data:
            username = form_data.username
            password = form_data.password
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Необходимо предоставить данные для авторизации"
            )
        
        if not username or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Необходимо предоставить email и пароль"
            )
        
        # Аутентифицируем пользователя
        user = authenticate_user(db, username, password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Проверяем что пользователь активен
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь неактивен"
            )
        
        # Создаем токен доступа
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "role": user.role},
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/register", response_model=UserResponse)
def register(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """
    Регистрация нового пользователя
    """
    try:
        # Проверяем, не существует ли уже пользователь с таким email
        user = db.query(User).filter(User.email == user_in.email).first()
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        
        # Создаем нового пользователя
        user = User(
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            role=user_in.role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return user
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при регистрации: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
def read_users_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Получение информации о текущем пользователе
    """
    return current_user


@router.get("/profile", response_model=UserResponse)
def read_user_profile(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Получение профиля текущего пользователя
    """
    return current_user 